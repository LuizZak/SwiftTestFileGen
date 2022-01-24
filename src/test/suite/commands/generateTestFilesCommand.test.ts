import * as assert from 'assert';
import { describe, it } from 'mocha';
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';
import { TargetType } from '../../../data/swiftPackage';
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
                    fileContents: makeExpectedTestFileContentString("TargetA", "ATests")},
                {
                    uri: fileUri("/home/Tests/TargetBTests/BTests.swift"),
                    fileContents: makeExpectedTestFileContentString("TargetB", "BTests")},
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
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")},
                {
                    uri: fileUri("/home/Packages/AnotherPackage/Tests/TargetTests/ATests.swift"),
                    fileContents: makeExpectedTestFileContentString("Target", "ATests")},
            ]);
        });

        describe('confirmation behavior', () => {
            it("should request confirmation of all changes if Configuration.fileGen.confirmation is 'always'", () => {
                const files = fileUris(
                    "/home/Sources/Target/A.swift",
                );
                const pkg = stubPackage();
                const fixture = new FullTestFixture([
                    "/home/Package.swift",
                    "/home/Sources/Target/A.swift",
                    "/home/Tests/TargetTests/",
                ], undefined, pkg);

                fixture.context.configuration.fileGen.confirmation = ConfirmationMode.always;


            });
        });
    });
});
