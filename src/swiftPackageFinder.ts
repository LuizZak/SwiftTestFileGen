import path = require('path');
import * as vscode from 'vscode';
import { NestableProgress, NestableProgressReportStyle } from './progress/nestableProgress';
import { limitWithParameters } from './asyncUtils/asyncUtils';
import { PackageProviderInterface } from './interfaces/packageProviderInterface';

/**
 * From a set of file or directory Uris, find all Package.swift manifests that
 * contain the file, by invoking a `swift package` command on its location,
 * returning a map of which files belong to which Package.swift manifests.
 * 
 * A separate list of values is used to indicate files that could not be pinned
 * to a package manifest.
 */
export async function mapPathsToSwiftPackages(
    fileUris: vscode.Uri[],
    packageProvier: PackageProviderInterface,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<[packageMap: Map<string, vscode.Uri[]>, notInPackage: vscode.Uri[]]> {

    const generator = (fileUri: vscode.Uri): Promise<[vscode.Uri | null, vscode.Uri]> => {
        return packageProvier.swiftPackageManifestPathForFile(fileUri, cancellation)
            .then((result) => [result, fileUri]);
    };

    const childProgress = progress?.createChild(fileUris.length, undefined, "Mapping files to Swift packages...");
    if (childProgress) {
        childProgress.showProgressInMessageStyle = NestableProgressReportStyle.asUnits;
    }

    const packagePathPairs = await limitWithParameters(
        20,
        generator,
        fileUris,
        childProgress,
        cancellation
    );

    const packageMap = new Map<string, vscode.Uri[]>();
    const nonPackage: vscode.Uri[] = [];

    for (const packagePathPair of packagePathPairs) {
        const packagePath = packagePathPair[0];
        const filePath = packagePathPair[1];
        if (packagePath === null) {
            nonPackage.push(filePath);
            continue;
        }

        const existing = packageMap.get(packagePath.path);
        if (!existing) {
            packageMap.set(packagePath.path, [filePath]);
        } else {
            existing.push(filePath);
        }
    }

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    return [packageMap, nonPackage];
}
