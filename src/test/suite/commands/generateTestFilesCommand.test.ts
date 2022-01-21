import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe } from 'mocha';
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { Configuration } from '../../../data/configurations/configuration';
import { makeTestContext, TestContext, TestVscodeWorkspaceEdit } from '../testMocks/testContext';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';
import { SwiftPackageManifest, SwiftTarget, TargetType } from '../../../data/swiftPackage';

suite('generateTestFilesCommand Test Suite', () => {
    describe('generateTestFilesCommand', () => {
        test('', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            const wsEdit = context.workspace.makeWorkspaceEdit_calls[0];
            assert.notStrictEqual(wsEdit, undefined);
            assertWorkspaceEditMatchesUnordered(wsEdit, [
                [fileUri("/home/Tests/TargetTests/ATests.swift"), `import XCTest

@testable import Target

class ATests: XCTestCase {

}
`],
                [fileUri("/home/Tests/TargetTests/BTests.swift"), `import XCTest

@testable import Target

class BTests: XCTestCase {

}
`],
            ]);
        });
    });
});

function setupTest(fileList: (string | vscode.Uri)[], configuration?: Configuration, stubPackage?: SwiftPackageManifest): TestContext {
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

function stubPackage(targets: SwiftTarget[] = [{ name: "Target", type: TargetType.Regular }, { name: "TargetTests", type: TargetType.Test }]): SwiftPackageManifest {
    return {
        name: "PackageName",
        targets: targets,
        toolsVersion: {
            _version: "5.4.0",
        },
    };
}

function fileUris(...filePaths: string[]): vscode.Uri[] {
    return filePaths.map(fileUri);
}

function fileUri(filePath: string): vscode.Uri {
    return vscode.Uri.file(filePath);
}

function assertWorkspaceEditMatchesUnordered(wsEdit: TestVscodeWorkspaceEdit, expectedFiles: [uri: vscode.Uri, fileContents: string][]) {
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

function groupBy<K, V>(array: V[], key: (item: V) => K): Map<K, V[]> {
    return array.reduce((prev, item) => {
        const k = key(item);

        const existing = prev.get(k);
        if (!existing) {
            prev.set(k, [item]);
        } else {
            existing.push(item);
        }

        return prev;
    }, new Map());
}
