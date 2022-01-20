import path = require('path');
import * as vscode from 'vscode';
import * as fs from 'fs';
import { findSwiftPackage, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { proposeTestFiles } from '../testFileGeneration';
import { TestFileDiagnosticKind, TestFileDiagnosticResult } from '../data/testFileDiagnosticResult';

export async function generateTestFilesCommand(fileUris: vscode.Uri[]) {
    const packagePaths = await Promise.all(fileUris.map((fileUri) => {
        return findSwiftPackage(fileUri);
    }));

    // TODO: Handle cases where multiple package manifests where found.
    const filteredPackagePaths = packagePaths.flatMap(path => {
        if (path === null) {
            return [];
        }
        return [path];
    });

    if (filteredPackagePaths.length === 0) {
        vscode.window.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
        return;
    }

    const packageManifestPath = filteredPackagePaths[0];
    const packagePath = vscode.Uri.joinPath(packageManifestPath, "..");

    try {
        const pkg = await swiftPackageManifestForFile(packageManifestPath);
        const result = proposeTestFiles(fileUris, packagePath, pkg);

        // Emit diagnostics
        emitDiagnostics(result[1]);

        const testFiles =
            result[0]
                .filter(testFile => !fs.existsSync(testFile.path.fsPath));

        const wsEdit = new vscode.WorkspaceEdit();

        testFiles.forEach(file => {
            wsEdit.createFile(file.path);
            wsEdit.insert(file.path, new vscode.Position(0, 0), file.contents);
        });

        await vscode.workspace.applyEdit(wsEdit);
    } catch (err) {
        vscode.window.showErrorMessage(`Error while loading package manifest @ ${packageManifestPath.fsPath}: ${err}`);
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
