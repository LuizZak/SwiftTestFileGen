import path = require("path");
import * as vscode from "vscode";
import { SwiftTarget } from "../data/swiftPackage";
import { FallibleOperation, OperationWithDiagnostics, TestFileDiagnosticKind, TestFileDiagnosticResult } from "../data/testFileDiagnosticResult";
import { SwiftPackagePathsManager } from "../swiftPackagePathsManager";

/** Result object for a `suggestTestFiles` call. */
export type SourceToTestMapResult = OperationWithDiagnostics<{ originalPath: vscode.Uri, transformedPath: vscode.Uri | null }>;

/**
 * Provides functionality for mapping between corresponding source file <->
 * test file based on package manifest definitions and file directory structure
 * of input files.
 */
export class SourceToTestFileMapper {
    constructor(public pkg: SwiftPackagePathsManager) {

    }

    /**
     * From a given source file URL that is contained within a known Swift package
     * target directory, returns a path to a test file that mirrors that source
     * file's name and relative path, but as an absolute path in an associated
     * test target.
     *
     * Returns a `null` transformed path if the file's target could not be deduced.
     */
    async suggestedTestPathFor(sourceFileUrl: vscode.Uri): Promise<SourceToTestMapResult> {
        if (!(await this.pkg.isSourceFile(sourceFileUrl))) {
            return {
                originalPath: sourceFileUrl,
                transformedPath: null,
                diagnostics: [{
                    message: "File is not contained within a recognized Sources/ folder",
                    sourceFile: sourceFileUrl,
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                }]
            };
        }

        // Compute file / test class names
        const fileNameWithoutExt = path.basename(sourceFileUrl.fsPath, ".swift");
        const testFileName = `${fileNameWithoutExt}Tests.swift`;

        const target = this.pkg.targetForFilePath(sourceFileUrl);
        const targetName = target?.name ?? await this.pkg.targetNameFromFilePath(sourceFileUrl);
        const testTarget = this.pkg.testTargetForTarget(target);

        // Compute relative paths to maintain directory substructure in tests folder
        const fileRelativeDirPath = await this.findRelativeTargetPath(sourceFileUrl);
        if (typeof fileRelativeDirPath !== "string") {
            return {
                originalPath: sourceFileUrl,
                transformedPath: null,
                ...fileRelativeDirPath
            };
        }

        // Transpose relative path to test target
        const testsPath = await this.pkg.availableTestsPath();

        const fullTestFilePath = await this.transposeToTestTarget(
            sourceFileUrl,
            fileRelativeDirPath,
            testsPath,
            testFileName,
            testTarget,
            targetName,
            (original) => `${original}Tests`
        );

        if (!(fullTestFilePath instanceof vscode.Uri)) {
            return {
                originalPath: sourceFileUrl,
                transformedPath: null,
                ...fullTestFilePath
            };
        }

        return {
            originalPath: sourceFileUrl,
            transformedPath: fullTestFilePath,
            diagnostics: [],
        };
    }

