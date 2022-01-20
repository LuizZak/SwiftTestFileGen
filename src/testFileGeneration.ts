import path = require('path');
import * as vscode from 'vscode';
import { TestFileDiagnosticKind, TestFileDiagnosticResult } from './data/testFileDiagnosticResult';
import { SwiftPackageManifest, SwiftTarget, TargetType } from './data/swiftPackage';
import { SwiftTestFile } from './data/swiftTestFile';
import { isSubdirectory, rootDirectoryOfRelativePath } from './pathUtils';

/**
 * Returns a set of suggested test files for a list of .swift file paths.
 * 
 * @param filePaths File paths to generate test files out of
 * @param packageRoot Path to the root of the Swift package, aka the folder containing its Package.swift.
 * @param pkg An optional package that can be used to derive qualified paths for the test file generation step.
 * @returns A list of Swift test files for the selected files, along with a list of diagnostics generated.
 */
export function suggestTestFiles(filePaths: vscode.Uri[], packageRoot: vscode.Uri, pkg: SwiftPackageManifest): [SwiftTestFile[], TestFileDiagnosticResult[]] {
    // For computing potential test target paths
    // TODO: Delegate this path hardcoding to SwiftPM somehow.
    const sourcesPath = vscode.Uri.joinPath(packageRoot, "Sources");
    const testsPath = vscode.Uri.joinPath(packageRoot, "Tests");

    const targetMap = makeTargetPathMap(packageRoot, pkg);

    let results: SwiftTestFile[] = [];
    let diagnostics: TestFileDiagnosticResult[] = [];
    
    filePaths.forEach(filePath => {
        // Ignore files that are not within the sources root directory
        if (!isSubdirectory(sourcesPath, filePath)) {
            diagnostics.push({
                message: "File is not contained within a recognized Sources/ folder",
                sourceFile: filePath,
                kind: TestFileDiagnosticKind.fileNotInSourcesFolder
            });

            return;
        }

        // Compute file / test class names
        const fileNameWithoutExt = path.basename(filePath.fsPath, ".swift");
        const testClassName = `${fileNameWithoutExt}Tests`;
        const testFileName = `${fileNameWithoutExt}Tests.swift`;

        const target = targetForFilePath(filePath, targetMap);
        const targetName = target?.name ?? targetNameFromFilePath(filePath, sourcesPath);
        const testTarget = testTargetForTarget(target, pkg);

        // Compute relative paths to maintain directory substructure in tests folder
        let fileRelativeDirPath: string;
        const fileDir = path.dirname(filePath.fsPath);
        if (typeof target?.path === "string") {
            fileRelativeDirPath = path.relative(path.join(packageRoot.fsPath, target.path), fileDir);
        } else if(typeof targetName === "string") {
            fileRelativeDirPath = path.relative(path.join(sourcesPath.fsPath, targetName), fileDir);
        } else {
            fileRelativeDirPath = path.relative(sourcesPath.fsPath, fileDir);
        }
        
        // Compute full test file path
        let fullTestFilePath: vscode.Uri;
        if (typeof testTarget?.path === "string") {
            fullTestFilePath = vscode.Uri.joinPath(packageRoot, testTarget.path, fileRelativeDirPath, testFileName);
        } else if (typeof targetName === "string") {
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

        results.push(result);
    });

    return [results, diagnostics];
}

type TargetPathMap = Map<vscode.Uri, SwiftTarget>;

function makeTargetPathMap(packageRoot: vscode.Uri, pkg: SwiftPackageManifest): TargetPathMap {
    let targetPathMap: TargetPathMap = new Map();

    pkg.targets.forEach(target => {
        const path = pathForTarget(packageRoot, target);

        targetPathMap.set(path, target);
    });

    return targetPathMap;
}

function pathForTarget(packageRoot: vscode.Uri, target: SwiftTarget): vscode.Uri {
    if (typeof target.path === "string") {
        return vscode.Uri.joinPath(packageRoot, target.path);
    }

    return vscode.Uri.joinPath(packageRoot, "Sources", target.name);
}

function targetForFilePath(filePath: vscode.Uri, targetMap: TargetPathMap): SwiftTarget | null {
    for (const entry of targetMap.entries()) {
        if (isSubdirectory(entry[0], filePath)) {
            return entry[1];
        }
    }
    
    return null;
}

function targetNameFromFilePath(filePath: vscode.Uri, sourcesRoot: vscode.Uri): string | null {
    const dirName = path.dirname(filePath.fsPath);
    const relativeTargetPath = path.relative(sourcesRoot.fsPath, dirName);

    if (relativeTargetPath.length === 0) {
        return null;
    }

    return rootDirectoryOfRelativePath(relativeTargetPath);
}

function testTargetForTarget(target: SwiftTarget | null, pkg: SwiftPackageManifest): SwiftTarget | null {
    if (target === null) {
        return null;
    }

    for (const t of pkg.targets) {
        // TODO: Allow customizing test target search patterns
        if (t.type === TargetType.Test && t.name === `${target.name}Tests`) {
            return t;
        }
    }

    return null;
}
