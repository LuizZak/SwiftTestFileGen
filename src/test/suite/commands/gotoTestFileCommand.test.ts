import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { gotoTestFileCommand } from '../../../commands/gotoTestFileCommand';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';
import { assertNoActions, assertShownFiles, fileUri, fileUris, setupTest, stubPackage } from './commandTestUtils';

suite('gotoTestFileCommand Test Suite', () => {
    describe('gotoTestFileCommand', () => {
        // TODO: Test create test file prompt path.

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
            const files = fileUris(
                "/home/Tests/TargetTests/B.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/B.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            assertNoActions(context);
        });
    });
});
