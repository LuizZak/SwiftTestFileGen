import path = require('path');
import * as vscode from 'vscode';
import { findSwiftPackagePath } from '../swiftPackageFinder';
import { suggestTestFiles } from '../testFileGeneration';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { SwiftPackageManifest } from '../data/swiftPackage';
import { ConfirmationMode } from '../data/configurations/confirmationMode';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { InvocationContext } from '../interfaces/context';

export async function generateTestFilesCommand(fileUris: vscode.Uri[], confirmationMode: ConfirmationMode, context: InvocationContext, progress?: vscode.Progress<{ message?: string }>, cancellation?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    progress?.report({ message: "Finding Swift package..." });

    const expandedFileUris = await expandSwiftFoldersInUris(fileUris, context.fileSystem);
    const swiftFiles = expandedFileUris.filter(fileUri => path.extname(fileUri.fsPath) === ".swift");

    if (swiftFiles.length === 0) {
        vscode.window.showWarningMessage("No .swift files found in selection");

        return [];
    }

    const needsConfirmation = await shouldRequestConfirmation(fileUris, context.fileSystem, confirmationMode);

    const packagePaths = await Promise.all(swiftFiles.map((fileUri) => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }

        return findSwiftPackagePath(fileUri, context.fileSystem);
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
        pkg = await context.packageProvider.swiftPackageManifestForFile(packageManifestPath, cancellation);
    } catch (err) {
        vscode.window.showErrorMessage(`Error while loading package manifest @ ${packageManifestPath.fsPath}: ${err}`);
        return [];
    }

    progress?.report({ message: "Generating test files..." });

    const result = suggestTestFiles(swiftFiles, packagePath, pkg);

    // Emit diagnostics
    emitDiagnostics(result[1]);

    const testFiles = result[0];
    const wsEdit = context.workspace.makeWorkspaceEdit();
    const filesOpened: vscode.Uri[] = [];

    for (const testFile of testFiles) {
        // Ignore files that already exist
        if (await context.fileSystem.fileExists(testFile.path)) {
            continue;
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

    await context.workspace.applyWorkspaceEdit(wsEdit);

    // Pre-save all files
    const documents = await Promise.all(filesOpened.map(async fileUri => {
        await context.workspace.saveOpenedDocument(fileUri);

        return fileUri;
    }));

    // Move focus to first file created
    if (documents.length > 0) {
        await context.workspace.showTextDocument(documents[0]);
    }

    progress?.report({ message: "Done!" });

    return documents;
}

async function shouldRequestConfirmation(fileUris: vscode.Uri[], fileSystem: FileSystemInterface, confirmationMode: ConfirmationMode): Promise<boolean> {
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
                if (await fileSystem.isDirectoryUri(fileUri)) {
                    return true;
                }
            }

            return false;

        case ConfirmationMode.onlyOnDirectories:
            for (const fileUri of fileUris) {
                if (await fileSystem.isDirectoryUri(fileUri)) {
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
async function expandSwiftFoldersInUris(fileUris: vscode.Uri[], fileSystem: FileSystemInterface): Promise<vscode.Uri[]> {
    const promises = fileUris.map(async (fileUri) => {
        if (await fileSystem.fileExists(fileUri)) {
            return [fileUri];
        }

        if (await fileSystem.isDirectoryUri(fileUri)) {
            const pattern = new vscode.RelativePattern(fileUri, "**/*.swift");
            const files = await fileSystem.findFiles(pattern);

            return files;
        }

        return [];
    });

    return (await Promise.all(promises)).flat();
}
