import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { fileExists } from '../fileDiskUtils';
import { generateTestFilesEntry } from '../frontend';
import { findSwiftPackagePath, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { isTestFile } from '../swiftPackageUtils';
import { suggestTestFiles } from '../testFileGeneration';

export async function gotoTestFileCommand(fileUri: vscode.Uri, viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active, progress: vscode.Progress<{ message?: string }> | null = null, cancellation: vscode.CancellationToken | undefined = undefined) {
    progress?.report({ message: "Finding Swift package..." });

    const pkgPath = await findSwiftPackagePath(fileUri);
    if (pkgPath === null) {
        vscode.window.showErrorMessage("Cannot find Package.swift manifest for the current workspace.");
        return;
    }

    const pkg = await swiftPackageManifestForFile(fileUri);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pkgRoot = vscode.Uri.joinPath(pkgPath, "..");

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

    if (await fileExists(testFile)) {
        const document = await vscode.workspace.openTextDocument(files[0].path);
        await vscode.window.showTextDocument(document, { viewColumn });
    } else {
        const response = await vscode.window.showInformationMessage(
            `Test file for ${path.basename(fileUri.fsPath)} not found. Would you like to generate a test file now?`,
            "Yes",
            "No"
        );

        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
    
        if (response === "Yes") {
            await generateTestFilesEntry([fileUri]);
        }
    }
}
