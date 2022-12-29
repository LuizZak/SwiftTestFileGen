import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftPackageManifestParser } from '../data/swiftPackage';
import { PackageProviderInterface } from "../interfaces/packageProviderInterface";
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { SwiftPackagePathsManager } from '../swiftPackagePathsManager';
import { SwiftToolchainInterface } from '../interfaces/swiftToolchainInterface';
import { isSubdirectory } from '../pathUtils';
import * as definitions from '../definitions';

/** Provides Swift package manifest by invoking `swift package dump-package` on a file path. */
export class FileDiskPackageProvider implements PackageProviderInterface {
    private packageCachePerDirectory: Map<string, Promise<SwiftPackageManifest>> = new Map();
    private packagePathCachePerDirectory: Map<string, Promise<vscode.Uri | null>> = new Map();
    private packagePathsPerManifestFile: Map<string, Promise<vscode.Uri[]>> = new Map();

    private packageManagerCache: Map<string, SwiftPackagePathsManager> = new Map();

    constructor(public fileSystem: FileSystemInterface, public toolchain: SwiftToolchainInterface) {

    }

    async swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager> {
        const manifestPath = await this.swiftPackageManifestPathForFile(fileUri, cancellation);
        
        if (manifestPath === null) {
            throw new Error(`Package for file ${fileUri.fsPath} not found`);
        }

        const pkg = await this.swiftPackageManifestForFile(manifestPath, cancellation);

        const pkgRoot = vscode.Uri.joinPath(manifestPath, "..");

        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        const pkgRootPath = pkgRoot.path;
        const cached = this.packageManagerCache.get(pkgRootPath);
        if (cached) {
            return cached;
        }
        
        const manager = await SwiftPackagePathsManager.create(pkgRoot, manifestPath, pkg, this.fileSystem);

        this.packageManagerCache.set(pkgRootPath, manager);

        return manager;
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

    async swiftPackageManifestPathForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken | undefined): Promise<vscode.Uri | null> {
        const directory = path.dirname(fileUri.fsPath);

        const cached = this.packagePathCachePerDirectory.get(directory);
        if (cached) {
            return cached;
        }

        const promise = this.swiftPackagePathUncached(fileUri, undefined, cancellation);

        this.packagePathCachePerDirectory.set(directory, promise);

        return promise;
    }

    /**
    * Returns a Uri for a Package.swift that contains a given file path, or `null`,
    * if no Package.swift exists within the file path's hierarchy.
    * 
    * @param packageManifestFile A file name for the package manifest to find, or
    * `undefined`, in which case defaults to `defaultPackageManifestFileName`.
    */
    private async swiftPackagePathUncached(
        filePath: vscode.Uri,
        packageManifestFile?: string,
        cancellation?: vscode.CancellationToken
    ): Promise<vscode.Uri | null> {

        packageManifestFile = packageManifestFile ?? definitions.defaultPackageManifestFileName;

        const packages = await this.swiftPackagePaths(packageManifestFile, cancellation);

        if (packages.length > 0) {
            for (const pkgUri of packages) {
                const packageFolder = vscode.Uri.joinPath(pkgUri, "..");

                if (isSubdirectory(filePath, packageFolder)) {
                    return pkgUri;
                }
            }
        }
        
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        // Fallback to recursive search up the file tree
        let currentDirectory = path.dirname(filePath.fsPath);

        while (path.dirname(currentDirectory) !== currentDirectory) {
            if (cancellation?.isCancellationRequested) {
                throw new vscode.CancellationError();
            }

            let packagePath = vscode.Uri.file(path.join(currentDirectory, packageManifestFile));

            if (await this.fileSystem.fileExists(packagePath)) {
                return packagePath;
            }

            currentDirectory = path.dirname(currentDirectory);
        }

        return null;
    }

    /**
     * Returns a list of all package manifests matching a specified package
     * manifest file name in the currently active workspace environment.
     */
    private async swiftPackagePaths(
        packageManifestFile: string,
        cancellation?: vscode.CancellationToken
    ): Promise<vscode.Uri[]> {

        const cached = this.packagePathsPerManifestFile.get(packageManifestFile);
        if (cached) {
            return cached;
        }

        const promise = this.swiftPackagePathsUncached(
            packageManifestFile,
            cancellation
        );

        this.packagePathsPerManifestFile.set(packageManifestFile, promise);

        return promise;
    }

    /**
     * Returns a list of all package manifests matching a specified package
     * manifest file name in the currently active workspace environment.
     */
    private async swiftPackagePathsUncached(
        packageManifestFile: string,
        cancellation?: vscode.CancellationToken
    ): Promise<vscode.Uri[]> {

        return await this.fileSystem.findFiles(
            `**/${packageManifestFile}`,
            undefined,
            undefined,
            cancellation
        );
    }
};
