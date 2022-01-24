import * as assert from 'assert';
import { describe, it } from 'mocha';
import { generateTestFilesCommand } from '../../../commands/generateTestFilesCommand';
import { ConfirmationMode } from '../../../data/configurations/confirmationMode';
import { TargetType } from '../../../data/swiftPackage';
import { assertNoActions, assertWorkspaceEditMatchesUnordered, fileUri, fileUris, setupTest, stubPackage } from './commandTestUtils';

suite('generateTestFilesCommand Test Suite', () => {
    describe('generateTestFilesCommand', () => {
        it('should create and populate test files from valid input target files', async () => {
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
            assert.ok(wsEdit);
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

        it('should discern files in different targets properly', async () => {
            const files = fileUris(
                "/home/Sources/TargetA/A.swift",
                "/home/Sources/TargetB/B.swift",
            );
            const pkg = stubPackage([
                {name: "TargetA", type: TargetType.Regular},
                {name: "TargetB", type: TargetType.Regular},
                {name: "TargetATests", type: TargetType.Test},
                {name: "TargetBTests", type: TargetType.Test},
            ]);
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/TargetA/A.swift",
                "/home/Sources/TargetB/B.swift",
                "/home/Tests/TargetATests/",
                "/home/Tests/TargetBTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            const wsEdit = context.workspace.makeWorkspaceEdit_calls[0];
            assert.ok(wsEdit);
            assertWorkspaceEditMatchesUnordered(wsEdit, [
                [fileUri("/home/Tests/TargetATests/ATests.swift"), `import XCTest

@testable import TargetA

class ATests: XCTestCase {

}
`],
                [fileUri("/home/Tests/TargetBTests/BTests.swift"), `import XCTest

@testable import TargetB

class BTests: XCTestCase {

}
`],
            ]);
        });

        it('should create target test folders if none exist', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            const wsEdit = context.workspace.makeWorkspaceEdit_calls[0];
            assert.ok(wsEdit);
            assertWorkspaceEditMatchesUnordered(wsEdit, [
                [fileUri("/home/Tests/TargetTests/ATests.swift"), `import XCTest

@testable import Target

class ATests: XCTestCase {

}
`],
            ]);
        });

        it('should do nothing for files not in recognized sources folder', async () => {
            const files = fileUris(
                "/home/A.swift",
                "/B.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/A.swift",
                "/B.swift",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

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

        it('should respect multiple Package.swift manifests in project tree', async () => {
            const files = fileUris(
                "/home/Sources/Target/A.swift",
                "/home/Packages/AnotherPackage/Sources/Target/A.swift",
            );
            const pkg = stubPackage();
            const context = setupTest([
                "/home/Package.swift",
                "/home/Sources/Target/A.swift",
                "/home/Tests/TargetTests/",
                // Sub package
                "/home/Packages/AnotherPackage/Package.swift",
                "/home/Packages/AnotherPackage/Sources/Target/A.swift",
                "/home/Packages/AnotherPackage/Tests/TargetTests/",
            ], undefined, pkg);

            await generateTestFilesCommand(files, ConfirmationMode.always, context);

            const wsEdit = context.workspace.makeWorkspaceEdit_calls[0];
            assert.ok(wsEdit);
            assertWorkspaceEditMatchesUnordered(wsEdit, [
                [fileUri("/home/Tests/TargetTests/ATests.swift"), `import XCTest

@testable import Target

class ATests: XCTestCase {

}
`],
                [fileUri("/home/Packages/AnotherPackage/Tests/TargetTests/ATests.swift"), `import XCTest

@testable import Target

class ATests: XCTestCase {

}
`],
            ]);
        });
    });
});
