import * as vscode from 'vscode';

/**
 * Represents a Swift input file and its contents, from which a unit test file
 * can be generated from.
 */
export interface SwiftFile {
    /** File name, including extension. */
    name: string;

    /** Full file path. */
    path: vscode.Uri;

    /** Contents of file. */
    contents: string;

    /** Whether this file exists on disk or is a memory-only temporary file. */
    existsOnDisk: boolean;
}
