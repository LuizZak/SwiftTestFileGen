/* eslint-disable @typescript-eslint/naming-convention */
import path = require("path");
import * as vscode from "vscode";
import { Configuration } from "../../../data/configurations/configuration";
import { ConfirmationMode } from "../../../data/configurations/confirmationMode";
import { SwiftPackageManifest } from "../../../data/swiftPackage";
import { InvocationContext } from "../../../interfaces/context";
import { FileSystemInterface } from "../../../interfaces/fileSystemInterface";
import { PackageProviderInterface } from "../../../interfaces/packageProviderInterface";
import { VscodeWorkspaceEditInterface, VscodeWorkspaceInterface } from "../../../interfaces/vscodeWorkspaceInterface";
import { SwiftPackagePathsManager } from "../../../swiftPackagePathsManager";
import { VirtualDiskFile, VirtualDisk, VirtualDiskDirectory, VirtualDiskEntryType } from "./virtualFileDisk";

export function makeTestContext(configuration?: Configuration): TestContext {
    return new TestContext(configuration);
}

export class TestContext implements InvocationContext {
    fileSystem: TestFileSystem;
    workspace: TestVscodeWorkspace;
    packageProvider: TestPackageProvider;
    configuration: Configuration;

    constructor(configuration?: Configuration) {
        this.fileSystem = new TestFileSystem();
        this.workspace = new TestVscodeWorkspace(this.fileSystem.virtualFileDisk);
        this.packageProvider = new TestPackageProvider(this.fileSystem);

        this.configuration = configuration ?? {
            fileGen: {
                confirmation: ConfirmationMode.always,
            },
            gotoTestFile: {
                useFilenameHeuristics: false,
                heuristicFilenamePattern: "(\\w+)Tests",
            },
        };
    }

    /**
     * Configures whether mock workspace edits should actually create virtual
     * disk entries when they conclude editing.
     *
     * Defaults to `true`.
     *
     * Only applies to future `makeWorkspaceEdit()` calls.
     */
    setCreateVirtualFilesInWorkspaceEdits(value: boolean): TestContext {
        this.workspace.setCreateVirtualFilesInWorkspaceEdits(value);
        return this;
    }
};

export class TestPackageProvider implements PackageProviderInterface {
    /** Stubs package on a per-directory basis, retuning the package manifest that is closest to a Package.swift uri. */
    stubPackageList?: {packageSwiftUri: vscode.Uri | string, pkg: SwiftPackageManifest}[];

    /** Single stubbed package that is always returned, if no package in `this.stubPackageList` was matched. */
    stubPackage?: SwiftPackageManifest;

    constructor(public fileSystem: FileSystemInterface) {

    }

    swiftPackageManifestForFile_calls: [fileUri: vscode.Uri, cancellation?: vscode.CancellationToken][] = [];
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        this.swiftPackageManifestForFile_calls.push([fileUri, cancellation]);

        if (this.stubPackageList) {
            const stubbed = this.closestPackageToPath(fileUri);
            if (stubbed) {
                return stubbed[1];
            }
        }
        if (this.stubPackage) {
            return this.stubPackage;
        }

