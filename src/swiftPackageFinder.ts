import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftPackageManifestParser } from './data/swiftPackage';
import { exec } from 'child_process';
import { isSubdirectory } from './pathUtils';

/**
 * The default package manifest file name: `Package.swift`.
 */
export const defaultPackageManifestFileName = "Package.swift";

/**
 * Returns a Uri for a Package.swift that contains a given file path, or `null`, if no Package.swift exists within the file path's hierarchy.
 * 
 * @param packageManifestFile A file name for the package manifest to find, or `null`, in which case defaults to `defaultPackageManifestFileName`.
*/
export async function findSwiftPackage(filePath: vscode.Uri, packageManifestFile: string | null = null, cancellation: vscode.CancellationToken | undefined = undefined): Promise<vscode.Uri | null> {
    packageManifestFile = packageManifestFile ?? defaultPackageManifestFileName;

    if (vscode.workspace.workspaceFolders !== undefined) {
        const packages = await vscode.workspace.findFiles(`**/${packageManifestFile}`, undefined, undefined, cancellation);

        if (packages.length > 0) {
            for (const pkgUri of packages) {
                if (cancellation?.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }

                const packageFolder = vscode.Uri.joinPath(pkgUri, "..");

                if (isSubdirectory(filePath, packageFolder)) {
                    return pkgUri;
                }
            }
        }
    }

    // Fallback to recursive search up the file tree
    let currentDirectory = path.dirname(filePath.fsPath);

    while (path.dirname(currentDirectory) !== currentDirectory) {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        let packagePath = vscode.Uri.file(path.join(currentDirectory, packageManifestFile));

        try {
            await vscode.workspace.fs.stat(packagePath);

            return packagePath;
        } catch {

        }

        currentDirectory = path.dirname(currentDirectory);
    }

    return null;
}

/**
 * Finds all Package.swift manifest files within all workspace folders.
 * 
 * @param packageManifestFile A file name for the package manifest to find, or `null`, in which case defaults to `defaultPackageManifestFileName`.
*/
export async function findAllSwiftPackages(packageManifestFile: string | null = null, cancellation: vscode.CancellationToken | undefined = undefined): Promise<vscode.Uri[]> {
    packageManifestFile = packageManifestFile ?? defaultPackageManifestFileName;

    return await vscode.workspace.findFiles(`**/${packageManifestFile}`, undefined, undefined, cancellation);
}

/**
 * Returns a package manifest that `swift package` reports by executing the process within a given file's containing directory.
 */
export async function swiftPackageManifestForFile(manifestFile: vscode.Uri, cancellation: vscode.CancellationToken | undefined = undefined): Promise<SwiftPackageManifest> {
    const directory = path.dirname(manifestFile.fsPath);

    return new Promise<string>((resolve, reject) => {
        const childProc = exec("swift package dump-package", { cwd: directory }, function (err, stdout, stderr) {
            if (err !== null) {
                throw err;
            }
            if (stderr !== '') {
                reject(stderr);
            }

            resolve(stdout.trim());
        });

        cancellation?.onCancellationRequested(() => {
            childProc.kill();

            reject(new vscode.CancellationError());
        });
    }).then((response) => {
        return SwiftPackageManifestParser.toSwiftPackageManifest(response);
    });
}
