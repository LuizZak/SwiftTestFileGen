import path = require('path');
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { F_OK } from 'constants';
import { SwiftPackageManifest, SwiftPackageManifestParser } from './data/swiftPackage';
import { exec } from 'child_process';

export async function findSwiftPackage(filePath: vscode.Uri, packageManifestFile: string = "Package.swift"): Promise<vscode.Uri | null> {
    let currentDirectory = path.dirname(filePath.fsPath);

    // Perform a recursive search up the file tree
    while (path.dirname(currentDirectory) !== currentDirectory) {
        let packagePath = path.join(currentDirectory, packageManifestFile);
        
        try {
            await fs.access(packagePath, F_OK);

            return vscode.Uri.file(packagePath);
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
