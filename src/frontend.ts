import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';
import { gotoTestFileCommand } from './commands/gotoTestFileCommand';
import { InvocationContext } from './interfaces/context';

/** Main entry point for `Generate Test File(s)` command */
export async function generateTestFilesEntry(fileUris: vscode.Uri[], context: InvocationContext) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating test files..."
    }, (progress, cancellation) => {

        const confirmationMode = context.configuration.fileGen.confirmation;

        return generateTestFilesCommand(fileUris, confirmationMode, context, progress, cancellation);
    });
}

/** Main entry point for `Go to Test File` command */
export async function gotoTestFileEntry(fileUri: vscode.Uri, context: InvocationContext) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Going to test file..."
    }, (progress, cancellation) => {

        return gotoTestFileCommand(fileUri, context, vscode.ViewColumn.Active, progress, cancellation);
    });
}
