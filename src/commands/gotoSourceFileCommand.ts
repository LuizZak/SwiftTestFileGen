import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics, OperationWithDiagnostics, TestFileDiagnosticKind } from '../data/testFileDiagnosticResult';
import { InvocationContext } from '../interfaces/context';
import { NestableProgress } from '../progress/nestableProgress';
import { SourceToTestFileMapper } from '../implementations/sourceToTestFileMapper';

export async function gotoSourceFileCommand(
    fileUri: vscode.Uri,
    context: InvocationContext,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<void> {

    progress?.reportMessage("Parsing Swift package...");

    const pkg = await context.packageProvider.swiftPackagePathManagerForFile(
        fileUri,
        cancellation
    );

    const pathMapper = new SourceToTestFileMapper(pkg);

    const result = await pathMapper.suggestedSourcePathFor(fileUri);

    // Emit diagnostics
    emitDiagnostics(result.diagnostics, context.workspace);

    if (result.transformedPath) {
        await context.workspace.showTextDocument(result.transformedPath, { viewColumn });
    } else {
        await context.workspace.showInformationMessage(
            `Source file for ${path.basename(fileUri.fsPath)} not found!`
        );
    }

    progress?.complete();
}
