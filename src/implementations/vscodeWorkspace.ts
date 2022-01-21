import * as vscode from 'vscode';
import { VscodeWorkspaceInterface } from '../interfaces/vscodeWorkspaceInterface';

export class VscodeWorkspace implements VscodeWorkspaceInterface {
    makeWorkspaceEdit(): vscode.WorkspaceEdit {
        return new vscode.WorkspaceEdit();
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
}
