import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftPackageManifestParser } from './data/swiftPackage';
import { exec } from 'child_process';
import { isSubdirectory } from './pathUtils';

/** Returns a Uri for a Package.swift that contains a given file path, or `null`, if no Package.swift exists within the file path's hierarchy. */
export async function findSwiftPackage(filePath: vscode.Uri, packageManifestFile: string = "Package.swift"): Promise<vscode.Uri | null> {
    if (vscode.workspace.workspaceFolders !== undefined) {
        const packages = await vscode.workspace.findFiles("**/Package.swift");
        
        if (packages.length > 0) {
            for (const pkgUri of packages) {
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

export async function swiftPackageManifestForFile(manifestFile: vscode.Uri): Promise<SwiftPackageManifest> {
    const directory = path.dirname(manifestFile.fsPath);

    return new Promise<string>((resolve, reject) => {
        exec("swift package dump-package", {cwd: directory}, function (err, stdout, stderr) {
            if (err !== null) {
                throw err;
            }
            if (stderr !== '') {
                reject();
            }
            
            resolve(stdout.trim());
        });
    }).then((response) => {
        return SwiftPackageManifestParser.toSwiftPackageManifest(response);
    });
}
