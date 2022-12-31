import path = require('path');
import * as vscode from 'vscode';
import { VscodeWorkspaceInterface } from '../interfaces/vscodeWorkspaceInterface';

/**
 * Represents a diagnostics generated by proposeTestFiles.
 */
export interface TestFileDiagnosticResult {
    /** Diagnostic message. */
    message: string;

    /** File path that triggered diagnostic message, if any. */
    sourceFile?: vscode.Uri;

    /** Identifier for diagnostic kind. */
    kind: TestFileDiagnosticKind
}

/** Describes a type that contains a list of diagnostics attached to it. */
export type OperationWithDiagnostics<T> = T & { diagnostics: TestFileDiagnosticResult[] };

/**
 * Describes the intersection between an operation's results, or a list of
 * diagnostics.
 */
export type FallibleOperation<T> = T | { diagnostics: TestFileDiagnosticResult[] };

export enum TestFileDiagnosticKind {
    /** An input file was not located in a recognized Sources folder. */
    fileNotInSourcesFolder,

    /** An input file was not located in a recognized Tests folder. */
    fileNotInTestsFolder,

    /** An input test file path was not in a recognized test file name pattern. */
    unrecognizedTestFileNamePattern,

    /** A package manifest for an input file was not found. */
    packageManifestNotFound,

    /** A folder for the sources of a package was not found. */
    sourcesFolderNotFound,

    /** A folder for the tests of a package was not found. */
    testsFolderNotFound,

    /** For Go to Test File command: Indicates that a provided heuristic pattern is incorrect. */
    incorrectSearchPattern,

    /** For Go to Test File command: Indicates that a provided heuristic pattern contains special characters that are not allowed. */
    specialCharactersInSearchPattern,

    /** For Go to Test File command: Indicates that a file is already a test file. */
    alreadyInTestFile,
};

export function emitDiagnostics(diagnostics: TestFileDiagnosticResult[], workspace: VscodeWorkspaceInterface) {
    function showDiagnosticsForFiles(message: string, files: vscode.Uri[], severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning) {
        const filePaths = files.map((file) => {
            return path.basename(file.fsPath);
        });

        const truncateListAt = 2;

        const filePathTruncatedList = filePaths.slice(0, truncateListAt).join("\n");

        let filePathList = filePathTruncatedList;
        const truncated = filePaths.length - truncateListAt;
        if (truncated > 0) {
            filePathList = filePathList.concat(`\n...and ${truncated} more`);
        }

        _showMessage(`${message}\n${filePathList}`, severity, workspace);
    }

    function showDiagnosticsForKind(message: string, kind: TestFileDiagnosticKind, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning) {
        const filtered = diagnostics.filter(diagnostic => diagnostic.kind === kind);
        diagnostics = diagnostics.filter(diagnostic => diagnostic.kind !== kind);

        if (filtered.length === 0) {
            return;
        }

        const filePaths = filtered.flatMap((file) => {
            if (file.sourceFile) {
                return [file.sourceFile];
            }

            return [];
        });

        showDiagnosticsForFiles(
            message,
            filePaths,
            severity
        );
    }

    showDiagnosticsForKind(
        `One or more files where not contained within a recognized Sources/ folder:`,
        TestFileDiagnosticKind.fileNotInSourcesFolder,
        vscode.DiagnosticSeverity.Warning
    );

    // Show remaining diagnostics, one at a time
    for (const diagnostic of diagnostics) {
        const severity = _severityForDiagnosticKind(diagnostic.kind);

        _showMessage(diagnostic.message, severity, workspace);
    }
}

function _severityForDiagnosticKind(kind: TestFileDiagnosticKind): vscode.DiagnosticSeverity {
    switch (kind) {
        case TestFileDiagnosticKind.packageManifestNotFound:
        case TestFileDiagnosticKind.specialCharactersInSearchPattern:
            return vscode.DiagnosticSeverity.Error;

        case TestFileDiagnosticKind.incorrectSearchPattern:
        case TestFileDiagnosticKind.fileNotInSourcesFolder:
        case TestFileDiagnosticKind.fileNotInTestsFolder:
        case TestFileDiagnosticKind.unrecognizedTestFileNamePattern:
        case TestFileDiagnosticKind.sourcesFolderNotFound:
        case TestFileDiagnosticKind.testsFolderNotFound:
            return vscode.DiagnosticSeverity.Warning;

        case TestFileDiagnosticKind.alreadyInTestFile:
            return vscode.DiagnosticSeverity.Information;
    }
}

async function _showMessage(message: string, severity: vscode.DiagnosticSeverity, workspace: VscodeWorkspaceInterface): Promise<void> {
    switch (severity) {
        case vscode.DiagnosticSeverity.Warning:
            await workspace.showWarningMessage(message);
            break;

        case vscode.DiagnosticSeverity.Error:
            await workspace.showErrorMessage(message);
            break;

        default:
            await workspace.showInformationMessage(message);
            break;
    }
}
