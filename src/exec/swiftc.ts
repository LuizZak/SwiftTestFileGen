import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import * as vscode from 'vscode';

export async function dumpSwiftAst(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<string> {
    return runSwiftC(["-dump-parse", fileUri.fsPath], cancellation);
}

/** Invoke 'swiftc' with a given list of command line arguments. */
export async function runSwift(args: string[], cancellation?: vscode.CancellationToken, options?: SpawnOptionsWithoutStdio): Promise<string> {
    return run("swift", args, cancellation, options);
}

/** Invoke 'swiftc' with a given list of command line arguments. */
export function runSwiftC(args: string[], cancellation?: vscode.CancellationToken, options?: SpawnOptionsWithoutStdio): Promise<string> {
    return run("swiftc", args, cancellation, options);
} 

function run(exe: string, args: string[] = [], cancellation?: vscode.CancellationToken, options?: SpawnOptionsWithoutStdio): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn(exe, args, options);
    
        let stdout = "";
        proc.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
    
        let stderr = "";
        proc.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
    
        proc.on("close", (code, signal) => {
            if(code === 0) {
                resolve(stdout);
            } else {
                reject(`process exited with code ${code} signal ${signal} stderr: ${stderr}`);
            }
        });

        cancellation?.onCancellationRequested(() => {
            reject(new vscode.CancellationError());

            proc.kill('SIGTERM');
        });
    });
}
