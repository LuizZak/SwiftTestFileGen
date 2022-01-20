import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestgen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating test files..."
		}, (_progress, cancellation) => {
			return generateTestFilesCommand(fileUris, cancellation);
		});
	});
	context.subscriptions.push(disposable);
}
