import * as vscode from 'vscode';
import { generateTestFilesEntry, gotoTestFileEntry } from './frontend';
import { FileSystem } from './implementations/fileSystem';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		await generateTestFilesEntry(fileUris, fileSystem());
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('swifttestfilegen.gotoTestFile', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			return;
		}

		if (editor.document.uri.scheme === "file") {
			await gotoTestFileEntry(editor.document.uri, fileSystem());
		}
	});
	context.subscriptions.push(disposable);
}

function fileSystem(): FileSystem {
	return new FileSystem();
}
