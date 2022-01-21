import path = require('path');
import * as vscode from 'vscode';

/**
 * Represents a diagnostics generated by proposeTestFiles.
 */
export interface TestFileDiagnosticResult {
    /** Diagnostic message. */
    message: string;

    /** File path that triggered diagnostic message, if any. */
    sourceFile: vscode.Uri | null;

    /** Identifier for diagnostic kind. */
    kind: TestFileDiagnosticKind
}

export enum TestFileDiagnosticKind {
    fileNotInSourcesFolder
};

export function emitDiagnostics(diagnostics: TestFileDiagnosticResult[]) {
    // Collapse diagnostic for files not in Sources/ directory
    const filesNotInSources = diagnostics.filter(diagnostic => {
        return diagnostic.kind === TestFileDiagnosticKind.fileNotInSourcesFolder;
    });

    if (filesNotInSources.length > 0) {
        const filePaths = filesNotInSources.flatMap((file) => {
            if (typeof file.sourceFile?.fsPath === "string") {
                return [
                    path.basename(file.sourceFile.fsPath)
                ];
            }

            return [];
        });

        const truncateListAt = 2;

        const filePathTruncatedList = filePaths.slice(0, truncateListAt).join("\n");
        
        let filePathList = filePathTruncatedList;
        const truncated = filePaths.length - truncateListAt;
        if (truncated > 0) {
            filePathList = filePathList.concat(`\n...and ${truncated} more`);
        }

        vscode.window.showWarningMessage(
            `One or more files where not contained within a recognized Sources/ folder:\n${filePathList}`,
        );
    }
}
