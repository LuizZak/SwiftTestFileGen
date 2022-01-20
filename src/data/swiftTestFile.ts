import * as vscode from 'vscode';

/**
 * Represents a Swift test file and its contents.
 */
export interface SwiftTestFile {
    /** File name, including extension. */
    name: string;

    /** Full file path. */
    path: vscode.Uri;

    /** Path for original source file this test file is mirroring. */
    originalFile: vscode.Uri;

    /** Contents of file. */
    contents: string;
}
