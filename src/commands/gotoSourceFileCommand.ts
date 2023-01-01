import path = require('path');
import * as vscode from 'vscode';
import * as pathUtils from '../pathUtils';
import { emitDiagnostics, OperationWithDiagnostics, TestFileDiagnosticKind, TestFileDiagnosticResult } from '../data/testFileDiagnosticResult';
import { InvocationContext } from '../interfaces/context';
import { NestableProgress } from '../progress/nestableProgress';
import { SourceToTestFileMapper } from '../implementations/sourceToTestFileMapper';

export async function gotoSourceFileCommand(
    fileUri: vscode.Uri,
    context: InvocationContext,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.Active,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<void> {

    const result = await performFileSearch(fileUri, context, progress, cancellation);

    // Emit diagnostics
    emitDiagnostics(result.diagnostics, context.workspace);

    if (result.fileUri && await context.fileSystem.fileExists(result.fileUri)) {
        await context.workspace.showTextDocument(result.fileUri, { viewColumn });
    } else {
        await context.workspace.showInformationMessage(
            `Source file for ${path.basename(fileUri.fsPath)} not found!`
        );
    }

    progress?.complete();
}

type SourceFileSearchResult = OperationWithDiagnostics<{ fileUri: vscode.Uri | null }>;

async function performFileSearch(
    fileUri: vscode.Uri,
    context: InvocationContext,
    progress?: NestableProgress,
    cancellation?: vscode.CancellationToken
): Promise<SourceFileSearchResult> {
    
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

            if (results.fileUri) {
                return results;
            }
        }
    }

    progress?.reportMessage("Finding Swift package...");

    if (cancellation?.isCancellationRequested) {
        throw new vscode.CancellationError();
    }

    const pkg = await context.packageProvider.swiftPackagePathManagerForFile(
        fileUri,
        cancellation
    );

    const pathMapper = new SourceToTestFileMapper(pkg);

    const result = await pathMapper.suggestedSourcePathFor(fileUri);

    return {
        fileUri: result.transformedPath,
        diagnostics: result.diagnostics,
    };
}

async function performHeuristicSearch(
    fileUri: vscode.Uri,
    patterns: string[],
    context: InvocationContext
): Promise<SourceFileSearchResult> {

    const diagnostics: TestFileDiagnosticResult[] = [];

    const swiftExt = ".swift";
    const baseName = path.basename(fileUri.fsPath, swiftExt);

    const placeholder = "$1";
    const placeholderRegex = /\$1/;

    for (let pattern of patterns) {
        const placeholderMatches = placeholderRegex.exec(pattern);
        
        if (!placeholderMatches || placeholderMatches.length !== 1) {
            diagnostics.push({
                message: `Found test file search pattern that does not contain exactly one copy of '${placeholder}' placeholder : ${pattern}`,
                kind: TestFileDiagnosticKind.incorrectSearchPattern,
            });

            continue;
        }

        // Correct patterns with an extra .swift extension
        if (pattern.endsWith(swiftExt)) {
            pattern = pattern.slice(0, pattern.length - swiftExt.length);
        }

        let fileName = reversePlaceholder(pattern, placeholder, baseName);
        if (!fileName) {
            continue;
        }

        if (fileName !== pathUtils.sanitizeFilename(fileName)) {
            fileName = pathUtils.sanitizeFilename(fileName);

            diagnostics.push({
                message: `Found test file search pattern that does not resolve to a simple filename (i.e. contains special characters not allowed in file names): ${pattern}`,
                kind: TestFileDiagnosticKind.specialCharactersInSearchPattern,
            });
        }

        const matches = await context.fileSystem.findFiles(`**/${fileName}${swiftExt}`);
        if (matches.length > 0) {
            return {
                fileUri: matches[0],
                diagnostics: diagnostics
            };
        }
    }

    return {
        fileUri: null,
        diagnostics: diagnostics,
    };
}

function reversePlaceholder(pattern: string, placeholder: string, baseName: string): string | null {
    function removingPrefix(text: string, prefix: string): string | null {
        if (!text.startsWith(prefix)) {
            return null;
        }
        
        return text.slice(prefix.length);
    }
    function removingSuffix(text: string, suffix: string): string | null {
        if (!text.endsWith(suffix)) {
            return null;
        }
        
        return text.slice(0, text.length - suffix.length);
    }

    // Patterns that match exact file names
    if (pattern === placeholder) {
        return baseName;
    }

    const splitPattern = pattern.split(placeholder).filter(s => s.length > 0);
    if (splitPattern.length < 1) {
        // No placeholders in pattern?
        return null;
    }

    // Pattern is in the form '$1<suffix>'
    if (pattern.startsWith(placeholder)) {
        return removingSuffix(baseName, splitPattern[0]);
    }
    // Pattern is in the form '<prefix>$1'
    if (pattern.endsWith(placeholder)) {
        return removingPrefix(baseName, splitPattern[0]);
    }

    // Otherwise, pattern is in the form '<prefix>$1<suffix>'
    if (splitPattern.length !== 2) {
        return null;
    }

    let result = removingPrefix(baseName, splitPattern[0]);
    if (!result) {
        return null;
    }

    return removingSuffix(result, splitPattern[1]);
}
