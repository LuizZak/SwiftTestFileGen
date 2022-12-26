import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftPackageManifestParser } from '../data/swiftPackage';
import { PackageProviderInterface } from "../interfaces/packageProviderInterface";
import { findSwiftPackagePath } from '../swiftPackageFinder';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { SwiftPackagePathsManager } from '../swiftPackagePathsManager';
import { SwiftToolchainInterface } from '../interfaces/swiftToolchainInterface';

/** Provides Swift package manifest by invoking `swift package dump-package` on a file path. */
export class FileDiskPackageProvider implements PackageProviderInterface {
    private packageCachePerDirectory: Map<string, Promise<SwiftPackageManifest>> = new Map();
    private packagePathCachePerDirectory: Map<string, Promise<vscode.Uri | null>> = new Map();

    constructor(public fileSystem: FileSystemInterface, public toolchain: SwiftToolchainInterface) {

    }

    /**
     * Returns a package manifest that `swift package` reports by executing the
     * process within a given file's containing directory.
     */
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        
        const directory = path.dirname(fileUri.path);
        
        const cached = this.packageCachePerDirectory.get(directory);
        if (cached) {
            return cached;
        }

        const promise = this.toolchain.dumpPackage(fileUri, cancellation).then((packageStr) => {
            return SwiftPackageManifestParser.toSwiftPackageManifest(packageStr);
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