    /**
     * From a given test file URL that is contained within a known Swift package
     * target directory, returns a path to a source file that mirrors that test
     * file's name and relative path, but as an absolute path in an associated
     * source target.
     *
     * Returns a `null` transformed path if the file's target could not be deduced.
     */
    async suggestedSourcePathFor(testFileUrl: vscode.Uri): Promise<SourceToTestMapResult> {
        if (!(await this.pkg.isTestFile(testFileUrl))) {
            return {
                originalPath: testFileUrl,
                transformedPath: null,
                diagnostics: [{
                    message: "File is not contained within a recognized Tests/ folder",
                    sourceFile: testFileUrl,
                    kind: TestFileDiagnosticKind.fileNotInTestsFolder,
                }]
            };
        }

        // Compute source file name
        const fileNameWithoutExt = path.basename(testFileUrl.fsPath, ".swift");
        if (!fileNameWithoutExt.endsWith("Tests")) {
            return {
                originalPath: testFileUrl,
                transformedPath: null,
                diagnostics: [{
                    message: "Test file name has unrecognized test file name pattern",
                    sourceFile: testFileUrl,
                    kind: TestFileDiagnosticKind.unrecognizedTestFileNamePattern,
                }]
            };
        }

        const sourceFileName = `${fileNameWithoutExt.slice(0, fileNameWithoutExt.length - "Tests".length)}.swift`;

        const target = this.pkg.targetForFilePath(testFileUrl);
        const targetName = target?.name ?? await this.pkg.targetNameFromFilePath(testFileUrl);
        const sourceTarget = this.pkg.sourceTargetForTestTarget(target);

        // Compute relative paths to maintain directory substructure in sources folder
        const fileRelativeDirPath = await this.findRelativeTargetPath(testFileUrl);
        if (typeof fileRelativeDirPath !== "string") {
            return {
                originalPath: testFileUrl,
                transformedPath: null,
                ...fileRelativeDirPath
            };
        }

        // Transpose relative path to test target
        const sourcesPath = await this.pkg.availableSourcesPath();

        const fullTestFilePath = await this.transposeToSourceTarget(
            testFileUrl,
            fileRelativeDirPath,
            sourcesPath,
            sourceFileName,
            sourceTarget,
            targetName,
            this.testToSourceNameMapper
        );

        if (!(fullTestFilePath instanceof vscode.Uri)) {
            return {
                originalPath: testFileUrl,
                transformedPath: null,
                ...fullTestFilePath
            };
        }

        return {
            originalPath: testFileUrl,
            transformedPath: fullTestFilePath,
            diagnostics: [],
        };
    }

    /**
     * Returns the relative path that a given source file has compared to the
     * root of that source file's target folder.
     *
     * If targets don't have explicit paths, they may be deduced from the directory
     * structure of files.
     *
     * Priority when finding root target path to compute relative paths onto:
     * 1. Target w/ explicit path: Path is the explicit 'path' configuration;
     * 2. Target w/o explicit path: Path is assumed 'Sources/Target' or 'Tests/Target';
     * 3. Deduced target name from path in the form './Sources/Target/File.swift'
     *    or './Tests/Target/File.swift';
     * 4. Make path relative to first existing default sources or tests subfolder;
     * 5. Finally, returns a diagnostic in the form of a `TestFileDiagnosticResult`
     *    if no other option succeeded.
     */
    async findRelativeTargetPath(sourceFileUrl: vscode.Uri): Promise<FallibleOperation<string>> {
        const target = this.pkg.targetForFilePath(sourceFileUrl);
        const targetName = target?.name ?? await this.pkg.targetNameFromFilePath(sourceFileUrl);

        // Compute relative paths to maintain directory substructure in tests folder
        const fileDir = path.dirname(sourceFileUrl.fsPath);

        let sourcesPath: vscode.Uri | null;
        if (await this.pkg.isSourceFile(sourceFileUrl)) {
            sourcesPath = await this.pkg.availableSourcesPath();
        } else {
            sourcesPath = await this.pkg.availableTestsPath();
        }

        // 1. Target w/ explicit path
        if (typeof target?.path === "string") {
            return path.relative(path.join(this.pkg.packageRoot.fsPath, target.path), fileDir);
        }
        
        // 2. Target w/o explicit path: Path is assumed '[Sources|Tests]/Target'
        if (target) {
            const targetPath = await this.pkg.pathForTarget(target);

            return path.relative(targetPath.fsPath, fileDir);
        }
        
        // 3. Deduced target name from path in the form './[Sources|Tests]/Target/File.swift'
        if (typeof targetName === "string") {
            if (sourcesPath === null) {
                return {
                    diagnostics: [{
                        message: "Cannot find folder that contains a source file!",
                        kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                        sourceFile: sourceFileUrl,
                    }]
                };
            }

            const targetPath = vscode.Uri.joinPath(sourcesPath, targetName);

            return path.relative(targetPath.fsPath, fileDir);
        }

        // 4. Make path relative to first existing default sources or target subfolder
        if (sourcesPath) {
            return path.relative(sourcesPath.fsPath, fileDir);
        }
        
        return {
            diagnostics: [{
                message: "Cannot find folder that contains a source file!",
                kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                sourceFile: sourceFileUrl,
            }],
        };
    }

