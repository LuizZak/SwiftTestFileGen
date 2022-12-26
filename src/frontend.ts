import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';
import { gotoTestFileCommand } from './commands/gotoTestFileCommand';
import { InvocationContext } from './interfaces/context';
import { NestableProgress } from './progress/nestableProgress';

/** Main entry point for `Generate Test File(s)` command */
export async function generateTestFilesEntry(fileUris: vscode.Uri[], context: InvocationContext) {
    await context.workspace.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating test files...",
        cancellable: true
    }, (progress, cancellation) => {

        const confirmationMode = context.configuration.fileGen.confirmation;
        const nestedProgress = new NestableProgress(progress);

        return generateTestFilesCommand(
            fileUris,
            confirmationMode,
            context,
            nestedProgress,
            cancellation
        );
    });
}

/** Main entry point for `Go to Test File` command */
export async function gotoTestFileEntry(fileUri: vscode.Uri, context: InvocationContext) {
    await context.workspace.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Going to test file..."
    }, (progress, cancellation) => {

        const nestedProgress = new NestableProgress(progress);

        return gotoTestFileCommand(
            fileUri,
            context,
            vscode.ViewColumn.Active,
            nestedProgress,
            cancellation
        );
    });
}
