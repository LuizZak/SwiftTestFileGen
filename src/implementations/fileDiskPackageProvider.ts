import path = require('path');
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { SwiftPackageManifest, SwiftPackageManifestParser } from '../data/swiftPackage';
import { PackageProviderInterface } from "../interfaces/packageProviderInterface";
import { findSwiftPackagePath } from '../swiftPackageFinder';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { SwiftPackagePathsManager } from '../swiftPackagePathsManager';

/** Provides Swift package manifest by invoking `swift package dump-package` on a file path. */
export class FileDiskPackageProvider implements PackageProviderInterface {
    constructor(public fileSystem: FileSystemInterface) {
    }

    /**
     * Returns a package manifest that `swift package` reports by executing the
     * process within a given file's containing directory.
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
                reject(new vscode.CancellationError());

                childProc.kill();
            });
        }).then((response) => {
            return SwiftPackageManifestParser.toSwiftPackageManifest(response);
        });
    }

    async swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager> {
        const pkg = await this.swiftPackageManifestForFile(fileUri, cancellation);
        const manifestPath = await findSwiftPackagePath(fileUri, this.fileSystem);

        if (manifestPath === null) {
            throw new Error(`Package for file ${fileUri.fsPath} not found`);
        }

        const pkgRoot = this.fileSystem.joinPathUri(manifestPath, "..");

        return new SwiftPackagePathsManager(pkgRoot, pkg, this.fileSystem);
    }
};
