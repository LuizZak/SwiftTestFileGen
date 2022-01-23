import path = require('path');
import * as vscode from 'vscode';
import { TestFileDiagnosticKind, TestFileDiagnosticResult } from './data/testFileDiagnosticResult';
import { SwiftTestFile } from './data/swiftTestFile';
import { PackageProviderInterface } from './interfaces/packageProviderInterface';

/**
 * Returns a set of suggested test files for a list of .swift file paths.
 * 
 * @param filePaths File paths to generate test files out of
 * @param packageProvider A package provider for computing package for file Uris.
 * @param cancellation A cancellation token to stop the operation.
 * @returns A list of Swift test files for the selected files, along with a list of diagnostics generated.
 */
export async function suggestTestFiles(filePaths: vscode.Uri[], packageProvider: PackageProviderInterface, cancellation?: vscode.CancellationToken): Promise<[SwiftTestFile[], TestFileDiagnosticResult[]]> {
    const operations = filePaths.map(async (filePath): Promise<[SwiftTestFile[], TestFileDiagnosticResult[]]> => {
        const pkg = await packageProvider.swiftPackagePathManagerForFile(filePath, cancellation);

        // Ignore files that are not within the sources root directory
        if (!await pkg.isSourceFile(filePath)) {
            return [[], [{
                message: "File is not contained within a recognized Sources/ folder",
                sourceFile: filePath,
                kind: TestFileDiagnosticKind.fileNotInSourcesFolder
            }]];
        }

        // Compute file / test class names
        const fileNameWithoutExt = path.basename(filePath.fsPath, ".swift");
        const testClassName = `${fileNameWithoutExt}Tests`;
        const testFileName = `${fileNameWithoutExt}Tests.swift`;

        const target = await pkg.targetForFilePath(filePath);
        const targetName = target?.name ?? await pkg.targetNameFromFilePath(filePath);
        const testTarget = pkg.testTargetForTarget(target);
        const testsPath = await pkg.availableTestsPath();

        // Compute relative paths to maintain directory substructure in tests folder
        let fileRelativeDirPath: string;
        const fileDir = path.dirname(filePath.fsPath);
        if (typeof target?.path === "string") {
            fileRelativeDirPath = path.relative(path.join(pkg.packageRoot.fsPath, target.path), fileDir);
        } else if(target) {
            const targetPath = await pkg.pathForTarget(target);

            fileRelativeDirPath = path.relative(targetPath.fsPath, fileDir);
        } else if (typeof targetName === "string") {
            const sourcesPath = await pkg.availableSourcesPath();
            if (sourcesPath === null) {
                return [[], [{
                    message: "Cannot find folder that contains a source file!",
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                    sourceFile: filePath
                }]];
            }
            
            const targetPath = vscode.Uri.joinPath(sourcesPath, targetName);

            fileRelativeDirPath = path.relative(targetPath.fsPath, fileDir);
        } else {
            const sourcesPath = await pkg.availableSourcesPath();
            if (sourcesPath === null) {
                return [[], [{
                    message: "Cannot find folder that contains a source file!",
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder,
                    sourceFile: filePath
                }]];
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
                return [[], [{
                    message: "Could not locate tests folder for a file's package",
                    kind: TestFileDiagnosticKind.testsFolderNotFound,
                    sourceFile: filePath
                }]];
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
                return [[], [{
                    message: "Could not locate tests folder for a file's package",
                    kind: TestFileDiagnosticKind.testsFolderNotFound,
                    sourceFile: filePath
                }]];
            }
            
            fullTestFilePath =
                vscode.Uri.joinPath(
                    testsPath,
                    fileRelativeDirPath,
                    testFileName
                );
        }

        let importLine: string;
        if (typeof targetName === "string") {
            importLine = `@testable import ${targetName}`;
        } else {
            importLine = `@testable import <#TargetName#>`;
        }

        const result: SwiftTestFile = {
            name: testFileName,
            path: fullTestFilePath,
            originalFile: filePath,
            contents: 
`import XCTest

${importLine}

class ${testClassName}: XCTestCase {

}
`
        };

        return [[result], []];
    });

    return (await Promise.all(operations)).reduce((prev, next) => {
        return [prev[0].concat(next[0]), prev[1].concat(next[1])];
    });
}
