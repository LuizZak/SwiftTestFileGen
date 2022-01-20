import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe } from 'mocha';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { proposeTestFiles } from '../../testFileGeneration';
import { TestFileDiagnosticKind } from '../../data/testFileDiagnosticResult';

suite('Test File Generation Test Suite', () => {
    describe('proposeTestFiles', () => {
        test('with target rooted in Sources/', () => {
            const testPackage = makeSingleTargetTestPackage();

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                vscode.Uri.file("/Package/Path/Sources/A.swift"),
                vscode.Uri.file("/Package/Path/Sources/B.swift"),
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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

        test('with file in nested folder', () => {
            const testPackage = makeMultiTargetTestPackage();

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                vscode.Uri.file("/Package/Path/Sources/Target/SubfolderA/A.swift"),
                vscode.Uri.file("/Package/Path/Sources/TargetWithPath/SubfolderA/SubfolderB/B.swift"),
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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

        test('with target with explicit path', () => {
            const testPackage = makeMultiTargetTestPackage();

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                vscode.Uri.file("/Package/Path/Sources/ExplicitPath/A.swift"),
                vscode.Uri.file("/Package/Path/Sources/ExplicitPath/B.swift"),
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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

        test('with test target with explicit path', () => {
            const testPackage = makeExplicitTestTargetPathTestPackage();

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                vscode.Uri.file("/Package/Path/Sources/Target/A.swift"),
                vscode.Uri.file("/Package/Path/Sources/Target/B.swift"),
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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

        test('with unknown targets', () => {
            const testPackage = makeEmptyTestPackage();

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                vscode.Uri.file("/Package/Path/Sources/TargetA/A.swift"),
                vscode.Uri.file("/Package/Path/Sources/TargetB/B.swift"),
                vscode.Uri.file("/Package/Path/Sources/C.swift"),
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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
        
        test('with files in tests folder', () => {
            const testPackage = makeMultiTargetTestPackage();

            const fileA = vscode.Uri.file("/Package/Path/Tests/TargetTests/ATests.swift");
            const fileB = vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/Subdirectory/BTests.swift");

            const packageRoot = vscode.Uri.file("Package/Path");
            const filePaths: vscode.Uri[] = [
                fileA,
                fileB,
            ];
            
            const result = proposeTestFiles(filePaths, packageRoot, testPackage);

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
    return `
import XCTest

@testable import ${targetName}

class ${testName}: XCTestCase {

}
`;
}
