import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';
import { gotoTestFileCommand } from './commands/gotoTestFileCommand';
import { ConfirmationMode } from './data/configurations/confirmationMode';

/** Main entry point for `Generate Test File(s)` command */
export async function generateTestFilesEntry(fileUris: vscode.Uri[]) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating test files..."
    }, (progress, cancellation) => {

        const config = vscode.workspace.getConfiguration('swiftTestFileGen');
        const confirmationMode: ConfirmationMode = config.get("fileGen.confirmation") ?? ConfirmationMode.always;

        return generateTestFilesCommand(fileUris, confirmationMode, progress, cancellation);
    });
}

/** Main entry point for `Go to Test File` command */
export async function gotoTestFileEntry(fileUri: vscode.Uri) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Going to test file..."
    }, (progress, cancellation) => {

        return gotoTestFileCommand(fileUri, vscode.ViewColumn.Active, progress, cancellation);
    });
}
