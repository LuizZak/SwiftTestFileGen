import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics, OperationWithDiagnostics, TestFileDiagnosticKind } from '../data/testFileDiagnosticResult';
import { generateTestFilesEntry } from '../frontend';
import { InvocationContext } from '../interfaces/context';
import { SwiftPackagePathsManager } from '../swiftPackagePathsManager';
import { suggestTestFiles } from '../suggestTestFiles';
import { sanitizeFilename } from '../pathUtils';
import { NestableProgress } from '../progress/nestableProgress';

export async function gotoTestFileCommand(
    fileUri: vscode.Uri,
    context: InvocationContext,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<void> {

    const { fileUris, diagnostics } = await performFileSearch(fileUri, context, progress, cancellation);

    // Emit diagnostics
    emitDiagnostics(diagnostics, context.workspace);

    if (fileUris.length === 0) {
        // TODO: Print a diagnostic for this case
        return;
    }

    const testFile = fileUris[0];

    if (await context.fileSystem.fileExists(testFile)) {
        await context.workspace.showTextDocument(testFile, { viewColumn });
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

type TestFileSearchResult = OperationWithDiagnostics<{ fileUris: vscode.Uri[] }>;

async function performFileSearch(
    fileUri: vscode.Uri,
    context: InvocationContext,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<TestFileSearchResult> {
    
    // Perform simple filename heuristic search, if enabled.
    outer:
    if (context.configuration.gotoTestFile.useFilenameHeuristics) {
        const heuristicPattern = context.configuration.gotoTestFile.heuristicFilenamePattern;

        let patterns: string[];
        if (typeof heuristicPattern === "string") {
            patterns = [heuristicPattern];
        } else {
            patterns = heuristicPattern;
        }

        if (patterns.length === 0) {
            // TODO: Emit diagnostics for the case of empty search patterns.
            break outer;
        }

        let results: TestFileSearchResult = {
            fileUris: [],
            diagnostics: []
        };

        const swiftExt = ".swift";
        const baseName = path.basename(fileUri.fsPath, swiftExt);

        const placeholder = "$1";

        for (const pattern of patterns) {
            if (pattern.indexOf(placeholder) === -1) {
                results.diagnostics.push({
                    message: `Found  test file search pattern that does not contain a required '${placeholder}' placeholder : ${pattern}`,
                    kind: TestFileDiagnosticKind.incorrectSearchPattern,
                });
                continue;
            }

            let fileName = pattern.replace(placeholder, baseName);

            if (fileName !== sanitizeFilename(fileName)) {
                fileName = sanitizeFilename(fileName);

                results.diagnostics.push({
                    message: `Found test file search pattern that does not resolve to a simple filename (i.e. contains special characters not allowed in file names): ${pattern}`,
                    kind: TestFileDiagnosticKind.specialCharactersInSearchPattern,
                });
            }

            // Correct patterns with an extra .swift extension
            if (fileName.endsWith(swiftExt)) {
                fileName = fileName.substring(0, fileName.length - swiftExt.length);
            }

            const matches = await context.fileSystem.findFiles(`**/${fileName}${swiftExt}`);
            results.fileUris = results.fileUris.concat(matches);
        }

        if (results.fileUris.length > 0 || results.fileUris.length > 0) {
            return results;
        }
    }

    progress?.reportMessage("Finding Swift package...");

    const pkgPath = await context.packageProvider.swiftPackageManifestPathForFile(fileUri, cancellation);
    if (pkgPath === null) {
        return {
            fileUris: [],
            diagnostics: [{
                message: "Cannot find Package.swift manifest for the current workspace.",
                kind: TestFileDiagnosticKind.packageManifestNotFound,
                sourceFile: fileUri
            }]
        };
    }

    const pkg = await context.packageProvider.swiftPackageManifestForFile(fileUri, cancellation);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pkgRoot = vscode.Uri.joinPath(pkgPath, "..");
    const pathManager = await SwiftPackagePathsManager.create(
        pkgRoot,
        pkgPath,
        pkg,
        context.fileSystem
    );

    if (await pathManager.isTestFile(fileUri)) {
        return {
            fileUris: [],
            diagnostics: [{
                message: "Already in a test file!",
                kind: TestFileDiagnosticKind.alreadyInTestFile,
                sourceFile: fileUri,
            }]
        };
    }

    const { testFiles, diagnostics } = await suggestTestFiles([fileUri], context.packageProvider, progress, cancellation);

    return {
        fileUris: testFiles.map(f => f.path),
        diagnostics
    };
}
