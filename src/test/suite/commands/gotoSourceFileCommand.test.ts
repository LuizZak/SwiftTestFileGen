import * as vscode from 'vscode';
import { describe, it, beforeEach } from 'mocha';
import { gotoSourceFileCommand } from '../../../commands/gotoSourceFileCommand';
import { fileUri, FullTestFixture, makeExpectedTestFileContentString, stubPackage } from '../fullTestFixture';
import { Configuration, EmitImportDeclarationsMode } from '../../../data/configurations/configuration';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';

suite('gotoSourceFileCommand Test Suite', () => {
    describe('gotoSourceFileCommand', () => {
        it('should open existing source files', async () => {
            const file = fileUri(
                "/home/Tests/TargetTests/ATests.swift"
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/ATests.swift",
            ], undefined, pkg);

            await gotoSourceFileCommand(file, fixture.context);

            fixture.assertShownFiles(
                {
                    fileUri: "/home/Sources/Target/A.swift",
                    options: { viewColumn: vscode.ViewColumn.Active },
                },
            );
        });

        it('should do nothing for files not in recognized tests folder', async () => {
            const file = fileUri(
                "/home/A.swift"
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/A.swift",
                "/B.swift",
            ], undefined, pkg);

            await gotoSourceFileCommand(file, fixture.context);

            fixture.assertNoActions();
        });

        it('should do nothing for files in source folders', async () => {
            const file = fileUri(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/B.swift",
            ], undefined, pkg);

            await gotoSourceFileCommand(file, fixture.context);

            fixture.assertNoActions();
        });

        it('should do nothing if no matching existing file is found.', async () => {
            const file = fileUri(
                "/home/Tests/TargetTests/ATests.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/",
                "/home/Tests/TargetTests/ATests.swift",
            ], undefined, pkg);

            await gotoSourceFileCommand(file, fixture.context);

            fixture.assertNoActions();
        });

        describe("with heuristics enabled", () => {
            let configuration: Configuration;

            beforeEach(() => {
                configuration = {
                    fileGen: {
                        confirmation: ConfirmationMode.always,
                        emitImportDeclarations: EmitImportDeclarationsMode.never,
                    },
                    gotoTestFile: {
                        useFilenameHeuristics: true,
                        heuristicFilenamePattern: "$1TestFile.swift",
                    }
                };
            });

            it('should use a provided pattern', async () => {
                const file = fileUri(
                    "/home/Tests/TargetTests/ATestFile.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoSourceFileCommand(file, fixture.context);

                fixture.assertShownFiles(
                    {
                        fileUri: "/home/Sources/Target/A.swift",
                        options: { viewColumn: vscode.ViewColumn.Active }
                    },
                );
            });

            it('should not issue any messages for files that are found', async () => {
                const file = fileUri(
                    "/home/Tests/TargetTests/ATestFile.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoSourceFileCommand(file, fixture.context);

                fixture.assertNoMessageDialogs();
            });

            it('should not query for a package if a heuristic finds a hit', async () => {
                const file = fileUri(
                    "/home/Tests/TargetTests/ATestFile.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/ATestFile.swift",
                ], configuration);

                await gotoSourceFileCommand(file, fixture.context);

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

                await gotoSourceFileCommand(fileUri(
                    "/home/Tests/TargetTests/ATestFile.swift"
                ), fixture.context);
                await gotoSourceFileCommand(fileUri(
                    "/home/Tests/TargetTests/BSpec.swift"
                ), fixture.context);
                await gotoSourceFileCommand(fileUri(
                    "/home/Tests/TargetTests/CTests.swift"
                ), fixture.context);

                fixture.assertShownFiles(
                    {
                        fileUri: "/home/Sources/Target/A.swift",
                        options: { viewColumn: vscode.ViewColumn.Active }
                    },
                    {
                        fileUri: "/home/Sources/Target/B.swift",
                        options: { viewColumn: vscode.ViewColumn.Active }
                    },
                    {
                        fileUri: "/home/Sources/Target/C.swift",
                        options: { viewColumn: vscode.ViewColumn.Active }
                    },
                );
            });

            it('should remove special characters from the path after expanding placeholders, but issue no error', async () => {
                configuration.gotoTestFile.heuristicFilenamePattern = "/../Prefix$1TestFile.swift";

                const file = fileUri(
                    "/home/Tests/TargetTests/PrefixATestFile.swift"
                );
                const fixture = new FullTestFixture([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/PrefixATestFile.swift",
                ], configuration, stubPackage());

                await gotoSourceFileCommand(file, fixture.context);

                fixture.assertShownInformation();
            });
        });
    });
});
