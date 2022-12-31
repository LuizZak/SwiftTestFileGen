import * as vscode from 'vscode';
import * as assert from 'assert';
import { describe, it, test, beforeEach } from 'mocha';
import { SwiftPackageManifest, TargetType } from '../../../data/swiftPackage';
import { FullTestFixture, swiftFiles } from '../fullTestFixture';
import { SourceToTestFileMapper } from '../../../implementations/sourceToTestFileMapper';
import { SwiftPackagePathsManager } from '../../../swiftPackagePathsManager';
import { TestFileDiagnosticKind } from '../../../data/testFileDiagnosticResult';

describe("SourceToTestFileMapper Test Suite", () => {
    let fixture: FullTestFixture;
    let pkg: SwiftPackagePathsManager;
    let sut: SourceToTestFileMapper;
    
    async function setupTestFixture(
        testPackage: SwiftPackageManifest,
        filePaths: string[],
        filesToCreate: string[],
    ): Promise<vscode.Uri[]> {

        const fixture = new FullTestFixture([
            ...filePaths,
        ], undefined, testPackage);
        const files = swiftFiles(
            fixture.context.fileSystem,
            ...filesToCreate,
        );
        const pkg = await fixture.context
            .packageProvider
            .swiftPackagePathManagerForFile(
                vscode.Uri.file("/Package/Path/Package.swift")
            );
        sut = new SourceToTestFileMapper(pkg);

        return filePaths.map(file => vscode.Uri.file(file));
    }

    describe('suggestedTestPathFor', () => {
        describe('with target rooted in Sources/', () => {
            let filePaths: vscode.Uri[];

            beforeEach(async () => {
                filePaths = await setupTestFixture(
                    makeSingleTargetTestPackage(),
                    [
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/A.swift",
                        "/Package/Path/Sources/B.swift",
                        "/Package/Path/Tests/",
                        "/Package/Path/Tests/ATests.swift",
                        "/Package/Path/Tests/BTests.swift",
                    ],
                    [
                        "/Package/Path/Sources/A.swift",
                    ],
                );
            });

            it('should properly map files from Sources/ to Tests/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Sources/A.swift
                    await sut.suggestedTestPathFor(filePaths[1]),
                    {
                        originalPath: filePaths[1],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/B.swift
                    await sut.suggestedTestPathFor(filePaths[2]),
                    {
                        originalPath: filePaths[2],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                        diagnostics: [],
                    },
                );
            });

            it('should properly map files from Tests/ to Sources/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Tests/ATests.swift
                    await sut.suggestedSourcePathFor(filePaths[4]),
                    {
                        originalPath: filePaths[4],
                        transformedPath: filePaths[1],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/BTests.swift
                    await sut.suggestedSourcePathFor(filePaths[5]),
                    {
                        originalPath: filePaths[5],
                        transformedPath: filePaths[2],
                        diagnostics: [],
                    },
                );
            });
        });

        describe('with file in nested folder', () => {
            let filePaths: vscode.Uri[];

            beforeEach(async () => {
                filePaths = await setupTestFixture(
                    makeMultiTargetTestPackage(),
                    [
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/Target/SubfolderA/A.swift",
                        "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
                        "/Package/Path/Tests/",
                        "/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift",
                        "/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift",
                    ],
                    [
                        "/Package/Path/Sources/Target/SubfolderA/A.swift",
                        "/Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift",
                    ],
                );
            });

            it('should properly map files from Sources/ to Tests/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Sources/Target/SubfolderA/A.swift
                    await sut.suggestedTestPathFor(filePaths[1]),
                    {
                        originalPath: filePaths[1],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift
                    await sut.suggestedTestPathFor(filePaths[2]),
                    {
                        originalPath: filePaths[2],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift"),
                        diagnostics: [],
                    },
                );
            });

            it('should properly map files from Tests/ to Sources/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetTests/SubfolderA/ATests.swift
                    await sut.suggestedSourcePathFor(filePaths[4]),
                    {
                        originalPath: filePaths[4],
                        transformedPath: filePaths[1],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift
                    await sut.suggestedSourcePathFor(filePaths[5]),
                    {
                        originalPath: filePaths[5],
                        transformedPath: filePaths[2],
                        diagnostics: [],
                    },
                );
            });
        });

        describe('with target with explicit path', () => {
            let filePaths: vscode.Uri[];

            beforeEach(async () => {
                filePaths = await setupTestFixture(
                    makeMultiTargetTestPackage(),
                    [
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/ExplicitPath/A.swift",
                        "/Package/Path/Sources/ExplicitPath/B.swift",
                        "/Package/Path/Tests/",
                        "/Package/Path/Tests/TargetWithPathTests/ATests.swift",
                        "/Package/Path/Tests/TargetWithPathTests/BTests.swift",
                    ],
                    [
                        "/Package/Path/Sources/ExplicitPath/A.swift",
                        "/Package/Path/Sources/ExplicitPath/B.swift",
                    ],
                );
            });

            it('should properly map files from Sources/ to Tests/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Sources/ExplicitPath/A.swift
                    await sut.suggestedTestPathFor(filePaths[1]),
                    {
                        originalPath: filePaths[1],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/ATests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/ExplicitPath/SubfolderA/SubfolderB/B.swift
                    await sut.suggestedTestPathFor(filePaths[2]),
                    {
                        originalPath: filePaths[2],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/BTests.swift"),
                        diagnostics: [],
                    },
                );
            });

            it('should properly map files from Tests/ to Sources/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetWithPathTests/ATests.swift
                    await sut.suggestedSourcePathFor(filePaths[4]),
                    {
                        originalPath: filePaths[4],
                        transformedPath: filePaths[1],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetWithPathTests/BTests.swift
                    await sut.suggestedSourcePathFor(filePaths[5]),
                    {
                        originalPath: filePaths[5],
                        transformedPath: filePaths[2],
                        diagnostics: [],
                    },
                );
            });
        });

        describe('with test target with explicit path', () => {
            let filePaths: vscode.Uri[];

            beforeEach(async () => {
                filePaths = await setupTestFixture(
                    makeExplicitTestTargetPathTestPackage(),
                    [
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/Target/A.swift",
                        "/Package/Path/Sources/Target/B.swift",
                        "/Package/Path/Tests/AlternatePath/",
                        "/Package/Path/Tests/AlternatePath/ATests.swift",
                        "/Package/Path/Tests/AlternatePath/BTests.swift",
                    ],
                    [
                        "/Package/Path/Sources/Target/A.swift",
                        "/Package/Path/Sources/Target/B.swift",
                    ],
                );
            });

            it('should properly map files from Sources/ to Tests/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Sources/Target/A.swift
                    await sut.suggestedTestPathFor(filePaths[1]),
                    {
                        originalPath: filePaths[1],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/AlternatePath/ATests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/Target/B.swift
                    await sut.suggestedTestPathFor(filePaths[2]),
                    {
                        originalPath: filePaths[2],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/AlternatePath/BTests.swift"),
                        diagnostics: [],
                    },
                );
            });

            it('should properly map files from Tests/ to Sources/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Tests/AlternatePath/ATests.swift
                    await sut.suggestedSourcePathFor(filePaths[4]),
                    {
                        originalPath: filePaths[4],
                        transformedPath: filePaths[1],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/AlternatePath/BTests.swift
                    await sut.suggestedSourcePathFor(filePaths[5]),
                    {
                        originalPath: filePaths[5],
                        transformedPath: filePaths[2],
                        diagnostics: [],
                    },
                );
            });
        });

        describe('with unknown targets', () => {
            let filePaths: vscode.Uri[];

            beforeEach(async () => {
                filePaths = await setupTestFixture(
                    makeEmptyTestPackage(),
                    [
                        "/Package/Path/Package.swift",
                        "/Package/Path/Sources/TargetA/A.swift",
                        "/Package/Path/Sources/TargetB/B.swift",
                        "/Package/Path/Sources/C.swift",
                        "/Package/Path/Tests/",
                        "/Package/Path/Tests/TargetATests/ATests.swift",
                        "/Package/Path/Tests/TargetBTests/BTests.swift",
                        "/Package/Path/Tests/CTests.swift",
                    ],
                    [
                        "/Package/Path/Sources/TargetA/A.swift",
                        "/Package/Path/Sources/TargetB/B.swift",
                        "/Package/Path/Sources/C.swift",
                    ],
                );
            });

            it('should properly map files from Sources/ to Tests/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Sources/TargetA/A.swift
                    await sut.suggestedTestPathFor(filePaths[1]),
                    {
                        originalPath: filePaths[1],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetATests/ATests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/TargetA/B.swift
                    await sut.suggestedTestPathFor(filePaths[2]),
                    {
                        originalPath: filePaths[2],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/TargetBTests/BTests.swift"),
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Sources/C.swift
                    await sut.suggestedTestPathFor(filePaths[3]),
                    {
                        originalPath: filePaths[3],
                        transformedPath: vscode.Uri.file("/Package/Path/Tests/CTests.swift"),
                        diagnostics: [],
                    },
                );
            });

            it('should properly map files from Tests/ to Sources/', async () => {
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetATests/ATests.swift
                    await sut.suggestedSourcePathFor(filePaths[5]),
                    {
                        originalPath: filePaths[5],
                        transformedPath: filePaths[1],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/TargetBTests/BTests.swift
                    await sut.suggestedSourcePathFor(filePaths[6]),
                    {
                        originalPath: filePaths[6],
                        transformedPath: filePaths[2],
                        diagnostics: [],
                    },
                );
                assert.deepStrictEqual(
                    // /Package/Path/Tests/CTests.swift
                    await sut.suggestedSourcePathFor(filePaths[7]),
                    {
                        originalPath: filePaths[7],
                        transformedPath: filePaths[3],
                        diagnostics: [],
                    },
                );
            });
        });
        
        test('with files in tests folder', async () => {
            const filePaths = await setupTestFixture(
                makeExplicitTestTargetPathTestPackage(),
                [
                    "/Package/Path/Package.swift",
                    "/Package/Path/Tests/TargetTests/ATests.swift",
                    "/Package/Path/Tests/ExplicitPathTests/Subdirectory/BTests.swift",
                    "/Package/Path/Sources/C.swift",
                    "/Package/Path/Tests/",
                ],
                [
                    "/Package/Path/Sources/TargetA/A.swift",
                    "/Package/Path/Sources/TargetB/B.swift",
                    "/Package/Path/Sources/C.swift",
                ],
            );

            assert.deepStrictEqual(
                // /Package/Path/Tests/TargetTests/ATests.swift
                await sut.suggestedTestPathFor(filePaths[1]),
                {
                    originalPath: filePaths[1],
                    transformedPath: null,
                    diagnostics: [{
                        message: "File is not contained within a recognized Sources/ folder",
                        sourceFile: filePaths[1],
                        kind: TestFileDiagnosticKind.fileNotInSourcesFolder
                    }],
                },
            );
            assert.deepStrictEqual(
                // /Package/Path/Tests/ExplicitPathTests/Subdirectory/BTests.swift
                await sut.suggestedTestPathFor(filePaths[2]),
                {
                    originalPath: filePaths[2],
                    transformedPath: null,
                    diagnostics: [{
                        message: "File is not contained within a recognized Sources/ folder",
                        sourceFile: filePaths[2],
                        kind: TestFileDiagnosticKind.fileNotInSourcesFolder
                    }],
                },
            );
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
