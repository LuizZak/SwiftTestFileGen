import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { fileExists } from '../fileDiskUtils';
import { generateTestFilesEntry } from '../frontend';
import { findSwiftPackagePath, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { suggestTestFiles } from '../testFileGeneration';

export async function gotoTestFileCommand(fileUri: vscode.Uri, viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active) {
    const pkgPath = await findSwiftPackagePath(fileUri);
    if (pkgPath === null) {
        vscode.window.showErrorMessage("Cannot find Package.swift manifest for the current workspace.");
        return;
    }

    const pkg = await swiftPackageManifestForFile(fileUri);
    const pkgRoot = vscode.Uri.joinPath(pkgPath, "..");

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

        if (response === "Yes") {
            await generateTestFilesEntry([fileUri]);
        }
    }
}
