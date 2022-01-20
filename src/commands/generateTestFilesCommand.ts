import path = require('path');
import * as vscode from 'vscode';
import { findSwiftPackagePath, swiftPackageManifestForFile } from '../swiftPackageFinder';
import { suggestTestFiles } from '../testFileGeneration';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { SwiftPackageManifest } from '../data/swiftPackage';
import { ConfirmationMode } from '../data/configurations/confirmationMode';
import { isDirectoryUri } from '../fileDiskUtils';

export async function generateTestFilesCommand(fileUris: vscode.Uri[], confirmationMode: ConfirmationMode, progress: vscode.Progress<{ message?: string }> | null = null, cancellation: vscode.CancellationToken | undefined = undefined): Promise<vscode.TextDocument[]> {
    progress?.report({ message: "Finding Swift package..." });

    const expandedFileUris = await expandSwiftFoldersInUris(fileUris);
    const needsConfirmation = await shouldRequestConfirmation(fileUris, confirmationMode);

    const packagePaths = await Promise.all(expandedFileUris.map((fileUri) => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        return findSwiftPackagePath(fileUri);
    }));

    // TODO: Handle cases where multiple package manifests where found.
    const filteredPackagePaths = packagePaths.flatMap(path => {
        if (path === null) {
            return [];
        }
        return [path];
    });

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    if (filteredPackagePaths.length === 0) {
        vscode.window.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
        return [];
    }

    const packageManifestPath = filteredPackagePaths[0];
    const packagePath = vscode.Uri.joinPath(packageManifestPath, "..");

    let pkg: SwiftPackageManifest;
    try {
        pkg = await swiftPackageManifestForFile(packageManifestPath, cancellation);
    } catch (err) {
        vscode.window.showErrorMessage(`Error while loading package manifest @ ${packageManifestPath.fsPath}: ${err}`);
        return [];
    }

    progress?.report({ message: "Generating test files..." });

    const result = suggestTestFiles(expandedFileUris, packagePath, pkg);

    // Emit diagnostics
    emitDiagnostics(result[1]);

    const testFiles = result[0];
    const wsEdit = new vscode.WorkspaceEdit();
    const filesOpened: vscode.Uri[] = [];

    for (const testFile of testFiles) {
        try {
            await vscode.workspace.fs.stat(testFile.path);
            // Ignore files that already exist
            continue;
        } catch {

        }

        const createFileMetadata: vscode.WorkspaceEditEntryMetadata = {
            needsConfirmation: needsConfirmation,
            label: `Create a new test file for ${path.basename(testFile.originalFile.fsPath)}`
        };
        const insertMetadata: vscode.WorkspaceEditEntryMetadata = {
            needsConfirmation: needsConfirmation,
            label: "Insert boilerplate code for test file"
        };

        filesOpened.push(testFile.path);

        wsEdit.createFile(testFile.path, { ignoreIfExists: true }, createFileMetadata);
        wsEdit.insert(testFile.path, new vscode.Position(0, 0), testFile.contents, insertMetadata);
    }

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    await vscode.workspace.applyEdit(wsEdit);

    // Pre-save all files
    const documents = await Promise.all(filesOpened.map(async fileUri => {
        const document = await vscode.workspace.openTextDocument(fileUri);
        await document.save();

        return document;
    }));

    // Move focus to first file created
    if (documents.length > 0) {
        await vscode.window.showTextDocument(documents[0]);
    }

    progress?.report({ message: "Done!" });

    return documents;
}

async function shouldRequestConfirmation(fileUris: vscode.Uri[], confirmationMode: ConfirmationMode): Promise<boolean> {
    switch (confirmationMode) {
        case ConfirmationMode.always:
            return true;

        case ConfirmationMode.never:
            return false;

        case ConfirmationMode.onlyIfMultiFile:
            if (fileUris.length > 1) {
                return true;
            }

            for (const fileUri of fileUris) {
                if (await isDirectoryUri(fileUri)) {
                    return true;
                }
            }

            return false;

        case ConfirmationMode.onlyOnDirectories:
            for (const fileUri of fileUris) {
                if (await isDirectoryUri(fileUri)) {
                    return true;
                }
            }

            return false;

        default:
            return true;
    }
}

/**
 * Returns a new list of of filesystem Uris by expanding folders in the input list to all .swift files
 * contained within the folders.
 */
async function expandSwiftFoldersInUris(fileUris: vscode.Uri[]): Promise<vscode.Uri[]> {
    const promises = fileUris.map(async (fileUri) => {
        const stat = await vscode.workspace.fs.stat(fileUri);

        switch (stat.type) {
            case vscode.FileType.File:
                return [fileUri];

            case vscode.FileType.Directory:
                const pattern = new vscode.RelativePattern(fileUri, "**/*.swift");
                const files = await vscode.workspace.findFiles(pattern);

                return files;
        }

        return [];
    });

    return (await Promise.all(promises)).flat();
}
