import * as vscode from 'vscode';

/**
 * Returns a promise that stalls for a provided number of seconds before succeeding.
 * If the provided cancellation token is cancelled, the promise ends with an
 * error, instead.
 */
export async function waitSeconds(seconds: number, cancellation?: vscode.CancellationToken): Promise<void> {
    console.log(`[DEBUG] debugUtils.waitSeconds(): Awaiting for ${seconds} seconds...`);

    const milliseconds = seconds * 1000;

    return new Promise((resolve, reject) => {
        cancellation?.onCancellationRequested(() => {
            reject(new vscode.CancellationError());
        });
        
        setTimeout(() => {
            resolve();
        }, milliseconds);
    });
}
