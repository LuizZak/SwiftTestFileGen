import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftTarget, TargetType } from './data/swiftPackage';
import { isSubdirectory } from './pathUtils';

const sourcePathDirectoryNames: string[] = [
    "Source",
    "Sources",
];

const testPathDirectoryNames: string[] = [
    "Test",
    "Tests",
];

/**
 * Returns `true` if a given file Uri is contained within the sources path for a given
 * package.
 */
export function isSourceFile(fileUri: vscode.Uri, packageRoot: vscode.Uri, pkg: SwiftPackageManifest): boolean {
    for (const target of pkg.targets) {
        const targetPath = pathForTarget(packageRoot, target);

        if (isSubdirectory(targetPath, fileUri)) {
            switch (target.type) {
                case TargetType.Executable:
                case TargetType.Regular:
                    return true;

                case TargetType.Test:
                    return false;
            }
        }
    }

    // Fallback: Files in known source subdirectories
    for (const dirName of sourcePathDirectoryNames) {
        const sourcesPath = vscode.Uri.joinPath(packageRoot, dirName);

        if (isSubdirectory(sourcesPath, fileUri)) {
            return true;
        }
    }

    return false;
}

/**
 * Returns `true` if a given file Uri is contained within the tests path for a given
 * package.
 */
export function isTestFile(fileUri: vscode.Uri, packageRoot: vscode.Uri, pkg: SwiftPackageManifest): boolean {
    for (const target of pkg.targets) {
        const targetPath = pathForTarget(packageRoot, target);

        if (isSubdirectory(targetPath, fileUri)) {
            switch (target.type) {
                case TargetType.Test:
                    return true;

                case TargetType.Executable:
                case TargetType.Regular:
                    return false;
            }
        }
    }

    // Fallback: Files in known test subdirectories
    for (const dirName of testPathDirectoryNames) {
        const testsPath = vscode.Uri.joinPath(packageRoot, dirName);

        if (isSubdirectory(testsPath, fileUri)) {
            return true;
        }
    }

    return false;
}

function pathForTarget(packageRoot: vscode.Uri, target: SwiftTarget): vscode.Uri {
    if (typeof target.path === "string") {
        return vscode.Uri.joinPath(packageRoot, target.path);
    }

    return vscode.Uri.joinPath(packageRoot, "Sources", target.name);
}
