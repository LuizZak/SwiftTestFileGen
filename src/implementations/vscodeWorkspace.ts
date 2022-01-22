import * as vscode from 'vscode';
import { VscodeWorkspaceEditInterface, VscodeWorkspaceInterface } from '../interfaces/vscodeWorkspaceInterface';

export class VscodeWorkspace implements VscodeWorkspaceInterface {
    makeWorkspaceEdit(): VscodeWorkspaceEditInterface {
        const wsEdit = new vscode.WorkspaceEdit();
        return new VscodeWorkspaceEdit(wsEdit);
    }

    async applyWorkspaceEdit(edit: vscode.WorkspaceEdit): Promise<void> {
        await vscode.workspace.applyEdit(edit);
    }

    async saveOpenedDocument(uri: vscode.Uri): Promise<void> {
        for (const document of vscode.workspace.textDocuments) {
            if (document.uri.fsPath === uri.fsPath) {
                await document.save();
                return;
            }
        }
    }

    async showTextDocument(uri: vscode.Uri, options?: vscode.TextDocumentShowOptions): Promise<void> {
        vscode.window.showTextDocument(uri, options);
    }

    async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showInformationMessage(message, ...items);
    }

    async showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showWarningMessage(message, ...items);
    }

    async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showErrorMessage(message, ...items);
    }

    withProgress<R>(options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined; }>, token: vscode.CancellationToken) => Thenable<R>): Thenable<R> {
        return vscode.window.withProgress(options, task);
    }
}

export class VscodeWorkspaceEdit implements VscodeWorkspaceEditInterface {
    constructor(private wsEdit: vscode.WorkspaceEdit) {

    }

    createFile(uri: vscode.Uri, options?: { overwrite?: boolean | undefined; ignoreIfExists?: boolean | undefined; }, metadata?: vscode.WorkspaceEditEntryMetadata): void {
        this.wsEdit.createFile(uri, options, metadata);
    }

    replaceDocumentText(uri: vscode.Uri, newText: string, metadata?: vscode.WorkspaceEditEntryMetadata): void {
        this.wsEdit.insert(uri, new vscode.Position(0, 0), newText, metadata);
    }

    async applyWorkspaceEdit(): Promise<void> {
        await vscode.workspace.applyEdit(this.wsEdit);
    }
}
