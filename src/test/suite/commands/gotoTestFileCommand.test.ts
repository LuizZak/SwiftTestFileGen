import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { gotoTestFileCommand } from '../../../commands/gotoTestFileCommand';
import { fileUri, FullTestFixture, makeExpectedTestFileContentString, stubPackage } from './fullTestFixture';
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
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/ATests.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, fixture.context);

            fixture.assertShownFiles(
                ["/home/Tests/TargetTests/ATests.swift", { viewColumn: vscode.ViewColumn.Active }],
            );
        });

        it('should do nothing for files not in recognized sources folder', async () => {
            const file = fileUri(
                "/home/A.swift"
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/A.swift",
                "/B.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, fixture.context);

            fixture.assertNoActions();
        });

        it('should do nothing for files in test folders', async () => {
            const file = fileUri(
                "/home/Tests/TargetTests/B.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/B.swift",
            ], undefined, pkg);

            await gotoTestFileCommand(file, fixture.context);

            fixture.assertNoActions();
        });

        it('should present the option of creating a test file, if none is found.', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);
            fixture.context.workspace.showInformationMessage_stub = async (_message, items) => {
                assert.deepStrictEqual(items, [
                    "Yes",
                    "No"
                ]);

                return "Yes";
            };

            await gotoTestFileCommand(file, fixture.context);

            const wsEdit = fixture.context.workspace.makeWorkspaceEdit_calls[0];
            assert.notStrictEqual(wsEdit, undefined);
            fixture
                .assertWorkspaceEditsMatchUnordered([
                    {
                        uri: "/home/Tests/TargetTests/ATests.swift",
                        fileContents: makeExpectedTestFileContentString("Target", "ATests")
                    },
                ])
                .assertShownFiles(['/home/Tests/TargetTests/ATests.swift']);
        });

        it('should not create a file when none is found, if the user chooses not to.', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);
            fixture.context.workspace.showInformationMessage_stub = async (_message, items) => {
                assert.deepStrictEqual(items, [
                    "Yes",
                    "No"
                ]);

                return "No";
            };

            await gotoTestFileCommand(file, fixture.context);

            fixture.assertNoActions();
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
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoTestFileCommand(file, fixture.context);

                fixture.assertShownFiles(
                    ["/home/Tests/TargetTests/ATestFile.swift", { viewColumn: vscode.ViewColumn.Active }],
                );
            });

            it('should not issue any messages for files that are found', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoTestFileCommand(file, fixture.context);

                fixture.assertNoMessageDialogs();
            });

            it('should not query for a package if a heuristic finds a hit', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoTestFileCommand(file, fixture.context);

                fixture.assertNoPackageManifestQueries();
            });

            it('should attempt patterns in order of appearance until one matches', async () => {
                configuration.gotoTestFile.heuristicFilenamePattern = [
                    "$1TestFile.swift",
                    "$1Spec.swift",
                    "$1Tests.swift",
                ];

                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Sources/Target/B.swift",
                    "/home/Sources/Target/C.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                    "/home/Tests/TargetTests/BSpec.swift",
                    "/home/Tests/TargetTests/CTests.swift",
                ], configuration);

                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/A.swift"
                ), fixture.context);
                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/B.swift"
                ), fixture.context);
                await gotoTestFileCommand(fileUri(
                    "/home/Sources/Target/C.swift"
                ), fixture.context);

                fixture.assertShownFiles(
                    ["/home/Tests/TargetTests/ATestFile.swift", { viewColumn: vscode.ViewColumn.Active }],
                    ["/home/Tests/TargetTests/BSpec.swift", { viewColumn: vscode.ViewColumn.Active }],
                    ["/home/Tests/TargetTests/CTests.swift", { viewColumn: vscode.ViewColumn.Active }],
                );
            });

            it('should present the option of creating a test file, if none is found, with a default pattern name.', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift",
                );
                const pkg = stubPackage();
                const fixture = new FullTestFixture([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/",
                ], configuration, pkg);
                fixture.context.workspace.showInformationMessage_stub = async (_message, items) => {
                    assert.deepStrictEqual(items, [
                        "Yes",
                        "No"
                    ]);

                    return "Yes";
                };

                await gotoTestFileCommand(file, fixture.context);

                const wsEdit = fixture.context.workspace.makeWorkspaceEdit_calls[0];
                assert.notStrictEqual(wsEdit, undefined);
                fixture
                    .assertWorkspaceEditsMatchUnordered([
                        {
                            uri: "/home/Tests/TargetTests/ATests.swift",
                            fileContents: makeExpectedTestFileContentString("Target", "ATests")
                        },
                    ])
                    .assertShownFiles(['/home/Tests/TargetTests/ATests.swift']);
            });

            it('should not create a file when none is found, if the user chooses not to.', async () => {
                const file = fileUri(
                    "/home/Sources/Target/A.swift",
                );
                const pkg = stubPackage();
                const fixture = new FullTestFixture([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/",
                ], configuration, pkg);
                fixture.context.workspace.showInformationMessage_stub = async (_message, items) => {
                    assert.deepStrictEqual(items, [
                        "Yes",
                        "No"
                    ]);

                    return "No";
                };

                await gotoTestFileCommand(file, fixture.context);

                fixture.assertNoActions();
            });

            it('should remove special characters from the path after expanding placeholders and issue an error', async () => {
                configuration.gotoTestFile.heuristicFilenamePattern = "/../$1TestFile.swift";

                const file = fileUri(
                    "/home/Sources/Target/A.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoTestFileCommand(file, fixture.context);

                fixture
                    .assertShownFiles(
                        ["/home/Tests/TargetTests/ATestFile.swift", { viewColumn: vscode.ViewColumn.Active }],
                    )
                    .assertShownError();
            });
        });
    });
});
