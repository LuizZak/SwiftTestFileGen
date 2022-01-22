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

        let results: [vscode.Uri[], TestFileDiagnosticResult[]] = [[], []];
        
        const swiftExt = ".swift";
        const baseName = path.basename(fileUri.fsPath, swiftExt);
        
        const placeholder = "$1";

        for (const pattern of patterns) {
            if (pattern.indexOf(placeholder) === -1) {
                results[1].push({
                    message: `Found pattern for heuristicFilenamePattern that does not contain a required '${placeholder}' placeholder : ${pattern}`,
                    kind: TestFileDiagnosticKind.incorrectSearchPattern,
                });
                continue;
            }

            let fileName = pattern.replace(placeholder, baseName);
            
            // Correct patterns with an extra .swift extension
            if (fileName.endsWith(swiftExt)) {
                fileName = fileName.substring(0, fileName.length - swiftExt.length);
            }
            
            const matches = await context.fileSystem.findFiles(`**/${fileName}${swiftExt}`);
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

    const pkgRoot = context.fileSystem.joinPathUri(pkgPath, "..");

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