        throw new Error("No stubbed package provided!");
    }

    swiftPackagePathManagerForFile_calls: [fileUri: vscode.Uri, cancellation?: vscode.CancellationToken][] = [];
    async swiftPackagePathManagerForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackagePathsManager> {
        this.swiftPackagePathManagerForFile_calls.push([fileUri, cancellation]);

        const stubbed = this.closestPackageToPath(fileUri);
        if (!stubbed) {
            throw new Error("No stubbed package found!");
        }

        const pkgPath = vscode.Uri.joinPath(stubbed[0], "..");
        const manifestPath = vscode.Uri.joinPath(pkgPath, "Package.swift");
        
        return await SwiftPackagePathsManager.create(pkgPath, manifestPath, stubbed[1], this.fileSystem);
    }

    swiftPackageManifestPathForFile_calls: [fileUri: vscode.Uri, cancellation?: vscode.CancellationToken][] = [];
    async swiftPackageManifestPathForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken | undefined): Promise<vscode.Uri | null> {
        this.swiftPackagePathManagerForFile_calls.push([fileUri, cancellation]);

        const stubbed = this.closestPackageToPath(fileUri);
        if (!stubbed) {
            return null;
        }

        const pkgPath = vscode.Uri.joinPath(stubbed[0], "..");
        const manifestPath = vscode.Uri.joinPath(pkgPath, "Package.swift");
        
        return manifestPath;
    }

    private closestPackageToPath(fileUri: vscode.Uri): [vscode.Uri, SwiftPackageManifest] | null {
        if (!this.stubPackageList) {
            throw new Error("No stubbed package provided!");
        }

        // Do a recursive search up the paths, stopping on the first Package.swift found in the hierarchy
        let currentDirectory = vscode.Uri.joinPath(fileUri, "..");
        const rootPath = vscode.Uri.file("/").fsPath;

        while (currentDirectory.fsPath !== rootPath) {
            for (const {packageSwiftUri, pkg} of this.stubPackageList) {
                const stubPath = packageSwiftUri instanceof vscode.Uri ? packageSwiftUri : vscode.Uri.file(packageSwiftUri);
                const packageFile = vscode.Uri.joinPath(currentDirectory, "Package.swift");
                if (packageFile.fsPath === stubPath.fsPath) {
                    return [packageFile, pkg];
                }
            }

            currentDirectory = vscode.Uri.joinPath(currentDirectory, "..");
        }

        return null;
    }
};

export class TestFileSystem implements FileSystemInterface {
    virtualFileDisk: VirtualDisk = new VirtualDisk();

    /**
     * Requests that a set of file/directory entries be created.
     * 
     * Path strings that end in '/' are recognized as folder entries, and all other entries are recognized as files.
     * 
     * Supports deep paths, creating all directories in between in the process.
     * 
     * Alias for `this.virtualFileDisk.createEntries(filePathList)`.
     */
    createEntries(...filePathList: (string | vscode.Uri)[]) {
        this.virtualFileDisk.createEntries(filePathList);
    }

    /**
     * Requests that a set of file/directory entries be created.
     * 
     * Supports deep paths, creating all directories in between in the process.
     * 
     * Alias for `this.virtualFileDisk.createEntriesWithKind(filePathList)`.
     */
     createEntriesWithKind(...filePathList: [string | vscode.Uri, VirtualDiskEntryType][])  {
        this.virtualFileDisk.createEntriesWithKind(filePathList);
    }

    async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            return this.virtualFileDisk.findEntry(uri.fsPath) instanceof VirtualDiskFile;
        } catch {
            return false;
        }
    }

    async isDirectoryUri(uri: vscode.Uri): Promise<boolean> {
        try {
            return this.virtualFileDisk.findEntry(uri.fsPath) instanceof VirtualDiskDirectory;
        } catch {
            return false;
        }
    }

    async findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
        let results = this.virtualFileDisk.glob(include, exclude);
        if (maxResults) {
            results = results.slice(0, maxResults);
        }

        return results.map(result => {
            return vscode.Uri.file(result.fullPath(path.sep));
        });
    }

    /**
     * @deprecated Use `vscode.Uri.joinPath` instead.
     */
    joinPathUri(uri: vscode.Uri, ...components: string[]): vscode.Uri {
        return vscode.Uri.joinPath(uri, ...components);
    }
};

export class TestVscodeWorkspace implements VscodeWorkspaceInterface {
    private _createVirtualFilesInWorkspaceEdits: boolean = true;

    constructor(private fileDisk: VirtualDisk) {

    }

    saveOpenedDocument_calls: [uri: vscode.Uri][] = [];
    async saveOpenedDocument(uri: vscode.Uri): Promise<void> {
        this.saveOpenedDocument_calls.push([uri]);
    }

