import path = require('path');
import * as vscode from 'vscode';
import { mapPathsToSwiftPackages } from '../swiftPackageFinder';
import { suggestTestFiles } from '../testFileGeneration';
import { emitDiagnostics, TestFileDiagnosticKind, TestFileDiagnosticResult } from '../data/testFileDiagnosticResult';
import { SwiftPackageManifest } from '../data/swiftPackage';
import { ConfirmationMode } from '../data/configurations/confirmationMode';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { InvocationContext } from '../interfaces/context';
import { SwiftTestFile } from '../data/swiftTestFile';

export async function generateTestFilesCommand(fileUris: vscode.Uri[], confirmationMode: ConfirmationMode, context: InvocationContext, progress?: vscode.Progress<{ message?: string }>, cancellation?: vscode.CancellationToken): Promise<vscode.Uri[]> {
    progress?.report({ message: "Finding Swift package..." });

    const expandedFileUris = await expandSwiftFoldersInUris(fileUris, context.fileSystem);
    const swiftFiles = expandedFileUris.filter(fileUri => path.extname(fileUri.fsPath) === ".swift");

    if (swiftFiles.length === 0) {
        vscode.window.showWarningMessage("No .swift files found in selection");

        return [];
    }

    const needsConfirmation = await shouldRequestConfirmation(fileUris, context.fileSystem, confirmationMode);

    const [packagesMap, nonPackaged] = await mapPathsToSwiftPackages(swiftFiles, context.fileSystem, cancellation);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    if (packagesMap.size === 0 && nonPackaged.length > 0) {
        vscode.window.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
        return [];
    }

    const wsEdit = context.workspace.makeWorkspaceEdit();
    const documents: vscode.Uri[] = [];
    const filesToCreate:  SwiftTestFile[] = [];
    const diagnostics: TestFileDiagnosticResult[] = [];

    for (const [packageManifestPath, packageFiles] of packagesMap) {
        const packagePath = context.fileSystem.joinPathUri(packageManifestPath, "..");

        let pkg: SwiftPackageManifest;
        try {
            pkg = await context.packageProvider.swiftPackageManifestForFile(packageManifestPath, cancellation);
        } catch (err) {
            diagnostics.push({
                message: `Could not find package manifest @ ${packageManifestPath.fsPath}: ${err}`,
                kind: TestFileDiagnosticKind.packageManifestNotFound
            });

            continue;
        }

        const result = suggestTestFiles(packageFiles, packagePath, pkg);
        filesToCreate.splice(0, 0, ...result[0]);
        diagnostics.splice(0, 0, ...result[1]);
    }

    progress?.report({ message: "Generating test files..." });

    // Emit diagnostics
    emitDiagnostics(diagnostics);

    const filesOpened: vscode.Uri[] = [];

    for (const testFile of filesToCreate) {
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
        wsEdit.replaceDocumentText(testFile.path, testFile.contents, insertMetadata);
    }

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    await wsEdit.applyWorkspaceEdit();

    // Pre-save all files
    const newDocuments = await Promise.all(filesOpened.map(async fileUri => {
        await context.workspace.saveOpenedDocument(fileUri);

        return fileUri;
    }));
    documents.splice(0, 0, ...newDocuments);
    
    progress?.report({ message: "Done!" });

    // Move focus to first file created
    if (documents.length > 0) {
        await context.workspace.showTextDocument(documents[0]);
    }
    
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
