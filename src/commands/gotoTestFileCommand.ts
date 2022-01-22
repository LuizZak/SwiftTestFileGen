import path = require('path');
import * as vscode from 'vscode';
import { emitDiagnostics, TestFileDiagnosticKind, TestFileDiagnosticResult } from '../data/testFileDiagnosticResult';
import { generateTestFilesEntry } from '../frontend';
import { InvocationContext } from '../interfaces/context';
import { findSwiftPackagePath } from '../swiftPackageFinder';
import { isTestFile } from '../swiftPackageUtils';
import { suggestTestFiles } from '../testFileGeneration';

export async function gotoTestFileCommand(fileUri: vscode.Uri, context: InvocationContext, viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active, progress?: vscode.Progress<{ message?: string }>, cancellation?: vscode.CancellationToken): Promise<void> {
    const [files, diagnostics] = await performFileSearch(fileUri, context, progress, cancellation);

    // Emit diagnostics
    emitDiagnostics(diagnostics);

    if (files.length === 0) {
        // TODO: Print a diagnostic for this case
        return;
    }

    const testFile = files[0];

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

async function performFileSearch(fileUri: vscode.Uri, context: InvocationContext, progress?: vscode.Progress<{ message?: string }>, cancellation?: vscode.CancellationToken): Promise<[vscode.Uri[], TestFileDiagnosticResult[]]> {
    // Perform simple filename heuristic search, if enabled.
    outer:
    if (context.configuration.gotoTestFile.useFilenameHeuristics) {
        const heuristicPattern = context.configuration.gotoTestFile.heuristicFilenamePattern;

        let patterns: RegExp[];
        if (typeof heuristicPattern === "string") {
            patterns = [RegExp(heuristicPattern)];
        } else {
            patterns = heuristicPattern.map(RegExp);
        }

        if (patterns.length === 0) {
            // TODO: Emit diagnostics for the case of empty search patterns.
            break outer;
        }

        let results: [vscode.Uri[], TestFileDiagnosticResult[]] = [[], []];

        const baseName = path.basename(fileUri.fsPath, ".swift");
        for (const pattern of patterns) {
            const targetFile = pattern.exec(baseName);
            if (!targetFile || targetFile.length !== 2) {
                results[1].push({
                    message: `Found regex pattern for heuristicFilenamePattern that does not contain a capture group: ${pattern.source}`,
                    kind: TestFileDiagnosticKind.incorrectSearchPattern,
                });
                continue;
            }
            
            const matches = await context.fileSystem.findFiles(`**/${targetFile[0]}.swift`);
            results[0] = results[0].concat(matches);
        }
        
        return results;
    }

    progress?.report({ message: "Finding Swift package..." });

    const pkgPath = await findSwiftPackagePath(fileUri, context.fileSystem);
    if (pkgPath === null) {
        return [[], [{
            message: "Cannot find Package.swift manifest for the current workspace.",
            kind: TestFileDiagnosticKind.packageManifestNotFound,
            sourceFile: fileUri
        }]];
    }

    const pkg = await context.packageProvider.swiftPackageManifestForFile(fileUri, cancellation);

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pkgRoot = vscode.Uri.joinPath(pkgPath, "..");

    if (isTestFile(fileUri, pkgRoot, pkg)) {
        return [[], [{
            message: "Already in a test file!",
            kind: TestFileDiagnosticKind.alreadyInTestFile,
            sourceFile: fileUri,
        }]];
    }

    const [files, diagnostics] = suggestTestFiles([fileUri], pkgRoot, pkg);

    return [files.map(f => f.path), diagnostics];
}
