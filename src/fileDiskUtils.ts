import * as vscode from "vscode";

/**
 * Returns `true` if a given Uri points to a directory on disk.
 */
export async function isDirectoryUri(uri: vscode.Uri): Promise<boolean> {
    const stat = await vscode.workspace.fs.stat(uri);

    return stat.type === vscode.FileType.Directory;
}