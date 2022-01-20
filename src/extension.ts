import * as vscode from 'vscode';
import { generateTestFilesEntry, gotoTestFileEntry } from './frontend';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		await generateTestFilesEntry(fileUris);
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestfilegen.gotoTestFile', async (_, fileUris: vscode.Uri[]) => {
		if (fileUris.length === 0) {
			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) {
				return;
			}

			if (editor.document.uri.scheme === "file") {
				await gotoTestFileEntry(editor.document.uri);
			}
		} else {
			await gotoTestFileEntry(fileUris[0]);
		}
	});
	context.subscriptions.push(disposable);
}
