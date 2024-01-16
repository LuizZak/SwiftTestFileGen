import * as vscode from 'vscode';

/**
 * `vscode.Uri.file` alias that does no pre-caching of internal properties. Used
 * by tests that require the value to be equal during `assert.strictEqual` and
 * `assert.deepStrictEqual`.
 *
 * This function is simply an alias for `vscode.Uri.file(<input>)`.
 */
export function vscodeUriFile(input: string): vscode.Uri {
    const path = vscode.Uri.file(input);
    return vscode.Uri.file(input);
}

/**
 * `vscode.Uri.file` alias that pre-caches the internal `_fsPath` property. Used
 * by tests that require the value to be equal during `assert.strictEqual` and
 * `assert.deepStrictEqual`.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function vscodeUriFile_fsPath(input: string): vscode.Uri {
    const path = vscode.Uri.file(input);
    path.fsPath;

    return path;
}

/**
 * `vscode.Uri.file` alias that pre-caches the internal `_formatted` property.
 * Used by tests that require the value to be equal during `assert.strictEqual`
 * and `assert.deepStrictEqual`.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function vscodeUriFile_formatted(input: string): vscode.Uri {
    const path = vscode.Uri.file(input);
    path.toString();

    return path;
}

/**
 * `vscode.Uri.file` alias that pre-caches the internal `_formatted` and `_fsPath`
 * properties.
 * Used by tests that require the value to be equal during `assert.strictEqual`
 * and `assert.deepStrictEqual`.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function vscodeUriFile_formatted_fsPath(input: string): vscode.Uri {
    const path = vscode.Uri.file(input);
    path.toString();
    path.fsPath;

    return path;
}
