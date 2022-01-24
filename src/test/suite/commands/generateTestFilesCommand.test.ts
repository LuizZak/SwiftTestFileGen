import * as vscode from 'vscode';
import { describe, it, beforeEach } from 'mocha';
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';
import { SwiftPackageManifest, TargetType } from '../../../data/swiftPackage';
import { fileUri, fileUris, FullTestFixture, makeExpectedTestFileContentString, stubPackage } from './fullTestFixture';

suite('generateTestFilesCommand Test Suite', () => {
    describe('generateTestFilesCommand', () => {
        it('should create and populate test files from valid input target files', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/B.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
                {
                    uri: fileUri("/home/Tests/TargetTests/BTests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "BTests")
                },
            ]);
        });

        it('must de-duplicate file uris before generating test files', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
            ]);
        });

        it('must de-duplicate file uris and directories that expand to file uris before generating test files', async () => {
            const files = fileUris(
                "/home/Sources/Target",
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
            ]);
        });

        it('should discern files in different targets properly', async () => {
            const files = fileUris(
                "/home/Sources/TargetA/A.swift",
                "/home/Sources/TargetB/B.swift",
            );
            const pkg = stubPackage([
                { name: "TargetA", type: TargetType.Regular },
                { name: "TargetB", type: TargetType.Regular },
                { name: "TargetATests", type: TargetType.Test },
                { name: "TargetBTests", type: TargetType.Test },
            ]);
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/TargetA/A.swift",
                "/home/Sources/TargetB/B.swift",
                "/home/Tests/TargetATests/",
                "/home/Tests/TargetBTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetATests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("TargetA", "ATests")
                },
                {
                    uri: fileUri("/home/Tests/TargetBTests/BTests.swift"),
                    fileContents: makeExpectedTestFileContentString("TargetB", "BTests")
                },
            ]);
        });

        it('should create target test folders if none exist', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
            ]);
        });

        it('should do nothing for files not in recognized sources folder', async () => {
            const files = fileUris(
                "/home/A.swift",
                "/B.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/A.swift",
                "/B.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertNoActions();
        });

        it('should do nothing for files in test folders', async () => {
            const files = fileUris(
                "/home/Tests/TargetTests/B.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/B.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertNoActions();
        });

        it('should respect multiple Package.swift manifests in project tree', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Packages/AnotherPackage/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const fixture = new FullTestFixture([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
                // Sub package
                "/home/Packages/AnotherPackage/Package.swift",
                "/home/Packages/AnotherPackage/Sources/Target/A.swift",
                "/home/Packages/AnotherPackage/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, fixture.context);

            fixture.assertWorkspaceEditsMatchUnordered([
                {
                    uri: fileUri("/home/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
                {
                    uri: fileUri("/home/Packages/AnotherPackage/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")
                },
            ]);
        });

        describe('needsConfirmation of result', () => {
            let pkg: SwiftPackageManifest;
            let fixture: FullTestFixture;

            beforeEach(() => {
                pkg = stubPackage();
                fixture = new FullTestFixture([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Sources/Target/B.swift",
                    "/home/Tests/TargetTests/",
                ], undefined, pkg);
            });

            async function runTest(inputPaths: vscode.Uri[], confirmationMode: ConfirmationMode, expectedResult: boolean): Promise<void> {
                const results = await generateTestFilesCommand(inputPaths, confirmationMode, fixture.context);

                fixture.assertWorkspaceEditsMatchUnordered(results.map(uri => {
                    return {
                        uri: uri,
                        needsConfirmation: expectedResult
                    };
                }));
            }

            describe('for single file inputs', () => {
                const input = fileUris(
                    "/home/Sources/Target/A.swift",
                );
                
                it("must be true if confirmationMode is 'always'", async () => {
                    await runTest(input, ConfirmationMode.always, true);
                });
                
                it("must be false if confirmationMode is 'onlyIfMultiFile'", async () => {
                    await runTest(input, ConfirmationMode.onlyIfMultiFile, false);
                });
                
                it("must be false if confirmationMode is 'onlyOnDirectories'", async () => {
                    await runTest(input, ConfirmationMode.onlyOnDirectories, false);
                });
                
                it("must be false if confirmationMode is 'never'", async () => {
                    await runTest(input, ConfirmationMode.never, false);
                });
            });

            describe('for multi-file inputs', () => {
                const input = fileUris(
                    "/home/Sources/Target/A.swift",
                    "/home/Sources/Target/B.swift",
                );
                
                it("must be true if confirmationMode is 'always'", async () => {
                    await runTest(input, ConfirmationMode.always, true);
                });
                
                it("must be true if confirmationMode is 'onlyIfMultiFile'", async () => {
                    await runTest(input, ConfirmationMode.onlyIfMultiFile, true);
                });
                
                it("must be false if confirmationMode is 'onlyOnDirectories'", async () => {
                    await runTest(input, ConfirmationMode.onlyOnDirectories, false);
                });
                
                it("must be false if confirmationMode is 'never'", async () => {
                    await runTest(input, ConfirmationMode.never, false);
                });
            });

            describe('for directory inputs', () => {
                const input = fileUris(
                    "/home/Sources/Target",
                );
                
                it("must be true if confirmationMode is 'always'", async () => {
                    await runTest(input, ConfirmationMode.always, true);
                });
                
                it("must be true if confirmationMode is 'onlyIfMultiFile'", async () => {
                    await runTest(input, ConfirmationMode.onlyIfMultiFile, true);
                });
                
                it("must be true if confirmationMode is 'onlyOnDirectories'", async () => {
                    await runTest(input, ConfirmationMode.onlyOnDirectories, true);
                });
                
                it("must be false if confirmationMode is 'never'", async () => {
                    await runTest(input, ConfirmationMode.never, false);
                });
            });

            describe('for mixed file-directory inputs', () => {
                const input = fileUris(
                    "/home/Sources/Target",
                    "/home/Sources/Target/A.swift",
                );
                
                it("must be true if confirmationMode is 'always'", async () => {
                    await runTest(input, ConfirmationMode.always, true);
                });
                
                it("must be true if confirmationMode is 'onlyIfMultiFile'", async () => {
                    await runTest(input, ConfirmationMode.onlyIfMultiFile, true);
                });
                
                it("must be true if confirmationMode is 'onlyOnDirectories'", async () => {
                    await runTest(input, ConfirmationMode.onlyOnDirectories, true);
                });
                
                it("must be false if confirmationMode is 'never'", async () => {
                    await runTest(input, ConfirmationMode.never, false);
                });
            });
        });
    });
});
