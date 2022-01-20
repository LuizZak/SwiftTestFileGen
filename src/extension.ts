import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';
import { ConfirmationMode } from './data/configurations/confirmationMode';

export async function activate(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable;

	disposable = vscode.commands.registerCommand('swifttestfilegen.generateTestFiles', async (_, fileUris: vscode.Uri[]) => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Generating test files..."
		}, (_progress, cancellation) => {
			
			const config = vscode.workspace.getConfiguration('swiftTestFileGen');
			const confirmationMode: ConfirmationMode = config.get("fileGen.confirmation") ?? ConfirmationMode.always;

			return generateTestFilesCommand(fileUris, confirmationMode, cancellation);
		});
	});
	context.subscriptions.push(disposable);
}
