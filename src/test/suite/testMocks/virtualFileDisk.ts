import * as vscode from "vscode";
import path = require("path");
import minimatch = require('minimatch');

export type VirtualDiskObject = VirtualDiskRoot | VirtualDiskDirectory | VirtualDiskFile;

export interface VirtualDiskEntryContainer {
    contents: VirtualDiskEntry[];
    parent?: VirtualDiskEntryContainer;

    fullPath(separator: string): string;
    partialPath(upTo: VirtualDiskEntryContainer | undefined, separator: string): string;
}

/** Used to specify explicitly the kind of entries to create with `VirtualDisk.createEntries`. */
export enum VirtualDiskEntryType {
    file,
    directory,
    /** Alias for 'directory' */
    folder = directory
};

/** A virtual file disk for testing */
export class VirtualDisk {
    root: VirtualDiskRoot = new VirtualDiskRoot();

    findEntry(filePath: string | vscode.Uri): VirtualDiskObject | undefined {
        return this.findPath(filePath);
    }

    /**
     * Requests that a set of file/directory entries be created.
     * 
     * Path strings that end in '/' are recognized as folder entries, and all other entries are recognized as files.
     * 
     * Supports deep paths, creating all directories in between in the process.
     */
    createEntries(filePathList: (string | vscode.Uri)[]) {
        const entries: [string | vscode.Uri, VirtualDiskEntryType][] = filePathList.map(entry => {
            if (entry instanceof vscode.Uri) {
                return [entry, VirtualDiskEntryType.file];
            }

            if (entry.endsWith("/")) {
                return [entry, VirtualDiskEntryType.folder];
            } else {
                return [entry, VirtualDiskEntryType.file];
            }
        });

        this.createEntriesWithKind(entries);
    }

    /**
     * Requests that a set of file/directory entries be created.
     * 
     * Supports deep paths, creating all directories in between in the process.
     */
    createEntriesWithKind(filePathList: [string | vscode.Uri, VirtualDiskEntryType][]) {
        for (const [file, kind] of filePathList) {
            let normalizedPath: vscode.Uri;
            if (file instanceof vscode.Uri) {
                normalizedPath = file;
            } else {
                normalizedPath = vscode.Uri.file(file);
            }

            // Detect directory paths by a trailing slash
            switch (kind) {
            case VirtualDiskEntryType.file:
                this.createFile(normalizedPath);
                break;
            case VirtualDiskEntryType.folder:
                this.createDirectory(normalizedPath);
                break;
            }
        }
    }

    createFile(filePath: string | vscode.Uri): VirtualDiskFile {
        const dirName = this.directoryName(filePath);
        const fileName = this.fileName(filePath);
        const directory = this.ensureDirectoryExists(dirName);

        const existing = this.entryWithName(fileName, directory);
        if (existing !== undefined) {
            if (existing instanceof VirtualDiskFile) {
                return existing;
            }

            throw new Error(`Entry at ${filePath} already exists and is not a file!`);
        }

        return this._createFileUnconditionally(fileName, directory);
    }

    createDirectory(fullPath: string | vscode.Uri): VirtualDiskEntryContainer {
        return this.ensureDirectoryExists(fullPath);
    }

    allFilesRecursive(container: VirtualDiskEntryContainer): VirtualDiskFile[] {
        let result: VirtualDiskEntry[] = [];

        container.contents.forEach(entry => {
            if (entry instanceof VirtualDiskFile) {
                result.push(entry);
            } else if (entry instanceof VirtualDiskDirectory) {
                result = result.concat(this.allFilesRecursive(entry));
            }
        });

        return result;
    }

    pathSeparator(): string {
        return path.sep;
    }

    glob(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null): VirtualDiskFile[] {
        if (typeof include === "string") {
            include = new vscode.RelativePattern(this.pathSeparator(), include);
        }
        if (typeof exclude === "string") {
            exclude = new vscode.RelativePattern(this.pathSeparator(), exclude);
        }

        const toInclude = this.globRelative(include);
        const toExclude = exclude ? this.globRelative(exclude) : [];

        return toInclude.filter(item => toExclude.indexOf(item) === -1);
    }

    private globRelative(partialGlob: vscode.RelativePattern): VirtualDiskFile[] {
        const container = this.findEntry(partialGlob.base);
        if (!(container instanceof VirtualDiskDirectory || container instanceof VirtualDiskRoot)) {
            return [];
        }

        const files = this.allFilesRecursive(container);
        const matchInclude = new minimatch.Minimatch(partialGlob.pattern);

        return files.filter(file => {
            let partialPath: string;
            if (container === this.root) {
                partialPath = file.fullPath(this.pathSeparator());
            } else {
                partialPath = file.partialPath(container, this.pathSeparator());
            }

            return matchInclude.match(partialPath);
        });
    }

