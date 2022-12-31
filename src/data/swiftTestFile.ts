import * as vscode from 'vscode';
import { SwiftFile } from './swiftFile';

/**
 * Represents a Swift test file and its contents.
 */
export interface SwiftTestFile extends SwiftFile {
    /** Path for original source file this test file is mirroring. */
    originalFile: vscode.Uri;

    /** List of suggested module imports for this file. */
    suggestedImports: string[];
}