    showTextDocument_calls: [uri: vscode.Uri, options?: vscode.TextDocumentShowOptions][] = [];
    async showTextDocument(uri: vscode.Uri, options?: vscode.TextDocumentShowOptions): Promise<void> {
        this.showTextDocument_calls.push([uri, options]);
    }

    makeWorkspaceEdit_calls: TestVscodeWorkspaceEdit[] = [];
    makeWorkspaceEdit(): TestVscodeWorkspaceEdit {
        const wsEdit = new TestVscodeWorkspaceEdit(
            this.fileDisk,
            this._createVirtualFilesInWorkspaceEdits
        );
        this.makeWorkspaceEdit_calls.push(wsEdit);

        return wsEdit;
    }

    showInformationMessage_calls: [message: string, items: string[]][] = [];
    showInformationMessage_stub?: (message: string, items: string[]) => Promise<string | undefined>;
    async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
        this.showInformationMessage_calls.push([message, items]);

        return this.showInformationMessage_stub?.(message, items);
    }

    showWarningMessage_calls: [message: string, items: string[]][] = [];
    showWarningMessage_stub?: (message: string, items: string[]) => Promise<string | undefined>;
    async showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
        this.showWarningMessage_calls.push([message, items]);

        return this.showWarningMessage_stub?.(message, items);
    }

    showErrorMessage_calls: [message: string, items: string[]][] = [];
    showErrorMessage_stub?: (message: string, items: string[]) => Promise<string | undefined>;
    async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        this.showErrorMessage_calls.push([message, items]);

        return this.showErrorMessage_stub?.(message, items);
    }

    async withProgress<R>(options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined; }>, token: vscode.CancellationToken) => Thenable<R>): Promise<R> {
        const progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined; }> = {
            report(_value: { message?: string | undefined; increment?: number | undefined; }) {
                
            }
        };
        const token = new vscode.CancellationTokenSource();
        
        return await task(progress, token.token);
    }

    /**
     * Configures whether mock workspace edits should actually create virtual
     * disk entries when they conclude editing.
     *
     * Defaults to `true`.
     *
     * Only applies to future `makeWorkspaceEdit()` calls.
     */
    setCreateVirtualFilesInWorkspaceEdits(value: boolean): TestVscodeWorkspace {
        this._createVirtualFilesInWorkspaceEdits = value;
        return this;
    }
};

export class TestVscodeWorkspaceEdit implements VscodeWorkspaceEditInterface {
    constructor(private fileDisk: VirtualDisk, private createVirtualFiles: boolean) {

    }

    createFile_calls: [uri: vscode.Uri, options?: { overwrite?: boolean | undefined; ignoreIfExists?: boolean | undefined; }, metadata?: vscode.WorkspaceEditEntryMetadata][] = [];
    createFile(uri: vscode.Uri, options?: { overwrite?: boolean | undefined; ignoreIfExists?: boolean | undefined; }, metadata?: vscode.WorkspaceEditEntryMetadata): void {
        this.createFile_calls.push([uri, options, metadata]);
    }

    replaceDocumentText_calls: [uri: vscode.Uri, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata][] = [];
    replaceDocumentText(uri: vscode.Uri, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata): void {
        this.replaceDocumentText_calls.push([uri, newText, metadata]);
    }

    applyWorkspaceEdit_calls: any[] = [];
    async applyWorkspaceEdit(): Promise<void> {
        this.applyWorkspaceEdit_calls.push();

        if (this.createVirtualFiles) {
            this.createFile_calls.forEach(call => {
                const path = call[0];
                
                if (!this.fileDisk.fileExists(path)) {
                    this.fileDisk.createFile(path);
                }
            });
        }
    }

    /**
     * Returns `true` if this workspace edit mock contains no calls to modifying
     * methods like `createFile` or `replaceDocumentText`. Non-mutating calls
     * such as `applyWorkspaceEdit` are not considered.
     */
    isEmptyEdit(): boolean {
        return this.createFile_calls.length === 0 && this.replaceDocumentText_calls.length === 0;
    }
}
