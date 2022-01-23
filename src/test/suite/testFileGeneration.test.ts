import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe } from 'mocha';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { suggestTestFiles } from '../../testFileGeneration';
import { TestFileDiagnosticKind } from '../../data/testFileDiagnosticResult';
import { fileUris, setupTest, stubPackage } from './commands/commandTestUtils';

suite('Test File Generation Test Suite', () => {
    describe('suggestTestFiles', () => {
        test('with target rooted in Sources/', async () => {
            const testPackage = makeSingleTargetTestPackage();
            const context = setupTest([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = fileUris(
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(
                result[0],
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestString("Target", "ATests"),
                        originalFile: filePaths[0]
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        contents: makeExpectedTestString("Target", "BTests"),
                        originalFile: filePaths[1]
                    },
                ]
            );
        });

        test('with file in nested folder', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const context = setupTest([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/Target/SubfolderA/A.swift",
                "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = fileUris(
                "/Package/Path/Sources/Target/SubfolderA/A.swift",
                "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(
                result[0],
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift"),
                        contents: makeExpectedTestString("Target", "ATests"),
                        originalFile: filePaths[0]
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift"),
                        contents: makeExpectedTestString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1]
                    },
                ]
            );
            assert.deepStrictEqual(result[1], []);
        });

        test('with target with explicit path', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const context = setupTest([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/ExplicitPath/A.swift",
                "/Package/Path/Sources/ExplicitPath/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = fileUris(
                "/Package/Path/Sources/ExplicitPath/A.swift",
                "/Package/Path/Sources/ExplicitPath/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(
                result[0],
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/ATests.swift"),
                        contents: makeExpectedTestString("TargetWithPath", "ATests"),
                        originalFile: filePaths[0]
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/BTests.swift"),
                        contents: makeExpectedTestString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1]
                    },
                ]
            );
            assert.deepStrictEqual(result[1], []);
        });

        test('with test target with explicit path', async () => {
            const testPackage = makeExplicitTestTargetPathTestPackage();

            const context = setupTest([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/Target/A.swift",
                "/Package/Path/Sources/Target/B.swift",
                "/Package/Path/Tests/AlternatePath/"
            ], undefined, testPackage);

            const filePaths = fileUris(
                "/Package/Path/Sources/Target/A.swift",
                "/Package/Path/Sources/Target/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(
                result[0],
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/ATests.swift"),
                        contents: makeExpectedTestString("Target", "ATests"),
                        originalFile: filePaths[0]
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/BTests.swift"),
                        contents: makeExpectedTestString("Target", "BTests"),
                        originalFile: filePaths[1]
                    },
                ]
            );
            assert.deepStrictEqual(result[1], []);
        });

        test('with unknown targets', async () => {
            const testPackage = makeEmptyTestPackage();

            const context = setupTest([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/TargetA/A.swift",
                "/Package/Path/Sources/TargetB/B.swift",
                "/Package/Path/Sources/C.swift",
                "/Package/Path/Tests/"
            ], undefined, testPackage);

            const filePaths = fileUris(
                "/Package/Path/Sources/TargetA/A.swift",
                "/Package/Path/Sources/TargetB/B.swift",
                "/Package/Path/Sources/C.swift",
            );
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(
                result[0],
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetATests/ATests.swift"),
                        contents: makeExpectedTestString("TargetA", "ATests"),
                        originalFile: filePaths[0]
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetBTests/BTests.swift"),
                        contents: makeExpectedTestString("TargetB", "BTests"),
                        originalFile: filePaths[1]
                    },
                    {
                        name: "CTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/CTests.swift"),
                        contents: makeExpectedTestString("<#TargetName#>", "CTests"),
                        originalFile: filePaths[2]
                    },
                ]
            );
            assert.deepStrictEqual(result[1], []);
        });
        
        test('with files in tests folder', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const fileA = vscode.Uri.file("/Package/Path/Tests/TargetTests/ATests.swift");
            const fileB = vscode.Uri.file("/Package/Path/Tests/ExplicitPathTests/Subdirectory/BTests.swift");

            const context = setupTest([
                "/Package/Path/Package.swift",
                fileA,
                fileB,
                "/Package/Path/Sources/C.swift",
                "/Package/Path/Tests/"
            ], undefined, testPackage);

            const filePaths: vscode.Uri[] = [
                fileA,
                fileB,
            ];
            
            const result = await suggestTestFiles(filePaths, context.packageProvider);

            assert.deepStrictEqual(result[0], []);
            assert.deepStrictEqual(result[1], [
                {
                    message: "File is not contained within a recognized Sources/ folder",
                    sourceFile: fileA,
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder
                },
                {
                    message: "File is not contained within a recognized Sources/ folder",
                    sourceFile: fileB,
                    kind: TestFileDiagnosticKind.fileNotInSourcesFolder
                }
            ]);
        });
    });
});

// --

function makeSingleTargetTestPackage(): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: "Target",
                type: TargetType.Regular,
                path: "Sources",
            },
            {
                name: "TargetTests",
                type: TargetType.Test,
                path: "Tests",
            },
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };
}

function makeMultiTargetTestPackage(): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: "Target",
                type: TargetType.Regular,
            },
            {
                name: "TargetWithPath",
                type: TargetType.Regular,
                path: "Sources/ExplicitPath"
            },
            {
                name: "TargetTests",
                type: TargetType.Test,
            },
            {
                name: "TargetWithPathTests",
                type: TargetType.Test,
            },
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };
}

function makeExplicitTestTargetPathTestPackage(): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: "Target",
                type: TargetType.Regular,
            },
            {
                name: "TargetTests",
                type: TargetType.Test,
                path: "Tests/AlternatePath"
            },
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };
}

function makeEmptyTestPackage(): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [],
        toolsVersion: {
            _version: "5.5.0",
        },
    };
}

function makeExpectedTestString(targetName: string, testName: string): string {
    return `import XCTest

@testable import ${targetName}

class ${testName}: XCTestCase {

}
`;
}
