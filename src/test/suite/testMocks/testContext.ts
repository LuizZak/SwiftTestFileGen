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
import { VirtualDiskFile, VirtualDisk, VirtualDiskDirectory } from "./virtualFileDisk";

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
        this.workspace = new TestVscodeWorkspace();
        this.packageProvider = new TestPackageProvider();
        this.configuration = configuration ?? {
            fileGen: {
                confirmation: ConfirmationMode.always
            }
        };
    }
};

export class TestPackageProvider implements PackageProviderInterface {
    stubPackage?: SwiftPackageManifest;

    swiftPackageManifestForFile_calls: [fileUri: vscode.Uri, cancellation?: vscode.CancellationToken][] = [];
    async swiftPackageManifestForFile(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<SwiftPackageManifest> {
        this.swiftPackageManifestForFile_calls.push([fileUri, cancellation]);

        if (this.stubPackage) {
            return this.stubPackage;
        }

        throw new Error("No stubbed package provided!");
    }
};

export class TestFileSystem implements FileSystemInterface {
    virtualFileDisk: VirtualDisk = new VirtualDisk();

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
};

export class TestVscodeWorkspace implements VscodeWorkspaceInterface {
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
        const wsEdit = new TestVscodeWorkspaceEdit();
        this.makeWorkspaceEdit_calls.push(wsEdit);

        return wsEdit;
    }
}

export class TestVscodeWorkspaceEdit implements VscodeWorkspaceEditInterface {
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
    }
}
