import * as assert from 'assert';
import * as vscode from 'vscode';
import { Configuration } from '../../../data/configurations/configuration';
import { makeTestContext, TestContext, TestVscodeWorkspaceEdit } from '../testMocks/testContext';
import { SwiftPackageManifest, SwiftTarget, TargetType } from '../../../data/swiftPackage';
import { groupBy } from '../../../algorithms/groupBy';
import path = require('path');

export type ShowFileArguments = [fileUri: vscode.Uri | string, options?: vscode.TextDocumentShowOptions];

export interface WorkspaceExpectedFileArguments {
    uri: vscode.Uri | string
    fileContents?: string
    needsConfirmation?: boolean
};

/**
 * A test fixture that is setup with mocked interfaces, and can be used to run
 * commands, collecting the resulting interface interactions and exposing assertion
 * functions for testing the recorded behavior.
 */
export class FullTestFixture {
    context: TestContext;

    constructor(fileList: (string | vscode.Uri)[], configuration?: Configuration, stubPackage?: SwiftPackageManifest) {
        const context = makeTestContext(configuration);
        context.packageProvider.stubPackage = stubPackage;
        context.fileSystem.virtualFileDisk.createEntries(fileList);

        // Automatically try to stub package paths
        if (stubPackage) {
            for (const file of context.fileSystem.virtualFileDisk.allFilesRecursiveRoot()) {
                if (file.name !== "Package.swift") {
                    continue;
                }

                const fullPath = file.fullPath(context.fileSystem.virtualFileDisk.pathSeparator());
                let existingList = context.packageProvider.stubPackageList;
                if (!existingList) {
                    existingList = [[fullPath, stubPackage]];
                } else {
                    existingList.push([fullPath, stubPackage]);
                }

                context.packageProvider.stubPackageList = existingList;
            }
        }

        // -

        this.context = context;
    }

    /** Asserts that no mutating actions have been performed on a given test context. */
    assertNoActions(): FullTestFixture {
        assert.strictEqual(this.context.workspace.saveOpenedDocument_calls.length, 0);
        assert.strictEqual(this.context.workspace.showTextDocument_calls.length, 0);

        if (this.context.workspace.makeWorkspaceEdit_calls.length > 0) {
            const calls = this.context.workspace.makeWorkspaceEdit_calls;

            for (const call of calls) {
                assert.strictEqual(call.createFile_calls.length, 0);
                assert.strictEqual(call.replaceDocumentText_calls.length, 0);
            }
        }

        return this;
    }

    /**
     * Asserts that a given list of files have been requested to be shown in a
     * given test context.
     */
    assertShownFiles(...expected: ShowFileArguments[]): FullTestFixture {
        // Map down to avoid comparing vscode.Uri by reference
        function _map(entry: ShowFileArguments): [filePath: string, options?: vscode.TextDocumentShowOptions] {
            if (typeof entry[0] === "string") {
                return [vscode.Uri.file(entry[0]).fsPath, entry[1]];
            }

            return [entry[0].fsPath, entry[1]];
        }

        assert.strictEqual(this.context.workspace.showTextDocument_calls.length, expected.length);

        assert.deepStrictEqual(
            this.context.workspace.showTextDocument_calls.map(_map),
            expected.map(_map)
        );

        return this;
    }

    /** 
     * Asserts no information, warning or error dialogs have been displayed on
     * this test fixture's context.
     */
    assertNoMessageDialogs(): FullTestFixture {
        assert.deepStrictEqual(this.context.workspace.showInformationMessage_calls, []);

        return this.assertNoWarningsOrErrors();
    }

    /** 
     * Asserts no warning or error dialogs have been displayed on this test
     * fixture's context.
     */
    assertNoWarningsOrErrors(): FullTestFixture {
        assert.deepStrictEqual(this.context.workspace.showErrorMessage_calls, []);
        assert.deepStrictEqual(this.context.workspace.showWarningMessage_calls, []);

        return this;
    }

    /**
     * Asserts that no calls to fetch package manifests from disk where issued
     * to this text fixture's context.
     */
    assertNoPackageManifestQueries(): FullTestFixture {
        assert.deepStrictEqual(this.context.packageProvider.swiftPackageManifestForFile_calls, []);
        assert.deepStrictEqual(this.context.packageProvider.swiftPackagePathManagerForFile_calls, []);

        return this;
    }

    /**
     * Asserts that the combination of all workspace edit requests combined
     * result in a given set of new files with their respective string contents.
     */
    assertWorkspaceEditsMatchUnordered(expectedFiles: WorkspaceExpectedFileArguments[]): FullTestFixture {
        const wsEdits = this.context.workspace.makeWorkspaceEdit_calls.flat();

        return this._assertAllWorkspaceEditsMatchUnordered(wsEdits, expectedFiles);
    }

    private _assertAllWorkspaceEditsMatchUnordered(wsEdits: TestVscodeWorkspaceEdit[], expectedFiles: WorkspaceExpectedFileArguments[]): FullTestFixture {
        const filesCreated = wsEdits.flatMap(ws => ws.createFile_calls);
        const textReplaced = wsEdits.flatMap(ws => ws.replaceDocumentText_calls);

        const textReplaceByFileUri = groupBy(textReplaced, (file) => {
            return file[0];
        });

        assert.strictEqual(filesCreated.length, expectedFiles.length);
        if (filesCreated.length !== expectedFiles.length) {
            return this;
        }

        for (let index = expectedFiles.length - 1; index >= 0; index--) {
            const {
                uri: expectedFile,
                fileContents: expectedContents,
                needsConfirmation
            } = expectedFiles[index];

            const expectedFilePath = expectedFile instanceof vscode.Uri ? expectedFile : vscode.Uri.file(expectedFile);
            const filesCreatedIndex = filesCreated.findIndex(f => f[0].fsPath === expectedFilePath.fsPath);
            if (filesCreatedIndex === -1) {
                assert.fail(
                    `Expected to find file created at path ${expectedFile} but found none!`
                );
            }
            const [fileCreated, _, metadata] = filesCreated[filesCreatedIndex];
            filesCreated.splice(filesCreatedIndex, 1);

            if (needsConfirmation !== undefined) {
                assert.strictEqual(
                    metadata?.needsConfirmation,
                    needsConfirmation,
                    `Expected needsConfirmation of ${needsConfirmation} does not match actual value of ${metadata?.needsConfirmation} for file ${fileCreated.fsPath}!`
                );
            }

            if (expectedContents) {
                const fileReplaces = textReplaceByFileUri.get(fileCreated);
                if (!fileReplaces || fileReplaces.length === 0) {
                    assert.fail(
                        `Expected to find text replace entry for file ${expectedFile} with contents: ${expectedContents} but found none.`
                    );
                }

                const fileReplace = fileReplaces[fileReplaces.length - 1];
    
                assert.strictEqual(fileReplace[1], expectedContents);
            }
        }

        // Assert on unaccounted files
        if (filesCreated.length > 0) {
            const uris = filesCreated.map((file) => file[0]);

            assert.fail(
                `Found ${filesCreated.length} file(s) unaccounted for: ${uris}`
            );
        }

        return this;
    }
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

/** Helper function for generating an expected templated test file string. */
export function makeExpectedTestFileContentString(targetName: string, testName: string): string {
    return `import XCTest

@testable import ${targetName}

class ${testName}: XCTestCase {

}
`;
}
