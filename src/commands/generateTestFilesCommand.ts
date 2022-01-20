import path = require('path');
import * as vscode from 'vscode';
import * as fs from 'fs';
import { findSwiftPackage, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { proposeTestFiles } from '../testFileGeneration';
import { TestFileDiagnosticKind, TestFileDiagnosticResult } from '../data/testFileDiagnosticResult';
import { SwiftPackageManifest } from '../data/swiftPackage';

export async function generateTestFilesCommand(fileUris: vscode.Uri[], cancellation: vscode.CancellationToken | undefined = undefined) {
    const packagePaths = await Promise.all(fileUris.map((fileUri) => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        return findSwiftPackage(fileUri);
    }));

    // TODO: Handle cases where multiple package manifests where found.
    const filteredPackagePaths = packagePaths.flatMap(path => {
        if (path === null) {
            return [];
        }
        return [path];
    });

    if(cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    if (filteredPackagePaths.length === 0) {
        vscode.window.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
        return;
    }

    const packageManifestPath = filteredPackagePaths[0];
    const packagePath = vscode.Uri.joinPath(packageManifestPath, "..");

    let pkg: SwiftPackageManifest;
    try {
        pkg = await swiftPackageManifestForFile(packageManifestPath, cancellation);
    } catch (err) {
        vscode.window.showErrorMessage(`Error while loading package manifest @ ${packageManifestPath.fsPath}: ${err}`);
        return;
    }

    const result = proposeTestFiles(fileUris, packagePath, pkg);

    // Emit diagnostics
    emitDiagnostics(result[1]);

    const testFiles = result[0];
    const wsEdit = new vscode.WorkspaceEdit();

    for(const testFile of testFiles) {
        try {
            await vscode.workspace.fs.stat(testFile.path);
            // Ignore files that already exist
        } catch {
            wsEdit.createFile(testFile.path, {ignoreIfExists: true});
            wsEdit.insert(testFile.path, new vscode.Position(0, 0), testFile.contents);
        }
    }

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    await vscode.workspace.applyEdit(wsEdit);
    
    // Move focus to first file created
    if (testFiles.length > 0) {
        
    }
}

function emitDiagnostics(diagnostics: TestFileDiagnosticResult[]) {
    // Collapse diagnostic for files not in Sources/ directory
    const filesNotInSources = diagnostics.filter(diagnostic => {
        return diagnostic.kind === TestFileDiagnosticKind.fileNotInSourcesFolder;
    });

    if (filesNotInSources.length > 0) {
        const filePaths = filesNotInSources.flatMap((file) => {
            if (typeof file.sourceFile?.fsPath === "string") {
                return [file.sourceFile.fsPath];
            }

            return [];
        }).join("\n");

        vscode.window.showWarningMessage(
            "One or more files where not contained within a recognized Sources/ folder:",
            {detail: filePaths}
        );
    }
}
