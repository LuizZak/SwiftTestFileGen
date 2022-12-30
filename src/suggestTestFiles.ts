import path = require('path');
import * as vscode from 'vscode';
import { OperationWithDiagnostics, TestFileDiagnosticKind } from './data/testFileDiagnosticResult';
import { SwiftTestFile } from './data/swiftTestFile';
import { Configuration, EmitImportDeclarationsMode } from './data/configurations/configuration';
import { SwiftFileSyntaxHelper } from './syntax/swiftFileSyntaxHelper';
import { InvocationContext } from './interfaces/context';
import { NestableProgress, NestableProgressReportStyle } from './progress/nestableProgress';
import { limitWithParameters } from './asyncUtils/asyncUtils';
import { deduplicateStable } from './algorithms/dedupe';
import { SwiftFileBuilder } from './syntax/swiftFileBuilder';
import { SwiftFile } from './data/swiftFile';
import { SwiftPackagePathsManager } from './swiftPackagePathsManager';
import { SwiftTarget } from './data/swiftPackage';

/** Result object for a `suggestTestFiles` call. */
export type SuggestTestFilesResult = OperationWithDiagnostics<{ testFiles: SwiftTestFile[] }>;

/**
 * Returns a set of suggested test files for a list of .swift file paths.
 * 
 * @param filePaths File paths to generate test files out of.
 * @param configuration The extension configurations object.
 * @param context Context for invocation containing APIs to interact with to
 *     produce the result of this operation.
 * @param progress A progress object to report granular progress to.
 * @param cancellation A cancellation token to stop the operation.
 * @returns A list of Swift test files for the selected files, along with a list
 *     of diagnostics generated.
 */
export async function suggestTestFiles(
    filePaths: vscode.Uri[],
    configuration: Configuration,
    context: InvocationContext,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<SuggestTestFilesResult> {

    const directories = deduplicateStable(filePaths, (filePath) => {
        return path.dirname(filePath.path);
    });

    const filesProgress = progress?.createChild(
        filePaths.length + directories.length,
        undefined,
        "Parsing package manifests..."
    );

    // Warm up the cache prior to the operation by querying the file directories
    // first
    // TODO: Allow parameterization of concurrent task count.
    await limitWithParameters(10, async (directory) => {
        await context.packageProvider.swiftPackagePathManagerForFile(directory, cancellation);
    }, directories, filesProgress, cancellation);

    // Do proper operation now
    if (filesProgress) {
        filesProgress.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;
    }

    filesProgress?.reportMessage("Finding existing test files...");

    const operation = async (filePath: vscode.Uri): Promise<SuggestTestFilesResult> => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        
        const packageProvider = context.packageProvider;
    
        const pkg = await packageProvider.swiftPackagePathManagerForFile(filePath, cancellation);
        const file = await pkg.loadSourceFile(filePath);
        
        // Ignore files that are not within the sources root directory
        if (!await pkg.isSourceFile(file.path)) {
            return {
                testFiles: [],
                diagnostics: [{
                    message: "File is not contained within a recognized Sources/ folder",
                    sourceFile: file.path,
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder
                }]
            };
        }

        // Compute file / test class names
        const fileNameWithoutExt = path.basename(file.path.fsPath, ".swift");
        const testClassName = replaceSpecialCharactersForTestName(`${fileNameWithoutExt}Tests`);
        const testFileName = `${fileNameWithoutExt}Tests.swift`;

        const target = pkg.targetForFilePath(file.path);
        const targetName = target?.name ?? await pkg.targetNameFromFilePath(file.path);
        const testTarget = pkg.testTargetForTarget(target);
        const testsPath = await pkg.availableTestsPath();

        // Compute relative paths to maintain directory substructure in tests folder
        let fileRelativeDirPath: string;
        const fileDir = path.dirname(file.path.fsPath);

        // Priority when finding root target path to compute relative paths onto:
        // 1. Target w/ explicit path
        // 2. Target w/o explicit path: Path is assumed 'Sources/Target'
        // 3. Deduced target name from path in the form './Sources/Target/File.swift'
        // 4. Make path relative to first existing default sources subfolder

        if (typeof target?.path === "string") {
            fileRelativeDirPath = path.relative(path.join(pkg.packageRoot.fsPath, target.path), fileDir);
        } else if (target) {
            const targetPath = await pkg.pathForTarget(target);

            fileRelativeDirPath = path.relative(targetPath.fsPath, fileDir);
        } else if (typeof targetName === "string") {
            const sourcesPath = await pkg.availableSourcesPath();
            if (sourcesPath === null) {
                return {
                    testFiles: [],
                    diagnostics: [{
                        message: "Cannot find folder that contains a source file!",
                        kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                        sourceFile: file.path
                    }]
                };
            }

            const targetPath = vscode.Uri.joinPath(sourcesPath, targetName);

            fileRelativeDirPath = path.relative(targetPath.fsPath, fileDir);
        } else {
            const sourcesPath = await pkg.availableSourcesPath();
            if (sourcesPath === null) {
                return {
                    testFiles: [],
                    diagnostics: [{
                        message: "Cannot find folder that contains a source file!",
                        kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                        sourceFile: file.path
                    }]
                };
            }

            fileRelativeDirPath = path.relative(sourcesPath.fsPath, fileDir);
        }

        // Compute full test file path
        
        // Priority when finding root target path to compute relative paths onto:
        // 1. Test target w/ explicit path
        // 2. Test target w/o explicit path: Path is assumed 'Tests/Target'
        // 3. Deduced test target name from path in the form './Sources/Target/File.swift'
        // 4. Make path relative to first existing default tests subfolder

        let fullTestFilePath: vscode.Uri;
        if (typeof testTarget?.path === "string") {
            fullTestFilePath = vscode.Uri.joinPath(pkg.packageRoot, testTarget.path, fileRelativeDirPath, testFileName);
        } else if (testTarget) {
            const testTargetPath = await pkg.pathForTarget(testTarget);

            fullTestFilePath = vscode.Uri.joinPath(testTargetPath, fileRelativeDirPath, testFileName);
        } else if (typeof targetName === "string") {
            if (!testsPath) {
                return {
                    testFiles: [],
                    diagnostics: [{
                        message: "Could not locate tests folder for a file's package",
                        kind: TestFileDiagnosticKind.testsFolderNotFound,
                        sourceFile: file.path
                    }]
                };
            }

            // Replace <TargetName>/ with <TargetName>Tests/
            let testTargetName = `${targetName}Tests`;

            fullTestFilePath =
                vscode.Uri.joinPath(
                    testsPath,
                    testTargetName,
                    fileRelativeDirPath,
                    testFileName
                );
        } else {
            if (!testsPath) {
                return {
                    testFiles: [],
                    diagnostics: [{
                        message: "Could not locate tests folder for a file's package",
                        kind: TestFileDiagnosticKind.testsFolderNotFound,
                        sourceFile: file.path
                    }]
                };
            }

            fullTestFilePath =
                vscode.Uri.joinPath(
                    testsPath,
                    fileRelativeDirPath,
                    testFileName
                );
        }

        const result = await generateTestFile(
            fullTestFilePath,
            targetName,
            file,
            target,
            testClassName,
            testFileName,
            pkg,
            context,
            configuration
        );

        return {
            testFiles: [result],
            diagnostics: []
        };
    };

    // TODO: Allow parameterization of concurrent task count.
    const result = await limitWithParameters(20, operation, filePaths, filesProgress, cancellation);
    return result.reduce(joinSuggestedTestFileResults);
}

