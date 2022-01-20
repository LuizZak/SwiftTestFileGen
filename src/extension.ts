import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';

export async function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('swifttestfilegen');

	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating test files..."
		}, (_progress, cancellation) => {
			return generateTestFilesCommand(fileUris, config.get("fileGen.skipConfirm"), cancellation);
		});
	});
	context.subscriptions.push(disposable);
}
