import path = require('path');
import * as vscode from 'vscode';
import { OperationWithDiagnostics, TestFileDiagnosticKind } from './data/testFileDiagnosticResult';
import { SwiftTestFile } from './data/swiftTestFile';
import { PackageProviderInterface } from './interfaces/packageProviderInterface';
import { SwiftFile } from './data/swiftFile';
import { targetDependenciesByName } from './data/swiftPackage.ext';
import { Configuration, EmitImportDeclarationsMode } from './data/configurations/configuration';

/** Result object for a `suggestTestFiles` call. */
export type SuggestTestFilesResult = OperationWithDiagnostics<{ testFiles: SwiftTestFile[] }>;

/**
 * Returns a set of suggested test files for a list of .swift file paths.
 * 
 * @param files File paths to generate test files out of
 * @param configuration The extension configurations object.
 * @param packageProvider A package provider for computing package for file Uris.
 * @param cancellation A cancellation token to stop the operation.
 * @returns A list of Swift test files for the selected files, along with a list of diagnostics generated.
 */
export async function suggestTestFiles(
    files: SwiftFile[],
    configuration: Configuration,
    packageProvider: PackageProviderInterface,
    cancellation?: vscode.CancellationToken
): Promise<SuggestTestFilesResult> {

    const operations = files.map(async (file): Promise<SuggestTestFilesResult> => {
        const pkg = await packageProvider.swiftPackagePathManagerForFile(file.path, cancellation);

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

        const target = await pkg.targetForFilePath(file.path);
        const targetName = target?.name ?? await pkg.targetNameFromFilePath(file.path);
        const testTarget = pkg.testTargetForTarget(target);
        const testsPath = await pkg.availableTestsPath();

        // Compute relative paths to maintain directory substructure in tests folder
        let fileRelativeDirPath: string;
        const fileDir = path.dirname(file.path.fsPath);
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

        let importLines: string[] = [];
        if (typeof targetName === "string") {
            importLines.push(`@testable import ${targetName}`);
        } else {
            importLines.push(`@testable import <#TargetName#>`);
        }

        let detectedImports = detectModuleImports(file.contents);

        switch (configuration.fileGen.emitImportDeclarations) {
            case EmitImportDeclarationsMode.always:
                detectedImports.forEach((moduleName) => {
                    importLines.push(emitImportLine(moduleName));
                });
                break;

            case EmitImportDeclarationsMode.explicitDependenciesOnly:
                // From detected module imports, emit the ones that are explicit target
                // dependencies in the package manifest.
                if (target !== null) {
                    const dependencyGraph = pkg.dependencyGraph();

                    detectedImports.forEach((moduleName) => {
                        if (dependencyGraph.hasDependencyPath(target, moduleName)) {
                            importLines.push(emitImportLine(moduleName));
                        }
                    });
                }
                break;
            
            case EmitImportDeclarationsMode.never:
                break;
        }

        const result: SwiftTestFile = {
            name: testFileName,
            path: fullTestFilePath,
            originalFile: file.path,
            existsOnDisk: false,
            suggestedImports: detectedImports,
            contents:
                `import XCTest

${importLines.join("\n")}

class ${testClassName}: XCTestCase {

}
`
        };

        return {
            testFiles: [result],
            diagnostics: []
        };
    });

    return (await Promise.all(operations)).reduce(joinSuggestedTestFileResults);
}

/**
 * From a given Swift source file's contents, detects imported modules that may
 * be required to be imported in the test file.
 */
function detectModuleImports(swiftFileContents: string): string[] {
    let result: ({ module: string, offset: number })[] = [];

    const moduleImport = /import\s+((?:\w+\.?)+)\s*(;|\n)/g;
    const symbolImport = /import\s+(?:typealias|struct|class|enum|protocol|let|var|func)\s+((?:\w+\.?))+(?:\.\w+)\s*(;|\n)/g;

    for (const match of swiftFileContents.matchAll(moduleImport)) {
        result.push({
            module: match[1],
            offset: match.index ?? 0
        });
    }
    for (const match of swiftFileContents.matchAll(symbolImport)) {
        result.push({
            module: match[1],
            offset: match.index ?? 0
        });
    }

    return result.sort((a, b) => a.offset - b.offset).map((v) => v.module);
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
