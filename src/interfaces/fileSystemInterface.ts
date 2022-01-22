import * as vscode from 'vscode';

/** Represents an interface for a file system handler. */
export interface FileSystemInterface {
    /**
     * Finds files in the current workspace environment.
     */
    findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null | undefined, maxResults?: number | undefined, token?: vscode.CancellationToken | undefined): Promise<vscode.Uri[]>;

    /**
     * Returns `true` if a given Uri points to an existing file on disk.
     * 
     * Returns `false` if path exists but is not a file, or on IO error.
     */
    fileExists(uri: vscode.Uri): Promise<boolean>;

    /**
     * Returns `true` if a given Uri points to a directory on disk.
     * 
     * Returns `false` if path exists but is not a file, or on IO error.
     */
    isDirectoryUri(uri: vscode.Uri): Promise<boolean>;

    /**
     * Requests that a uri representation be joined.
     */
    joinPathUri(uri: vscode.Uri, ...components: string[]): vscode.Uri
}
