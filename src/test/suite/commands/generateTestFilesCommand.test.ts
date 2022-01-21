import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe } from 'mocha';
import path = require('path');
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { Configuration } from '../../../data/configurations/configuration';
import { makeTestContext, TestContext } from '../testMocks/testContext';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';

suite('generateTestFilesCommand Test Suite', () => {
    describe('generateTestFilesCommand', () => {
        test('', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
            );
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
                "/home/Tests/TargetTests/",
            ]);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            const wsEdit = context.workspace.applyWorkspaceEdit_calls[0][0];
            const entries = wsEdit.entries();

            assertWorkspaceEditMatchesUnordered(wsEdit, [
                [fileUri("/home/Tests/TargetTests/ATests.swift"), ""],
                [fileUri("/home/Tests/TargetTests/BTests.swift"), ""],
            ]);
        });
    });
});

function setupTest(fileList: (string | vscode.Uri)[], configuration?: Configuration): TestContext {
    const context = makeTestContext(configuration);

    for (const file of fileList) {
        // Detect directory paths by a trailing slash
        if (typeof file === "string" && file.endsWith("/")) {
            context.fileSystem.virtualFileDisk.createDirectory(file);
        } else {
            context.fileSystem.virtualFileDisk.createFile(file);
        }
    }

    return context;
}

function fileUris(...filePaths: string[]): vscode.Uri[] {
    return filePaths.map(fileUri);
}

function fileUri(filePath: string): vscode.Uri {
    return vscode.Uri.file(filePath);
}

function assertWorkspaceEditMatchesUnordered(wsEdit: vscode.WorkspaceEdit, expectedFiles: [uri: vscode.Uri, fileContents: string][]) {
    const entries = wsEdit.entries();
    
    assert.strictEqual(entries.length, expectedFiles.length);
    if (entries.length !== expectedFiles.length) {
        return;
    }

    for (const expectedFile of expectedFiles) {
        for (const [fileUri, textEdits] of entries) {
            if (fileUri.fsPath === expectedFile[0].fsPath) {
                
            }
        }
    }
}
