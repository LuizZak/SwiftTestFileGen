import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "swifttestgen" is now active!');

	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestgen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating test files..."
		}, (_progress) => {
			return generateTestFilesCommand(fileUris);
		});
	});
	context.subscriptions.push(disposable);
}

async function findExtensionFolders(): Promise<vscode.Uri[]> {
	

	return [];
}
