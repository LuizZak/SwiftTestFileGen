import * as vscode from 'vscode';
import { generateTestFilesCommand } from './commands/generateTestFilesCommand';
import { gotoSourceFileCommand } from './commands/gotoSourceFileCommand';
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
        const nestableProgress = new NestableProgress(progress);

        return generateTestFilesCommand(
            fileUris,
            confirmationMode,
            context,
            nestableProgress,
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

        const nestableProgress = new NestableProgress(progress);

        return gotoTestFileCommand(
            fileUri,
            context,
            vscode.ViewColumn.Active,
            nestableProgress,
            cancellation
        );
    });
}

/** Main entry point for `Go to Source File` command */
export async function gotoSourceFileEntry(fileUri: vscode.Uri, context: InvocationContext) {
    await context.workspace.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Going to source file..."
    }, (progress, cancellation) => {

        const nestableProgress = new NestableProgress(progress);

        return gotoSourceFileCommand(
            fileUri,
            context,
            vscode.ViewColumn.Active,
            nestableProgress,
            cancellation
        );
    });
}
