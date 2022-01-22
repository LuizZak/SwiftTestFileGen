import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { gotoTestFileCommand } from '../../../commands/gotoTestFileCommand';
import { assertNoActions, assertShownFiles, assertWorkspaceEditMatchesUnordered, fileUri, setupTest, stubPackage } from './commandTestUtils';
import assert = require('assert');

suite('gotoTestFileCommand Test Suite', () => {
    describe('gotoTestFileCommand', () => {
        it('should open existing test files', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift"
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/ATests.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, context);
            
            assertShownFiles(context,
                ["/home/Tests/TargetTests/ATests.swift", {viewColumn: vscode.ViewColumn.Active}],
            );
        });

        it('should do nothing for files not in recognized sources folder', async () => {
            const file = fileUri(
                "/home/A.swift"
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/A.swift",
                "/B.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, context);

            assertNoActions(context);
        });

        it('should do nothing for files in test folders', async () => {
            const file = fileUri(
                "/home/Tests/TargetTests/B.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/B.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, context);

            assertNoActions(context);
        });

        it('should present the option of creating a test file, if none is found.', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);
            context.workspace.showInformationMessage_stub = async (_message, ...items) => {
                assert.deepStrictEqual(items, [
                    "Yes",
                    "No"
                ]);

                return "Yes";
            };

            await gotoTestFileCommand(file, context);

            const wsEdit = context.workspace.makeWorkspaceEdit_calls[0];
            assert.notStrictEqual(wsEdit, undefined);
            assertWorkspaceEditMatchesUnordered(wsEdit, [
                ["/home/Tests/TargetTests/ATests.swift", `import XCTest

@testable import Target

class ATests: XCTestCase {

}
`]
            ]);
            assertShownFiles(context, ['/home/Tests/TargetTests/ATests.swift']);
        });

        it('should not create a file when none is found, if the user chooses not to.', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);
            context.workspace.showInformationMessage_stub = async (_message, ...items) => {
                assert.deepStrictEqual(items, [
                    "Yes",
                    "No"
                ]);

                return "No";
            };

            await gotoTestFileCommand(file, context);

            assertNoActions(context);
        });
    });
});
