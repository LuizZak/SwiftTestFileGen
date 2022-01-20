import * as vscode from 'vscode';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { fileExists } from '../fileDiskUtils';
import { generateTestFilesEntry } from '../frontend';
import { findSwiftPackagePath, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { proposeTestFiles } from '../testFileGeneration';

export async function gotoTestFileCommand(fileUri: vscode.Uri) {
    const pkgPath = await findSwiftPackagePath(fileUri);
    if (pkgPath === null) {
        vscode.window.showErrorMessage("Cannot find Package.swift manifest for the current workspace.");
        return;
    }

    const pkg = await swiftPackageManifestForFile(fileUri);
    const pkgRoot = vscode.Uri.joinPath(pkgPath, "..");

    const [files, diagnostics] = proposeTestFiles([fileUri], pkgRoot, pkg);

    // Emit diagnostics
    emitDiagnostics(diagnostics);

    if (files.length !== 1) {
        // TODO: Print diagnostics for this case
        return;
    }

    const testFile = files[0].path;

    if (await fileExists(testFile)) {
        vscode.workspace.openTextDocument(files[0].path);
    } else {
        const response = await vscode.window.showInformationMessage(
            "Test file not found. Would you like to generate a test file now?",
            "Yes",
            "No"
        );

        if (response === "Yes") {
            await generateTestFilesEntry([fileUri]);
        }
    }
}
