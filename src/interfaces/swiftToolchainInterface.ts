import * as vscode from 'vscode';

/** Interface for interacting with the underlying Swift toolchain on the system. */
export interface SwiftToolchainInterface {
    /**
     * Requests a 'swift package dump-package' for a package on a given directory.
     */
    dumpPackage(packageRootUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<string>;

    /**
     * Requests a 'swiftc -dump-parse <fileUri>' for a given Swift source file path.
     */
    dumpSwiftAst(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<string>;
}
