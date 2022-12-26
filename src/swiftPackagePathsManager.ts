import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftTarget, TargetType } from './data/swiftPackage';
import { predefinedSourceSearchPaths, predefinedTestSearchPaths } from './definitions';
import { FileSystemInterface } from './interfaces/fileSystemInterface';
import { isSubdirectory } from './pathUtils';

/**a
 * List of SwiftTargets with pre-computed directory information for quick
 * directory-based lookups.
 */
type TargetPathList = InternalSwiftTarget[];

interface InternalSwiftTarget extends SwiftTarget {
    /**
     * Whether the path associated with this `InternalSwiftTarget` is a directory
     * in the file system.
     */
    hasDirectoryPath: boolean;

    /**
     * A fully computed path for this target that exists on disk.
     */
    computedPath: vscode.Uri;
};

/**
 * Class used to query for target <-> file containment for a particular package
 * manifest on the file system.
 */
export class SwiftPackagePathsManager {
    targetPathList: TargetPathList;

    /** Cached result for last query of `this.availableSourcesPath()` */
    private _sourcesPath?: vscode.Uri | null;

    /** Cached result for last query of `this.availableTestsPath()` */
    private _testsPath?: vscode.Uri | null;

    private constructor(
        public packageRoot: vscode.Uri,
        public pkg: SwiftPackageManifest,
        public fileSystem: FileSystemInterface,
        targetPathList: TargetPathList
    ) {

        this.targetPathList = targetPathList;
    }

    public static async create(
        packageRoot: vscode.Uri,
        pkg: SwiftPackageManifest,
        fileSystem: FileSystemInterface
    ): Promise<SwiftPackagePathsManager> {

        const targetPathList = await this.makeTargetPathMap(packageRoot, pkg, fileSystem);

        return new SwiftPackagePathsManager(packageRoot, pkg, fileSystem, targetPathList);
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
        if (this._sourcesPath !== undefined) {
            return this._sourcesPath;
        }

        for (const path of predefinedSourceSearchPaths) {
            const fullPath = vscode.Uri.joinPath(this.packageRoot, path);

            if (await this.fileSystem.isDirectoryUri(fullPath)) {
                this._sourcesPath = fullPath;
                return fullPath;
            }
        }

        this._sourcesPath = null;
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
        if (this._testsPath !== undefined) {
            return this._testsPath;
        }

        for (const path of predefinedTestSearchPaths) {
            const fullPath = vscode.Uri.joinPath(this.packageRoot, path);

            if (await this.fileSystem.isDirectoryUri(fullPath)) {
                this._testsPath = fullPath;
                return fullPath;
            }
        }

        this._testsPath = null;
        return null;
    }

    /**
     * Returns `true` if a given file Uri is contained within the sources path
     * for a given package.
     * 
     * Returns `false` for files in test targets.
     */
    async isSourceFile(fileUri: vscode.Uri): Promise<boolean> {
        for (const target of this.targetPathList) {
            if (target.hasDirectoryPath && isSubdirectory(target.computedPath, fileUri)) {
                switch (target.type) {
                    case TargetType.Executable:
                    case TargetType.Regular:
                    case TargetType.Plugin:
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
        for (const target of this.targetPathList) {
            if (target.hasDirectoryPath && isSubdirectory(target.computedPath, fileUri)) {
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
        for (const t of this.targetPathList) {
            if (target.name === t.name) {
                return t.computedPath;
            }
        }

        return await _computePathForTarget(target, this.packageRoot, this.fileSystem);
    }

    /**
     * Returns the target that contains a given file, or `null`, if no matching
     * target folder was found.
     */
    async targetForFilePath(filePath: vscode.Uri): Promise<SwiftTarget | null> {
        for (const target of this.targetPathList) {
            if (isSubdirectory(target.computedPath, filePath)) {
                return target;
            }
        }
        
        return null;
    }

    /**
     * Returns a `TargetPathList` for the current package, mapping each known target
     * in the package manifest to a directory on disk, if one can be found.
     */
    static async makeTargetPathMap(packageRoot: vscode.Uri, pkg: SwiftPackageManifest, fileSystem: FileSystemInterface): Promise<TargetPathList> {
        const targets = pkg.targets;
        
        const compute: (target: SwiftTarget) => Promise<[vscode.Uri, SwiftTarget]> = (target) => {
            return _computePathForTarget(target, packageRoot, fileSystem).then((result) => [result, target]);
        };

        const fullTargetPromises = await Promise.all(targets.map(compute));

        let targetPathList: TargetPathList = [];

        for (const [path, target] of fullTargetPromises) {
            const finalTarget: InternalSwiftTarget = {
                ...target,
                computedPath: path,
                hasDirectoryPath: await fileSystem.isDirectoryUri(path)
            };

            targetPathList.push(finalTarget);
        }

        return targetPathList;
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
        for (const target of await this.targetPathList) {
            if (isSubdirectory(target.computedPath, filePath)) {
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
