import path = require('path');
import * as vscode from 'vscode';
import { isSubdirectory } from './pathUtils';
import { FileSystemInterface } from './interfaces/fileSystemInterface';
import { mappedGroupBy } from './groupBy';

/**
 * The default package manifest file name: `Package.swift`.
 */
export const defaultPackageManifestFileName = "Package.swift";

/**
 * Returns a Uri for a Package.swift that contains a given file path, or `null`, if no Package.swift exists within the file path's hierarchy.
 * 
 * @param packageManifestFile A file name for the package manifest to find, or `undefined`, in which case defaults to `defaultPackageManifestFileName`.
*/
export async function findSwiftPackagePath(filePath: vscode.Uri, fileSystem: FileSystemInterface, packageManifestFile?: string, cancellation?: vscode.CancellationToken): Promise<vscode.Uri | null> {
    packageManifestFile = packageManifestFile ?? defaultPackageManifestFileName;

    // TODO: Abstract this check away so we can test this method properly.
    const packages = await fileSystem.findFiles(`**/${packageManifestFile}`, undefined, undefined, cancellation);
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

    // Fallback to recursive search up the file tree
    let currentDirectory = path.dirname(filePath.fsPath);

    while (path.dirname(currentDirectory) !== currentDirectory) {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        let packagePath = vscode.Uri.file(path.join(currentDirectory, packageManifestFile));

        if(await fileSystem.fileExists(packagePath)) {
            return packagePath;
        }

        currentDirectory = path.dirname(currentDirectory);
    }

    return null;
}

/**
 * Finds all Package.swift manifest files within all workspace folders.
 * 
 * @param packageManifestFile A file name for the package manifest to find, or `undefined`, in which case defaults to `defaultPackageManifestFileName`.
*/
export async function findAllSwiftPackages(fileSystem: FileSystemInterface, packageManifestFile?: string, cancellation?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    packageManifestFile = packageManifestFile ?? defaultPackageManifestFileName;

    return await fileSystem.findFiles(`**/${packageManifestFile}`, undefined, undefined, cancellation);
}

/**
 * From a set of file or directory Uris, find all Package.swift manifests that contain the file, by invoking a `swift package` command on its location, returning a map of
 * which files belong to which Package.swift manifests.
 * 
 * A separate list of values is used to indicate files that could not be pinned to a package manifest.
 */
export async function mapPathsToSwiftPackages(fileUris: vscode.Uri[], fileSystem: FileSystemInterface, cancellation?: vscode.CancellationToken): Promise<[packageMap: Map<vscode.Uri, vscode.Uri[]>, notInPackage: vscode.Uri[]]> {
    const packagePathPairs = await Promise.all(fileUris.map(async (fileUri): Promise<[vscode.Uri | null, vscode.Uri]> => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        return [await findSwiftPackagePath(fileUri, fileSystem), fileUri];
    }));

   const packageMap = new Map<vscode.Uri, vscode.Uri[]>();
   const nonPackage: vscode.Uri[] = [];

   for (const packagePathPair of packagePathPairs) {
        const packagePath = packagePathPair[0];
        const filePath = packagePathPair[1];
        if (packagePath === null) {
            nonPackage.push(filePath);
            continue;
        }

        const existing = packageMap.get(filePath);
        if (!existing) {
            packageMap.set(packagePath, [filePath]);
        } else {
            existing.push(filePath);
        }
    }

    return [packageMap, nonPackage];
}
