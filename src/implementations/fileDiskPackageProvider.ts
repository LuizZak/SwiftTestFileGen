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
    private packageCachePerDirectory: Map<string, Promise<SwiftPackageManifest>> = new Map();
    private packagePathCachePerDirectory: Map<string, Promise<vscode.Uri | null>> = new Map();

    constructor(public fileSystem: FileSystemInterface) {

    }

    /**
     * Returns a package manifest that `swift package` reports by executing the
     * process within a given file's containing directory.
     */
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        const directory = path.dirname(fileUri.fsPath);

        const cached = this.packageCachePerDirectory.get(directory);
        if (cached) {
            return cached;
        }

        const promise = new Promise<string>((resolve, reject) => {
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

        this.packageCachePerDirectory.set(directory, promise);

        return promise;
    }

    async swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager> {
        const pkg = await this.swiftPackageManifestForFile(fileUri, cancellation);
        const manifestPath = await this.swiftPackagePath(fileUri, cancellation);

        if (manifestPath === null) {
            throw new Error(`Package for file ${fileUri.fsPath} not found`);
        }

        const pkgRoot = vscode.Uri.joinPath(manifestPath, "..");

        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        
        return new SwiftPackagePathsManager(pkgRoot, pkg, this.fileSystem);
    }

    async swiftPackagePath(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<vscode.Uri | null> {
        const directory = path.dirname(fileUri.fsPath);

        const cached = this.packagePathCachePerDirectory.get(directory);
        if (cached) {
            return cached;
        }

        const promise = findSwiftPackagePath(fileUri, this.fileSystem, undefined, cancellation);

        this.packagePathCachePerDirectory.set(directory, promise);

        return promise;
    }
};
