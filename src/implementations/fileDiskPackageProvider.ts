import path = require('path');
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { SwiftPackageManifest, SwiftPackageManifestParser } from '../data/swiftPackage';
import { PackageProviderInterface } from "../interfaces/packageProviderInterface";

/** Provides Swift package manifest by invoking `swift package dump-package` on a file path. */
export class FileDiskPackageProvider implements PackageProviderInterface {
    /**
     * Returns a package manifest that `swift package` reports by executing the process within a given file's containing directory.
     */
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        const directory = path.dirname(fileUri.fsPath);

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
};
