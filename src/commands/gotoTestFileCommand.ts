import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics, OperationWithDiagnostics, TestFileDiagnosticKind } from '../data/testFileDiagnosticResult';
import { generateTestFilesEntry } from '../frontend';
import { InvocationContext } from '../interfaces/context';
import { suggestTestFiles } from '../suggestTestFiles';
import { sanitizeFilename } from '../pathUtils';
import { NestableProgress } from '../progress/nestableProgress';
import { validatePattern } from '../patternValidator';

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
    if (context.configuration.gotoTestFile.useFilenameHeuristics) {
        const heuristicPattern = context.configuration.gotoTestFile.heuristicFilenamePattern;

        let patterns: string[];
        if (typeof heuristicPattern === "string") {
            patterns = [heuristicPattern];
        } else {
            patterns = heuristicPattern;
        }

        // TODO: Emit diagnostics for the case of empty search patterns.
        if (patterns.length > 0) {
            let results = await performHeuristicSearch(fileUri, patterns, context);

            if (results.fileUris.length > 0) {
                return results;
            }
        }
    }

    progress?.reportMessage("Finding Swift package...");

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pathManager = await context.packageProvider.swiftPackagePathManagerForFile(fileUri);

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

    const { testFiles, diagnostics } = await suggestTestFiles(
        [fileUri],
        context.configuration,
        context,
        progress,
        cancellation
    );

    return {
        fileUris: testFiles.map(f => f.path),
        diagnostics
    };
}

async function performHeuristicSearch(
    fileUri: vscode.Uri,
    patterns: string[],
    context: InvocationContext
): Promise<TestFileSearchResult> {

    let results: TestFileSearchResult = {
        fileUris: [],
        diagnostics: []
    };

    const swiftExt = ".swift";
    const baseName = path.basename(fileUri.fsPath, swiftExt);

    const placeholder = "$1";

    for (const pattern of patterns) {
        const isPatternValid = validatePattern(pattern);
        results.diagnostics.push(...isPatternValid.diagnostics);

        if (!isPatternValid.isValid) {
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
            fileName = path.basename(fileName, swiftExt);
        }

        const matches = await context.fileSystem.findFiles(`**/${fileName}${swiftExt}`);
        results.fileUris = results.fileUris.concat(matches);
    }

    return results;
}
