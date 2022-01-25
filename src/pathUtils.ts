import { assert } from "console";
import path = require("path");
import * as vscode from 'vscode';

/**
 * Returns `true` if `filePath` is a subdirectory or a file of a subdirectory of `base`.
 */
export function isSubdirectory(base: vscode.Uri | string, filePath: vscode.Uri | string): boolean {
    const baseStr = fsPath(base);
    const filePathStr = fsPath(filePath);

    const relative = path.relative(
        baseStr,
        filePathStr
    );

    return relative.length > 0
        && !relative.startsWith('..')
        && !path.isAbsolute(relative);
}

/**
 * Returns the root directory of a relative path.
 * 
 * @param relativePath A path that is not relative (`path.isAbsolute(relativePath) === false`)
 */
export function rootDirectoryOfRelativePath(relativePath: string): string {
    assert(path.isAbsolute(relativePath) === false, "relativePath must not be an absolute path");

    let currentDirectory = relativePath;
    
    while (path.dirname(currentDirectory) !== ".") {
        currentDirectory = path.dirname(currentDirectory);
    }

    return currentDirectory;
}

/** Attempts to perform sanitization of special characters in a filename. */
export function sanitizeFilename(fileName: string): string {
    const parsed = path.parse(fileName);
    return parsed.base;
}

function fsPath(value: vscode.Uri | string): string {
    if (typeof value === "string") {
        return value;
    }

    return value.fsPath;
}
