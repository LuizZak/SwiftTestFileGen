import { TextDecoder } from 'util';
import * as vscode from 'vscode';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';

export class FileSystem implements FileSystemInterface {
    async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            
            return stat.type === vscode.FileType.File;
        } catch {
            return false;
        }
    }

    async findFiles(include: vscode.GlobPattern, exclude?: vscode.GlobPattern | null, maxResults?: number, token?: vscode.CancellationToken): Promise<vscode.Uri[]> {
        return vscode.workspace.findFiles(include, exclude, maxResults, token);
    }

    async isDirectoryUri(uri: vscode.Uri): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);

            return stat.type === vscode.FileType.Directory;
        } catch {
            return false;
        }
    }

    async contentsOfFile(uri: vscode.Uri): Promise<string> {
        const contents = await vscode.workspace.fs.readFile(uri);

        return new TextDecoder().decode(contents);
    }

    /**
     * Requests that a uri representation be joined.
     * 
     * @deprecated Use `vscode.Uri.joinPath` instead.
     */
    joinPathUri(uri: vscode.Uri, ...components: string[]): vscode.Uri {
        return vscode.Uri.joinPath(uri, ...components);
    }
}
