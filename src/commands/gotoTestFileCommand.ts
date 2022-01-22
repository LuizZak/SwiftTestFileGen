import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { generateTestFilesEntry } from '../frontend';
import { InvocationContext } from '../interfaces/context';
import { findSwiftPackagePath } from '../swiftPackageFinder';
import { isTestFile } from '../swiftPackageUtils';
import { suggestTestFiles } from '../testFileGeneration';

export async function gotoTestFileCommand(fileUri: vscode.Uri, context: InvocationContext, viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active, progress?: vscode.Progress<{ message?: string }>, cancellation?: vscode.CancellationToken): Promise<void> {
    progress?.report({ message: "Finding Swift package..." });

    const pkgPath = await findSwiftPackagePath(fileUri, context.fileSystem);
    if (pkgPath === null) {
        vscode.window.showErrorMessage("Cannot find Package.swift manifest for the current workspace.");
        return;
    }

    const pkg = await context.packageProvider.swiftPackageManifestForFile(fileUri, cancellation);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pkgRoot = context.fileSystem.joinPathUri(pkgPath, "..");

    if (isTestFile(fileUri, pkgRoot, pkg)) {
        vscode.window.showInformationMessage("Already in a test file!");
        return;
    }

    const [files, diagnostics] = suggestTestFiles([fileUri], pkgRoot, pkg);

    // Emit diagnostics
    emitDiagnostics(diagnostics);

    if (files.length !== 1) {
        // TODO: Print diagnostics for this case
        return;
    }

    const testFile = files[0].path;

    if (await context.fileSystem.fileExists(testFile)) {
        await context.workspace.showTextDocument(files[0].path, { viewColumn });
    } else {
        const response = await context.workspace.showInformationMessage(
            `Test file for ${path.basename(fileUri.fsPath)} not found. Would you like to generate a test file now?`,
            "Yes",
            "No"
        );

        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
    
        if (response === "Yes") {
            await generateTestFilesEntry([fileUri], context);
        }
    }
}
