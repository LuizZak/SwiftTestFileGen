import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe, it } from 'mocha';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { replaceSpecialCharactersForTestName, suggestTestFiles } from '../../suggestTestFiles';
import { TestFileDiagnosticKind } from '../../data/testFileDiagnosticResult';
import { FullTestFixture, makeExpectedTestFileContentString, stubPackage, swiftFiles } from './fullTestFixture';
import { Configuration, EmitImportDeclarationsMode } from '../../data/configurations/configuration';
import { ConfirmationMode } from '../../data/configurations/confirmationMode';

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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/Target/SubfolderA/A.swift",
                "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/ExplicitPath/A.swift",
                "/Package/Path/Sources/ExplicitPath/B.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetWithPath", "BTests"),
                        originalFile: filePaths[1],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/Target/A.swift",
                "/Package/Path/Sources/Target/B.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/TargetA/A.swift",
                "/Package/Path/Sources/TargetB/B.swift",
                "/Package/Path/Sources/C.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetATests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("TargetA", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/TargetBTests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("TargetB", "BTests"),
                        originalFile: filePaths[1],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "CTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/CTests.swift"),
                        contents: makeExpectedTestFileContentString("<#TargetName#>", "CTests"),
                        originalFile: filePaths[2],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                fileA,
                fileB,
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

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

            const files = swiftFiles(
                fixture.context.fileSystem,
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/A+Ext.swift",
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: [],
                    },
                    {
                        name: "A+ExtTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/A+ExtTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "A_ExtTests"),
                        originalFile: filePaths[1],
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

            const files = swiftFiles(
                fixture.context.fileSystem,
                {
                    path: "/Package/Path/Sources/A.swift",
                    contents: "import Module\n\nclass A { }",
                },
                {
                    path: "/Package/Path/Sources/B.swift",
                    contents: "import struct OtherModule.Struct\n\nclass B { }",
                },
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: ["Module"],
                    },
                    {
                        name: "BTests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "BTests"),
                        originalFile: filePaths[1],
                        existsOnDisk: false,
                        suggestedImports: ["OtherModule"],
                    },
                ]
            );
        });

        it('must detect imported modules in original source file separated by semicolons', async () => {
            const testPackage = makeSingleTargetTestPackage();
            const fixture = new FullTestFixture([
                "/Package/Path/Package.swift",
                "/Package/Path/Sources/A.swift",
                "/Package/Path/Sources/B.swift",
                "/Package/Path/Tests/",
            ], undefined, testPackage);

            const files = swiftFiles(
                fixture.context.fileSystem,
                {
                    path: "/Package/Path/Sources/A.swift",
                    contents: "import ModuleA;import struct ModuleB.Struct;import ModuleC;\n\nclass A { }",
                },
            );
            const filePaths = files.map(file => file.path);
            
            const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);

            assert.deepStrictEqual(
                result.testFiles,
                [
                    {
                        name: "ATests.swift",
                        path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        contents: makeExpectedTestFileContentString("Target", "ATests"),
                        originalFile: filePaths[0],
                        existsOnDisk: false,
                        suggestedImports: ["ModuleA", "ModuleB", "ModuleC"],
                    },
                ]
            );
        });

        describe('when detecting import declarations', () => {
            function makeConfig(mode: EmitImportDeclarationsMode): Configuration {
                return {
                    fileGen: {
                        confirmation: ConfirmationMode.always,
                        emitImportDeclarations: mode,
                    },
                    gotoTestFile: {
                        useFilenameHeuristics: false,
                        heuristicFilenamePattern: "(\\w+)Tests",
                    },
                };
            }

            describe('when "swiftTestFileGen.fileGen.emitImportDeclarations" is "always"', () => {
                const configuration = makeConfig(EmitImportDeclarationsMode.always);

                it('must emit any import declarations found', async () => {
                    const testPackage = makeSingleTargetTestPackage();
                    testPackage.targets[0].dependencies = [
                        {
                            byName: [
                                "ModuleA",
                                null
                            ],
                        },
                        {
                            product: [
                                "ModuleB",
                                "module-b",
                                null,
                                null
                            ],
                        },
                    ];
                    const fixture = new FullTestFixture([
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/A.swift",
                        "/Package/Path/Sources/B.swift",
                        "/Package/Path/Tests/",
                    ], configuration, testPackage);
        
                    const files = swiftFiles(
                        fixture.context.fileSystem,
                        {
                            path: "/Package/Path/Sources/A.swift",
                            contents: "import ModuleA;import struct ModuleB.Struct;import ModuleC;\n\nclass A { }",
                        },
                    );
                    const filePaths = files.map(file => file.path);
                    
                    const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);
        
                    assert.deepStrictEqual(
                        result.testFiles,
                        [
                            {
                                name: "ATests.swift",
                                path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                                contents: makeExpectedTestFileContentString("Target", "ATests", "ModuleA", "ModuleB", "ModuleC"),
                                originalFile: filePaths[0],
                                existsOnDisk: false,
                                suggestedImports: ["ModuleA", "ModuleB", "ModuleC"],
                            },
                        ]
                    );
                });
            });

            describe('when "swiftTestFileGen.fileGen.emitImportDeclarations" is "explicitDependenciesOnly"', () => {
                const configuration = makeConfig(EmitImportDeclarationsMode.explicitDependenciesOnly);

                describe('when dependencies are direct', () => {
                    it('must emit import declarations for targets that explicitly import other targets', async () => {
                        const testPackage = makeSingleTargetTestPackage();
                        testPackage.targets[0].dependencies = [
                            {
                                byName: [
                                    "ModuleA",
                                    null
                                ],
                            },
                            {
                                product: [
                                    "ModuleB",
                                    "module-b",
                                    null,
                                    null
                                ],
                            },
                        ];
                        const fixture = new FullTestFixture([
                            "/Package/Path/Package.swift",
                            "/Package/Path/Sources/A.swift",
                            "/Package/Path/Sources/B.swift",
                            "/Package/Path/Tests/",
                        ], configuration, testPackage);
            
                        const files = swiftFiles(
                            fixture.context.fileSystem,
                            {
                                path: "/Package/Path/Sources/A.swift",
                                contents: "import ModuleA;import struct ModuleB.Struct;import ModuleC;\n\nclass A { }",
                            },
                        );
                        const filePaths = files.map(file => file.path);
                        
                        const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);
            
                        assert.deepStrictEqual(
                            result.testFiles,
                            [
                                {
                                    name: "ATests.swift",
                                    path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                                    contents: makeExpectedTestFileContentString("Target", "ATests", "ModuleA", "ModuleB"),
                                    originalFile: filePaths[0],
                                    existsOnDisk: false,
                                    suggestedImports: ["ModuleA", "ModuleB", "ModuleC"],
                                },
                            ]
                        );
                    });
                });

                describe('when dependencies are indirect', () => {
                    it('must emit import declarations for targets that explicitly import other targets', async () => {
                        const testPackage = stubPackage([
                            {
                                name: "ModuleA",
                                type: TargetType.Regular,
                                dependencies: [
                                    {
                                        byName: [
                                            "ModuleB",
                                            null,
                                        ],
                                    },
                                ]
                            },
                            {
                                name: "ModuleB",
                                type: TargetType.Regular,
                                dependencies: [
                                    {
                                        byName: [
                                            "ModuleC",
                                            null,
                                        ],
                                    },
                                ]
                            },
                            {
                                name: "ModuleC",
                                type: TargetType.Regular,
                            },
                            {
                                name: "ModuleATests",
                                type: TargetType.Test,
                                dependencies: [
                                    {
                                        byName: [
                                            "ModuleA",
                                            null,
                                        ],
                                    },
                                ],
                            },
                        ]);
                        const fixture = new FullTestFixture([
                            "/Package/Path/Package.swift",
                            "/Package/Path/Sources/ModuleA/A.swift",
                            "/Package/Path/Sources/ModuleB/B.swift",
                            "/Package/Path/Sources/ModuleC/C.swift",
                            "/Package/Path/Tests/ModuleATests",
                        ], configuration, testPackage);
            
                        const files = swiftFiles(
                            fixture.context.fileSystem,
                            {
                                path: "/Package/Path/Sources/ModuleA/A.swift",
                                contents: "import ModuleB;import ModuleC;\n\nclass A { }",
                            },
                        );
                        const filePaths = files.map(file => file.path);
                        
                        const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);
            
                        assert.deepStrictEqual(
                            result.testFiles,
                            [
                                {
                                    name: "ATests.swift",
                                    path: vscode.Uri.file("/Package/Path/Tests/ModuleATests/ATests.swift"),
                                    contents: makeExpectedTestFileContentString("ModuleA", "ATests", "ModuleB", "ModuleC"),
                                    originalFile: filePaths[0],
                                    existsOnDisk: false,
                                    suggestedImports: ["ModuleB", "ModuleC"],
                                },
                            ]
                        );
                    });
                });
            });

            describe('when "swiftTestFileGen.fileGen.emitImportDeclarations" is "never"', () => {
                const configuration = makeConfig(EmitImportDeclarationsMode.never);

                it('must not emit any import declarations found', async () => {
                    const testPackage = makeSingleTargetTestPackage();
                    testPackage.targets[0].dependencies = [
                        {
                            byName: [
                                "ModuleA",
                                null
                            ],
                        },
                        {
                            product: [
                                "ModuleB",
                                "module-b",
                                null,
                                null
                            ],
                        },
                    ];
                    const fixture = new FullTestFixture([
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/A.swift",
                        "/Package/Path/Sources/B.swift",
                        "/Package/Path/Tests/",
                    ], configuration, testPackage);
        
                    const files = swiftFiles(
                        fixture.context.fileSystem,
                        {
                            path: "/Package/Path/Sources/A.swift",
                            contents: "import ModuleA;import struct ModuleB.Struct;import ModuleC;\n\nclass A { }",
                        },
                    );
                    const filePaths = files.map(file => file.path);
                    
                    const result = await suggestTestFiles(filePaths, fixture.context.configuration, fixture.context);
        
                    assert.deepStrictEqual(
                        result.testFiles,
                        [
                            {
                                name: "ATests.swift",
                                path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                                contents: makeExpectedTestFileContentString("Target", "ATests"),
                                originalFile: filePaths[0],
                                existsOnDisk: false,
                                suggestedImports: ["ModuleA", "ModuleB", "ModuleC"],
                            },
                        ]
                    );
                });
            });
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
                path: "Sources/ExplicitPath",
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
                path: "Tests/AlternatePath",
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
