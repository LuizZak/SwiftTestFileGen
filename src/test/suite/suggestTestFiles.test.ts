import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { replaceSpecialCharactersForTestName, suggestTestFiles } from '../../suggestTestFiles';
import { TestFileDiagnosticKind } from '../../data/testFileDiagnosticResult';
import { fileUris, FullTestFixture, makeExpectedTestFileContentString, swiftFiles } from './fullTestFixture';

suite('suggestTestFiles Test Suite', () => {
    describe('suggestTestFiles', () => {
        test('with target rooted in Sources/', async () => {
            const testPackage = makeSingleTargetTestPackage();
            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
        });

        test('with file in nested folder', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/Target/SubfolderA/A.swift",
                "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/Target/SubfolderA/A.swift",
                "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
            assert.deepStrictEqual(result.diagnostics, []);
        });

        test('with target with explicit path', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/ExplicitPath/A.swift",
                "/Package/Path/Sources/ExplicitPath/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/ExplicitPath/A.swift",
                "/Package/Path/Sources/ExplicitPath/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
            assert.deepStrictEqual(result.diagnostics, []);
        });

        test('with test target with explicit path', async () => {
            const testPackage = makeExplicitTestTargetPathTestPackage();

            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/Target/A.swift",
                "/Package/Path/Sources/Target/B.swift",
                "/Package/Path/Tests/AlternatePath/"
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/Target/A.swift",
                "/Package/Path/Sources/Target/B.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
            assert.deepStrictEqual(result.diagnostics, []);
        });

        test('with unknown targets', async () => {
            const testPackage = makeEmptyTestPackage();

            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/TargetA/A.swift",
                "/Package/Path/Sources/TargetB/B.swift",
                "/Package/Path/Sources/C.swift",
                "/Package/Path/Tests/"
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/TargetA/A.swift",
                "/Package/Path/Sources/TargetB/B.swift",
                "/Package/Path/Sources/C.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetATests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("TargetA", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetBTests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetB", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "CTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/CTests.swift"),
                        contents: makeExpectedTestFileContentString("<#TargetName#>", "CTests"),
                        originalFile: filePaths[2].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
            assert.deepStrictEqual(result.diagnostics, []);
        });
        
        test('with files in tests folder', async () => {
            const testPackage = makeMultiTargetTestPackage();

            const fileA = vscode.Uri.file("/Package/Path/Tests/TargetTests/ATests.swift");
            const fileB = vscode.Uri.file("/Package/Path/Tests/ExplicitPathTests/Subdirectory/BTests.swift");

            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                fileA,
                fileB,
                "/Package/Path/Sources/C.swift",
                "/Package/Path/Tests/"
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                fileA,
                fileB,
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(result.testFiles, []);
            assert.deepStrictEqual(result.diagnostics, [
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

        test('with file with special characters in name', async () => {
            const testPackage = makeSingleTargetTestPackage();
            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/A+Ext.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/A+Ext.swift",
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "A+ExtTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/A+ExtTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "A_ExtTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                ]
            );
        });

        it('must detect imported modules in original source file', async () => {
            const testPackage = makeSingleTargetTestPackage();
            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const filePaths = swiftFiles(
                {
                    path: "/Package/Path/Sources/A.swift",
                    contents: "import Module\n\nclass A { }",
                },
                {
                    path: "/Package/Path/Sources/B.swift",
                    contents: "import struct OtherModule.Struct\n\nclass B { }",
                },
            );
            
            const result = await suggestTestFiles(filePaths, fixture.context.packageProvider);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0].path,
                        existsOnDisk: false,
                        suggestedImports: ["Module"],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1].path,
                        existsOnDisk: false,
                        suggestedImports: ["OtherModule"],
                    },
                ]
            );
        });
    });

    describe('replaceSpecialCharactersForTestName', () => {
        function run(name: string, expected: string) {
            const result = replaceSpecialCharactersForTestName(name);

            assert.strictEqual(result, expected);
        }

        it('must replace + characters with _', () => {
            run("A+File", "A_File");
        });

        it('must replace - characters with _', () => {
            run("A-File", "A_File");
        });

        it('must replace @ characters with _', () => {
            run("A@File", "A_File");
        });

        it('must replace = characters with _', () => {
            run("A=File", "A_File");
        });

        it('must replace . characters with _', () => {
            run("A.File", "A_File");
        });

        it('must replace , characters with _', () => {
            run("A,File", "A_File");
        });

        it('must replace spaces with _', () => {
            run("A File", "A_File");
        });

        it('must replace all occurrences of invalid characters with _', () => {
            run("A,File.Name_ With+Multiple@Violations", "A_File_Name__With_Multiple_Violations");
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
