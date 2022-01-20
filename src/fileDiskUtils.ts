import * as vscode from "vscode";

/**
 * Returns `true` if a given Uri points to a directory on disk.
 */
export async function isDirectoryUri(uri: vscode.Uri): Promise<boolean> {
    const stat = await vscode.workspace.fs.stat(uri);

    return stat.type === vscode.FileType.Directory;
}

/**
 * Returns `true` if a given Uri points to an existing file on disk.
 * 
 * Returns `false` if path exists but is not a file, or on IO error.
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        
        return stat.type === vscode.FileType.File;
    } catch {
        return false;
    }
}