async function generateTestFile(
    fullTestFilePath: vscode.Uri,
    targetName: string | null,
    sourceFile: SwiftFile,
    target: SwiftTarget | null,
    testClassName: string,
    testFileName: string,
    pkg: SwiftPackagePathsManager,
    context: InvocationContext,
    configuration: Configuration
): Promise<SwiftTestFile> {

    const syntaxHelper = new SwiftFileSyntaxHelper(
        sourceFile.path,
        context.fileSystem,
        context.toolchain
    );

    let detectedImports: string[] = [];
    let importLines: string[] = [];

    switch (configuration.fileGen.emitImportDeclarations) {
        case EmitImportDeclarationsMode.always:
            detectedImports = await syntaxHelper.parseModuleImports();
            importLines = detectedImports.map(emitImportLine);

            break;

        case EmitImportDeclarationsMode.dependenciesOnly:
            // From detected module imports, emit the ones that are target
            // dependencies in the package manifest.
            if (target !== null) {
                const dependencyGraph = pkg.dependencyGraph();

                const parsedImports = await syntaxHelper.parseModuleImports();
                detectedImports = parsedImports.filter((moduleName) => {
                    return dependencyGraph.hasDependencyPath(target, moduleName);
                });
                importLines = detectedImports.map(emitImportLine);
            }
            break;

            case EmitImportDeclarationsMode.explicitDependenciesOnly:
                // From detected module imports, emit the ones that are explicit target
                // dependencies in the package manifest.
                if (target !== null) {
                    const dependencyGraph = pkg.dependencyGraph();
    
                    const parsedImports = await syntaxHelper.parseModuleImports();
                    detectedImports = parsedImports.filter((moduleName) => {
                        return dependencyGraph.hasDirectDependency(target, moduleName);
                    });
                    importLines = detectedImports.map(emitImportLine);
                }
                break;

        case EmitImportDeclarationsMode.never:
            break;
    }

    let moduleImportLine: string;
    if (typeof targetName === "string") {
        moduleImportLine = `@testable import ${targetName}`;
    } else {
        moduleImportLine = `@testable import <#TargetName#>`;
    }

    // Build test file contents
    const fb = new SwiftFileBuilder();

    fb.line("import XCTest");
    fb.ensureEmptyLineSeparation();
    fb.line(moduleImportLine);
    fb.lines(...importLines);
    fb.ensureEmptyLineSeparation();
    fb.putEmptyClass(testClassName, ["XCTestCase"]);

    const result: SwiftTestFile = {
        name: testFileName,
        path: fullTestFilePath,
        originalFile: sourceFile.path,
        existsOnDisk: false,
        suggestedImports: detectedImports,
        contents: fb.build()
    };

    return result;
}

function emitImportLine(moduleName: string): string {
    return `import ${moduleName}`;
}

/** Utility function for joining `SuggestTestFilesResult` objects. */
export function joinSuggestedTestFileResults(results1: SuggestTestFilesResult, results2: SuggestTestFilesResult): SuggestTestFilesResult {
    return joinOperationWithDiagnostics(results1, results2, (r1, r2) => {
        return { testFiles: r1.testFiles.concat(r2.testFiles) };
    });
}

/** Utility function for joining `OperationWithDiagnostics` objects. */
export function joinOperationWithDiagnostics<T>(results1: OperationWithDiagnostics<T>, results2: OperationWithDiagnostics<T>, joinRest: (arg0: T, arg1: T) => T): OperationWithDiagnostics<T> {
    const result = joinRest(results1, results2);

    return {
        ...result,
        diagnostics: results1.diagnostics.concat(results2.diagnostics),
    };
}

/** Replaces special characters in file names with an underscore for test class names */
export function replaceSpecialCharactersForTestName(str: string): string {
    return str.replace(/[@\+\-\s,.=]/g, "_");
}
