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
    constructor(public fileSystem: FileSystemInterface, public toolchain: SwiftToolchainInterface) {
    }

    /**
     * Returns a package manifest that `swift package` reports by executing the
     * process within a given file's containing directory.
     */
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        const packageStr = await this.toolchain.dumpPackage(fileUri, cancellation);

        return SwiftPackageManifestParser.toSwiftPackageManifest(packageStr);
    }

    async swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager> {
        const pkg = await this.swiftPackageManifestForFile(fileUri, cancellation);
        const manifestPath = await findSwiftPackagePath(fileUri, this.fileSystem);

        if (manifestPath === null) {
            throw new Error(`Package for file ${fileUri.fsPath} not found`);
        }

        const pkgRoot = vscode.Uri.joinPath(manifestPath, "..");

        return new SwiftPackagePathsManager(pkgRoot, pkg, this.fileSystem);
    }
};
