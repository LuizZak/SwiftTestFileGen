import * as assert from 'assert';
import * as vscode from 'vscode';
import { Configuration } from '../../../data/configurations/configuration';
import { makeTestContext, TestContext, TestVscodeWorkspaceEdit } from '../testMocks/testContext';
import { SwiftPackageManifest, SwiftTarget, TargetType } from '../../../data/swiftPackage';
import { groupBy } from '../../../groupBy';

export function setupTest(fileList: (string | vscode.Uri)[], configuration?: Configuration, stubPackage?: SwiftPackageManifest): TestContext {
    const context = makeTestContext(configuration);
    context.packageProvider.stubPackage = stubPackage;

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

export function stubPackage(targets: SwiftTarget[] = [{ name: "Target", type: TargetType.Regular }, { name: "TargetTests", type: TargetType.Test }]): SwiftPackageManifest {
    return {
        name: "PackageName",
        targets: targets,
        toolsVersion: {
            _version: "5.4.0",
        },
    };
}

export function fileUris(...filePaths: string[]): vscode.Uri[] {
    return filePaths.map(fileUri);
}

export function fileUri(filePath: string): vscode.Uri {
    return vscode.Uri.file(filePath);
}

/** Asserts that no mutating actions have been performed on a given test context. */
export function assertNoActions(context: TestContext) {
    assert.strictEqual(context.workspace.saveOpenedDocument_calls.length, 0);
    assert.strictEqual(context.workspace.showTextDocument_calls.length, 0);

    if (context.workspace.makeWorkspaceEdit_calls.length > 0) {
        const calls = context.workspace.makeWorkspaceEdit_calls;

        for (const call of calls) {
            assert.strictEqual(call.createFile_calls.length, 0);
            assert.strictEqual(call.replaceDocumentText_calls.length, 0);
        }
    }
}

export type ShowFileArguments = [fileUri: vscode.Uri | string, options?: vscode.TextDocumentShowOptions];
/** Asserts that a given list of files have been requested to be shown in a given test context. */
export function assertShownFiles(context: TestContext, ...expected: ShowFileArguments[]) {
    // Map down to avoid comparing vscode.Uri by reference
    function _map(entry: ShowFileArguments): [filePath: string, options?: vscode.TextDocumentShowOptions] {
        if (typeof entry[0] === "string") {
            return [entry[0], entry[1]];
        }

        return [entry[0].fsPath, entry[1]];
    }

    assert.strictEqual(context.workspace.showTextDocument_calls.length, expected.length);

    assert.deepStrictEqual(
        context.workspace.showTextDocument_calls.map(_map),
        expected.map(_map)
    );
}

export function assertWorkspaceEditMatchesUnordered(wsEdit: TestVscodeWorkspaceEdit, expectedFiles: [uri: vscode.Uri, fileContents: string][]) {
    const filesCreated = wsEdit.createFile_calls;
    const textReplaced = wsEdit.replaceDocumentText_calls;

    const textReplaceByFileUri = groupBy(textReplaced, (file) => {
        return file[0];
    });

    assert.strictEqual(filesCreated.length, expectedFiles.length);
    if (filesCreated.length !== expectedFiles.length) {
        return;
    }

    for (const [expectedFile, expectedContents] of expectedFiles) {
        const index = filesCreated.findIndex(f => f[0].fsPath === expectedFile.fsPath);
        if (index === -1) {
            continue;
        }
        const [fileCreated,] = filesCreated[index];

        const fileReplaces = textReplaceByFileUri.get(fileCreated);
        if (!fileReplaces || fileReplaces.length === 0) {
            assert.fail(
                `Expected to find text replace entry for file ${fileUri} with contents: ${expectedContents} but found none.`
            );
        }

        const fileReplace = fileReplaces[fileReplaces.length - 1];

        assert.strictEqual(fileReplace[1], expectedContents);
    }
}
