import path = require('path');
import * as vscode from 'vscode';
import { mapPathsToSwiftPackages } from '../swiftPackageFinder';
import { joinSuggestedTestFileResults, suggestTestFiles, SuggestTestFilesResult } from '../suggestTestFiles';
import { emitDiagnostics } from '../data/testFileDiagnosticResult';
import { ConfirmationMode } from '../data/configurations/confirmationMode';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { InvocationContext } from '../interfaces/context';
import { deduplicateStable } from '../algorithms/dedupe';
import { monitorWithProgress, NestableProgress } from '../progress/nestableProgress';

export async function generateTestFilesCommand(
    fileUris: vscode.Uri[],
    confirmationMode: ConfirmationMode,
    context: InvocationContext,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<vscode.Uri[]> {

    if (progress) {
        progress = progress.createChild(5);
        progress.unitsPerChild = 1;
    }

    progress?.reportMessage("Finding Swift package...");

    const expandedFileUris = await expandSwiftFoldersInUris(
        fileUris,
        context.fileSystem,
        progress,
        cancellation
    );
    let swiftFiles = expandedFileUris.filter(fileUri => path.extname(fileUri.fsPath) === ".swift");

    // Deduplicate input files
    swiftFiles = deduplicateStable(swiftFiles, file => file.fsPath);

    if (swiftFiles.length === 0) {
        context.workspace.showWarningMessage("No .swift files found in selection");
        return [];
    }

    const needsConfirmation = await shouldRequestConfirmation(fileUris, context.fileSystem, confirmationMode);

    const [packagesMap, nonPackaged] = await mapPathsToSwiftPackages(swiftFiles, context.fileSystem, cancellation);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    if (packagesMap.size === 0 && nonPackaged.length > 0) {
        context.workspace.showWarningMessage('Did not find a Package.swift manifest to derive test paths from for the selected files!');
        return [];
    }

    const wsEdit = context.workspace.makeWorkspaceEdit();

    let results: SuggestTestFilesResult = {
        testFiles: [],
        diagnostics: []
    };
    
    const suggestTestFilesProgress = progress?.createChild(packagesMap.size);
    if (suggestTestFilesProgress) {
        suggestTestFilesProgress.unitsPerChild = 1;
    }

    for (const [_, packageFiles] of packagesMap) {
        const result = await suggestTestFiles(
            packageFiles,
            context.packageProvider,
            suggestTestFilesProgress,
            cancellation
        );
        results = joinSuggestedTestFileResults(results, result);
    }

    suggestTestFilesProgress?.complete();

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    progress?.reportMessage("Generating test files...");

    const filesProgress = progress?.createChild(results.testFiles.length);
    
    // Emit diagnostics
    emitDiagnostics(results.diagnostics, context.workspace);

    const filesSuggested: vscode.Uri[] = [];

    var shownFirstFile = false;
    for (const testFile of results.testFiles) {
        filesProgress?.increment();

        // Ignore files that already exist
        if (await context.fileSystem.fileExists(testFile.path)) {
            // Show first file as a shortcut to 'Go to test file...' command.
            if (!shownFirstFile) {
                shownFirstFile = true;
                context.workspace.showTextDocument(testFile.path);
            }

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

        filesSuggested.push(testFile.path);

        wsEdit.createFile(testFile.path, { ignoreIfExists: true }, createFileMetadata);
        wsEdit.replaceDocumentText(testFile.path, testFile.contents, insertMetadata);
    }

    filesProgress?.complete();

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    progress?.reportMessage("Waiting for user to accept workspace edit...");

    await wsEdit.applyWorkspaceEdit();

    // Find documents that where created
    const createdDocuments = await Promise.all(filesSuggested.map(async fileUri => {
        return await context.fileSystem.fileExists(fileUri);
    })).then(
        (documentsExists) => filesSuggested.filter((_, index) => documentsExists[index])
    );

    // Pre-save all files
    const savedDocuments = await Promise.all(createdDocuments.map(async fileUri => {
        await context.workspace.saveOpenedDocument(fileUri);

        return fileUri;
    }));
    
    progress?.incrementWithMessage("Done!");

    // Move focus to first file created
    if (createdDocuments.length > 0) {
        await context.workspace.showTextDocument(createdDocuments[0]);
    }

    progress?.complete();
    
    return savedDocuments;
}

async function shouldRequestConfirmation(
    fileUris: vscode.Uri[],
    fileSystem: FileSystemInterface,
    confirmationMode: ConfirmationMode
): Promise<boolean> {

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
async function expandSwiftFoldersInUris(
    fileUris: vscode.Uri[],
    fileSystem: FileSystemInterface,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<vscode.Uri[]> {

    const promisesProgress = progress?.createChild(fileUris.length, undefined, "Expanding paths...");

    const promises = fileUris.map(async (fileUri) => {
        if (cancellation?.isCancellationRequested) {
            throw new vscode.CancellationError();
        }
        
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

    const result = await Promise.all(monitorWithProgress(promises, promisesProgress, 1));
    return result.flat();
}
