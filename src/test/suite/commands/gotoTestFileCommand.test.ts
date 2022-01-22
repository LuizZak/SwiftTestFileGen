import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { gotoTestFileCommand } from '../../../commands/gotoTestFileCommand';
import { assertNoActions, assertNoMessageDialogs, assertShownFiles, assertWorkspaceEditMatchesUnordered, fileUri, setupTest, stubPackage } from './commandTestUtils';
import assert = require('assert');
import { Configuration } from '../../../data/configurations/configuration';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';

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

        describe("with heuristics enabled", () => {
            const configuration: Configuration = {
                fileGen: {
                    confirmation: ConfirmationMode.always,
                },
                gotoTestFile: {
                    useFilenameHeuristics: true,
                    heuristicFilenamePattern: "$1TestFile.swift",
                }
            };

            it('should use a provided pattern', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const context = setupTest([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);
    
                await gotoTestFileCommand(file, context);
                
                assertShownFiles(context,
                    ["/home/Tests/TargetTests/ATestFile.swift", {viewColumn: vscode.ViewColumn.Active}],
                );
            });

            it('should not issue any messages for files that are found', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const context = setupTest([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);
    
                await gotoTestFileCommand(file, context);
                
                assertNoMessageDialogs(context);
            });

            it('should not query for a package if a heuristic finds a hit', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const context = setupTest([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);
    
                await gotoTestFileCommand(file, context);
                
                assert.deepStrictEqual(context.packageProvider.swiftPackageManifestForFile_calls, []);
            });

            it('should attempt patterns in order of appearance until one matches', async () => {
                configuration.gotoTestFile.heuristicFilenamePattern = [
                    "$1TestFile.swift",
                    "$1Spec.swift",
                    "$1Tests.swift",
                ];

                const context = setupTest([
                    "/home/Sources/Target/A.swift",
                    "/home/Sources/Target/B.swift",
                    "/home/Sources/Target/C.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                    "/home/Tests/TargetTests/BSpec.swift",
                    "/home/Tests/TargetTests/CTests.swift",
                ], configuration);
    
                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/A.swift"
                ), context);
                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/B.swift"
                ), context);
                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/C.swift"
                ), context);
                
                assertShownFiles(context,
                    ["/home/Tests/TargetTests/ATestFile.swift", {viewColumn: vscode.ViewColumn.Active}],
                    ["/home/Tests/TargetTests/BSpec.swift", {viewColumn: vscode.ViewColumn.Active}],
                    ["/home/Tests/TargetTests/CTests.swift", {viewColumn: vscode.ViewColumn.Active}],
                );
            });

            it('should present the option of creating a test file, if none is found, with a default pattern name.', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift",
                );
                const pkg = stubPackage();
                const context = setupTest([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/",
                ], configuration, pkg);
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
                ], configuration, pkg);
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
});