    private ensureDirectoryExists(directoryPath: string | vscode.Uri): VirtualDiskEntryContainer {
        let currentPath = this.splitPathComponents(directoryPath).slice(1);
        let currentDirectory = this.root;

        while (currentPath.length > 0) {
            // Trailing empty space: We've reached the end of a directory tree.
            if (currentPath[0].length === 0) {
                break;
            }

            const nextPath = currentPath[0];
            const nextEntry = this.entryWithName(nextPath, currentDirectory);

            if (nextEntry === undefined) {
                currentPath = currentPath.slice(1);
                currentDirectory = this._createDirectoryUnconditionally(nextPath, currentDirectory);
                continue;
            }
            
            if (nextEntry instanceof VirtualDiskDirectory) {
                currentPath = currentPath.slice(1);
                currentDirectory = nextEntry;
            } else {
                throw new Error(`Path at ${this.fullPath(nextEntry)} is not a directory!`);
            }
        }

        return currentDirectory;
    }

    private findPath(pathString: string | vscode.Uri): VirtualDiskObject | undefined {
        let currentPath = this.splitPathComponents(pathString).slice(1);
        let currentObject: VirtualDiskObject = this.root;

        while (currentPath.length > 0) {
            if (currentObject instanceof VirtualDiskDirectory || currentObject instanceof VirtualDiskRoot) {
                // Trailing empty space: return current directory.
                if (currentPath[0] === "") {
                    break;
                }
                
                const nextPath = currentPath[0];
                const nextEntry = this.entryWithName(nextPath, currentObject);

                if (nextEntry === undefined) {
                    return undefined;
                }

                currentPath = currentPath.splice(1);
                currentObject = nextEntry;
            } else {
                // Indexing into file?
                return undefined;
            }
        }

        return currentObject;
    }

    private splitPathComponents(fullPath: string | vscode.Uri): string[] {
        let expandedPath: string;
        if (fullPath instanceof vscode.Uri) {
            expandedPath = fullPath.fsPath;
        } else {
            expandedPath = vscode.Uri.file(fullPath).fsPath;
        }
        
        return expandedPath.split(this.pathSeparator());
    }

    private fullPath(entry: VirtualDiskEntry): string {
        return entry.fullPath(this.pathSeparator());
    }

    private entryWithName(name: string, directory: VirtualDiskEntryContainer): VirtualDiskEntry | undefined {
        return directory.contents.find(entry => entry.name === name);
    }

    private directoryName(fileName: string | vscode.Uri): string {
        return path.dirname(fileName instanceof vscode.Uri ? fileName.fsPath : fileName);
    }

    private fileName(fileName: string | vscode.Uri): string {
        return path.basename(fileName instanceof vscode.Uri ? fileName.fsPath : fileName);
    }

    private _createDirectoryUnconditionally(name: string, parent: VirtualDiskEntryContainer): VirtualDiskDirectory {
        const directory = new VirtualDiskDirectory(name);
        directory.parent = parent;

        parent.contents.push(directory);

        return directory;
    }

    private _createFileUnconditionally(name: string, parent: VirtualDiskEntryContainer): VirtualDiskFile {
        const file = new VirtualDiskFile(name);
        file.parent = parent;

        parent.contents.push(file);

        return file;
    }
}

export class VirtualDiskRoot implements VirtualDiskEntryContainer {
    constructor(public contents: VirtualDiskEntry[] = []) {

    }

    partialPath(upTo: VirtualDiskEntryContainer | undefined, _separator: string): string {
        if (upTo === undefined) {
            return "/";
        }

        return "";
    }

    fullPath(_separator: string): string {
        return "";
    }
}

export class VirtualDiskEntry {
    constructor(public name: string, public parent?: VirtualDiskEntryContainer) {
        
    }

    partialPath(upTo: VirtualDiskEntryContainer | undefined, separator: string): string {
        if (this.parent === undefined) {
            return this.name;
        }
        if (this.parent === upTo) {
            return this.name;
        }

        return this.parent.partialPath(upTo, separator) + separator + this.name;
    }

    fullPath(separator: string): string {
        if (this.parent !== undefined) {
            return this.parent.fullPath(separator) + separator + this.name;
        }

        return this.name;
    }
}

export class VirtualDiskDirectory extends VirtualDiskEntry implements VirtualDiskEntryContainer {
    constructor(name: string, public contents: VirtualDiskEntry[] = [], public parent?: VirtualDiskEntryContainer) {
        super(name, parent);

        this.contents = contents;
    }
}

export class VirtualDiskFile extends VirtualDiskEntry {

}
