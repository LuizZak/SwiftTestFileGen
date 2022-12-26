import * as vscode from 'vscode';
import { FileSystemInterface } from '../interfaces/fileSystemInterface';
import { SwiftToolchainInterface } from '../interfaces/swiftToolchainInterface';

export class SwiftFileSyntaxHelper {
    constructor(public fileUri: vscode.Uri, public fileSystem: FileSystemInterface, public toolchain: SwiftToolchainInterface) {

    }

    async fileContents(): Promise<string> {
        return this.fileSystem.contentsOfFile(this.fileUri);
    } 

    /**
     * Returns a list of imported module names found on the source file.
     */
    async parseModuleImports(): Promise<string[]> {
        // Attempt parse dump first
        try {
            const dumpParse = await this.attemptDumpParse();

            return this.importDeclarationsIn(dumpParse);
        } catch {
            const fileContents = await this.fileContents();
            
            const moduleImport = /import\s+((?:\w+\.?)+)\s*(;|\n)/g;
            const symbolImport = /import\s+(?:typealias|struct|class|enum|protocol|let|var|func)\s+((?:\w+\.?))+(?:\.\w+)\s*(;|\n)/g;
            
            let result: ({ module: string, offset: number })[] = [];

            for (const match of fileContents.matchAll(moduleImport)) {
                result.push({
                    module: match[1],
                    offset: match.index ?? 0
                });
            }
            for (const match of fileContents.matchAll(symbolImport)) {
                result.push({
                    module: match[1],
                    offset: match.index ?? 0
                });
            }
        
            return result.sort((a, b) => a.offset - b.offset).map((v) => v.module);
        }
    }

    private async attemptDumpParse(): Promise<string> {
        const result = await this.toolchain.dumpSwiftAst(this.fileUri);

        return result;
    }

    private importDeclarationsIn(dumpParse: string): string[] {
        // (import_decl range=[/home/luiz/dev/SwiftRewriter/Sources/Frontend/JavaScript/JsParser/JsParser.swift:6:1 - line:6:21] kind=class 'Antlr4.Parser')
        const regex = /\(import_decl \)/;

        const result: string[] = [];
        
        for (const match of dumpParse.matchAll(regex)) {
            result.push(match[1]);
        }

        return result;
    }
}
