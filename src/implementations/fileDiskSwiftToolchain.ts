import * as path from 'path';
import * as vscode from 'vscode';
import * as swiftc from '../exec/swiftc';
import { SwiftToolchainInterface } from "../interfaces/swiftToolchainInterface";

export class FileDiskSwiftToolchain implements SwiftToolchainInterface {
    /**
     * Requests a 'swift package dump-package' for a package on a given directory.
     */
    async dumpPackage(packageRootUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<string> {
        const directory = path.dirname(packageRootUri.fsPath);

        return swiftc.runSwift(['package', 'dump-package'], cancellation, { cwd: directory });
    }
    
    /**
     * Requests a 'swiftc -dump-parse <fileUri>' for a given Swift source file path.
     */
    async dumpSwiftAst(fileUri: vscode.Uri, cancellation?: vscode.CancellationToken): Promise<string> {
        return swiftc.runSwiftC(["-dump-parse", fileUri.fsPath], cancellation);
    }
}
