import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftTarget, TargetType } from './data/swiftPackage';
import { predefinedSourceSearchPaths, predefinedTestSearchPaths } from './definitions';
import { FileSystemInterface } from './interfaces/fileSystemInterface';
import { isSubdirectory } from './pathUtils';

/** Map of target path Uri -> target, to perform directory-based lookups. */
export type TargetPathMap = Map<vscode.Uri, SwiftTarget>;

/**
 * Class used to query for target <-> file containment for a particular package
 * manifest on the file system.
 */
export class SwiftPackagePathsManager {
    targetPathMap: Promise<TargetPathMap>;

    constructor(public packageRoot: vscode.Uri, public pkg: SwiftPackageManifest, public fileSystem: FileSystemInterface) {
        this.targetPathMap = this.makeTargetPathMap();
    }

    private async _targetPathMap(): Promise<TargetPathMap> {
        return await this.targetPathMap;
    }

    /**
     * Returns the first available Sources root folder recognizable by Swift PM
     * for the current package.
     * 
     * Returns `null` in case no actual recognized sources directory exists.
     * 
     * A `null` sources directory does not indicate non-existing sources: Targets
     * may configure their own custom paths that do not follow SwiftPM's automatic
     * naming conventions.
     */
    async availableSourcesPath(): Promise<vscode.Uri | null> {
        // TODO: Cache this operation?
        for (const path of predefinedSourceSearchPaths) {
            const fullPath = this.fileSystem.joinPathUri(this.packageRoot, path);

            if (await this.fileSystem.isDirectoryUri(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * Returns the first available Tests root folder recognizable by Swift PM
     * for the current package.
     * 
     * Returns `null` in case no actual recognized tests directory exists.
     * 
     * A `null` tests directory does not indicate non-existing tests: Targets
     * may configure their own custom paths that do not follow SwiftPM's automatic
     * naming conventions.
     */
    async availableTestsPath(): Promise<vscode.Uri | null> {
        // TODO: Cache this operation?
        for (const path of predefinedTestSearchPaths) {
            const fullPath = this.fileSystem.joinPathUri(this.packageRoot, path);

            if (await this.fileSystem.isDirectoryUri(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * Returns `true` if a given file Uri is contained within the sources path
     * for a given package.
     * 
     * Returns `false` for files in test targets.
     */
    async isSourceFile(fileUri: vscode.Uri): Promise<boolean> {
        for (const [targetPath, target] of await this._targetPathMap()) {
            if (await this.fileSystem.isDirectoryUri(targetPath) && isSubdirectory(targetPath, fileUri)) {
                switch (target.type) {
                    case TargetType.Executable:
                    case TargetType.Regular:
                        return true;

                    case TargetType.Test:
                        return false;
                }
            }
        }

        // Fallback: Files in known source subdirectories
        for (const dirName of predefinedSourceSearchPaths) {
            const sourcesPath = vscode.Uri.joinPath(this.packageRoot, dirName);

            if (await this.fileSystem.isDirectoryUri(sourcesPath) && isSubdirectory(sourcesPath, fileUri)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns `true` if a given file Uri is contained within the tests path for a
     * given package.
     */
    async isTestFile(fileUri: vscode.Uri): Promise<boolean> {
        for (const [targetPath, target] of await this._targetPathMap()) {
            if (await this.fileSystem.isDirectoryUri(targetPath) && isSubdirectory(targetPath, fileUri)) {
                switch (target.type) {
                    case TargetType.Test:
                        return true;

                    case TargetType.Executable:
                    case TargetType.Regular:
                        return false;
                }
            }
        }

        // Fallback: Files in known test subdirectories
        for (const dirName of predefinedTestSearchPaths) {
            const testsPath = vscode.Uri.joinPath(this.packageRoot, dirName);

            if (await this.fileSystem.isDirectoryUri(testsPath) && isSubdirectory(testsPath, fileUri)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns the path for the given target, looking at either the configured path
     * setting of the target, or by deriving the path from the first predefined source
     * search path, in case no custom path has been provided in the manifest.
     */
    async pathForTarget(target: SwiftTarget): Promise<vscode.Uri> {
        for (const [targetPath, t] of await this._targetPathMap()) {
            if (target.name === t.name) {
                return targetPath;
            }
        }

        return await _computePathForTarget(target, this.packageRoot, this.fileSystem);
    }

    /**
     * Returns the target that contains a given file, or `null`, if no matching
     * target folder was found.
     */
    async targetForFilePath(filePath: vscode.Uri): Promise<SwiftTarget | null> {
        for (const entry of (await this._targetPathMap()).entries()) {
            if (isSubdirectory(entry[0], filePath)) {
                return entry[1];
            }
        }
        
        return null;
    }

    /**
     * Returns a `TargetPathMap` for a given package, rooted on a given base path.
     */
    async makeTargetPathMap(): Promise<TargetPathMap> {
        let pairs: [vscode.Uri, SwiftTarget][] = await Promise.all(this.pkg.targets.map(async target => {
            return [await _computePathForTarget(target, this.packageRoot, this.fileSystem), target];
        }));
        
        let targetPathMap: TargetPathMap = new Map();

        pairs.forEach(pair => {
            targetPathMap.set(pair[0], pair[1]);
        });

        return targetPathMap;
    }

    /**
     * Returns the name of the target, based on an input file path and known
     * source and target roots.
     * 
     * If no target is found that contains the given file path, effectively
     * returns the name of the base folder of `filePath` relative to the sources
     * root.
     */
    async targetNameFromFilePath(filePath: vscode.Uri): Promise<string | null> {
        for (const [targetUri, target] of await this.targetPathMap) {
            if (isSubdirectory(targetUri, filePath)) {
                return target.name;
            }
        }

        const candidates: string[] = [];
        for (const sourcePath of predefinedSourceSearchPaths) {
            const targetPath = vscode.Uri.joinPath(this.packageRoot, sourcePath);
            if (!isSubdirectory(targetPath, filePath)) {
                continue;
            }
            const relative = path.relative(targetPath.fsPath, filePath.fsPath);
            const dirName = path.dirname(relative).split(path.sep);
            
            if (dirName.length > 0 && dirName[0] !== ".") {
                const exists = await this.fileSystem.isDirectoryUri(targetPath);
                if (exists) {
                    return dirName[0];
                }

                candidates.push(dirName[0]);
            }
        }

        return candidates[0] ?? null;
    }

    /**
     * Returns a potential test target for a given input target, or `null` if `target`
     * is `null` or if no potential test target was found.
     */
    testTargetForTarget(target: SwiftTarget | null): SwiftTarget | null {
        if (target === null) {
            return null;
        }

        for (const t of this.pkg.targets) {
            // TODO: Allow customizing test target search patterns
            if (t.type === TargetType.Test && t.name === `${target.name}Tests`) {
                return t;
            }
        }
        
        return null;
    }
};

/**
 * Returns the path for the given target, looking at either the configured path
 * setting of the target, or by deriving the path from the first predefined source
 * search path that is found on disk, in case no custom path has been provided in
 * the manifest.
 * 
 * At the last case, the first predefined sources path is used, instead.
 */
async function _computePathForTarget(target: SwiftTarget, packageRoot: vscode.Uri, fileSystem: FileSystemInterface): Promise<vscode.Uri> {
    if (typeof target.path === "string") {
        return vscode.Uri.joinPath(packageRoot, target.path);
    }

    let pathsToSearch: string[];
    switch (target.type) {
    case TargetType.Executable:
    case TargetType.Regular:
    case TargetType.Plugin:
    case TargetType.System:
    case TargetType.Snippet:
    case TargetType.Binary:
        pathsToSearch = predefinedSourceSearchPaths;
        break;

    case TargetType.Test:
        pathsToSearch = predefinedTestSearchPaths;
        break;
    }

    for (const path of pathsToSearch) {
        const fullPath = vscode.Uri.joinPath(packageRoot, path, target.name);

        if (await fileSystem.isDirectoryUri(fullPath)) {
            return fullPath;
        }
    }

    return vscode.Uri.joinPath(packageRoot, pathsToSearch[0], target.name);
}