    async transposeToTestTarget(
        fullFileUri: vscode.Uri,
        fileRelativeDirPath: string,
        sourcesRootPath: vscode.Uri | null,
        fileName: string,
        target: SwiftTarget | null,
        targetName: string | null,
        targetNameTransformer: (original: string) => string
    ): Promise<FallibleOperation<vscode.Uri>> {

        // 1. Target w/ explicit path
        if (typeof target?.path === "string") {
            return vscode.Uri.joinPath(this.pkg.packageRoot, target.path, fileRelativeDirPath, fileName);
        }
        
        // 2. Target w/o explicit path: Path is assumed '[Sources|Tests]/Target'
        if (target) {
            const testTargetPath = await this.pkg.pathForTarget(target);

            return vscode.Uri.joinPath(testTargetPath, fileRelativeDirPath, fileName);
        }
        
        // 3. Deduced target name from path in the form './[Sources|Tests]/Target/File.swift'
        if (typeof targetName === "string") {
            if (!sourcesRootPath) {
                return {
                    diagnostics: [{
                        message: "Could not locate tests folder for a file's package",
                        kind: TestFileDiagnosticKind.testsFolderNotFound,
                        sourceFile: fullFileUri,
                    }],
                };
            }

            const finalTargetName = targetNameTransformer(targetName);

            return vscode.Uri.joinPath(
                sourcesRootPath,
                finalTargetName,
                fileRelativeDirPath,
                fileName
            );
        }
        
        // 4. Make path relative to first existing default source subfolder
        if (sourcesRootPath) {
            return vscode.Uri.joinPath(
                sourcesRootPath,
                fileRelativeDirPath,
                fileName
            );
        }
        
        return {
            diagnostics: [{
                message: "Could not locate tests folder for a file's package",
                kind: TestFileDiagnosticKind.testsFolderNotFound,
                sourceFile: fullFileUri,
            }],
        };
    }

    async transposeToSourceTarget(
        fullFileUri: vscode.Uri,
        fileRelativeDirPath: string,
        sourcesRootPath: vscode.Uri | null,
        fileName: string,
        target: SwiftTarget | null,
        targetName: string | null,
        targetNameTransformer: (original: string) => string | null
    ): Promise<FallibleOperation<vscode.Uri>> {

        // 1. Target w/ explicit path
        if (typeof target?.path === "string") {
            return vscode.Uri.joinPath(this.pkg.packageRoot, target.path, fileRelativeDirPath, fileName);
        }
        
        // 2. Target w/o explicit path: Path is assumed '[Sources|Tests]/Target'
        if (target) {
            const sourceTargetPath = await this.pkg.pathForTarget(target);

            return vscode.Uri.joinPath(sourceTargetPath, fileRelativeDirPath, fileName);
        }
        
        // 3. Deduced target name from path in the form './[Sources|Tests]/Target/File.swift'
        if (typeof targetName === "string") {
            const finalTargetName = targetNameTransformer(targetName);

            if (!sourcesRootPath || !finalTargetName) {
                return {
                    diagnostics: [{
                        message: "Could not locate sources folder for a file's package",
                        kind: TestFileDiagnosticKind.sourcesFolderNotFound,
                        sourceFile: fullFileUri,
                    }],
                };
            }

            return vscode.Uri.joinPath(
                sourcesRootPath,
                finalTargetName,
                fileRelativeDirPath,
                fileName
            );
        }
        
        // 4. Make path relative to first existing default source subfolder
        if (sourcesRootPath) {
            return vscode.Uri.joinPath(
                sourcesRootPath,
                fileRelativeDirPath,
                fileName
            );
        }
        
        return {
            diagnostics: [{
                message: "Could not locate sources folder for a file's package",
                kind: TestFileDiagnosticKind.sourcesFolderNotFound,
                sourceFile: fullFileUri,
            }],
        };
    }

    private sourceToTestNameMapper(name: string): string {
        return `${name}Tests`;
    }

    private testToSourceNameMapper(name: string): string | null {
        if (name.endsWith("Tests")) {
            return name.slice(0, name.length - "Tests".length);
        }

        return null;
    }
}
