import * as assert from 'assert';
import { describe, beforeEach } from 'mocha';
import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { SwiftPackagePathsManager } from '../../swiftPackagePathsManager';
import { TestFileSystem } from './testMocks/testContext';
import { VirtualDiskEntryType } from './testMocks/virtualFileDisk';

suite('swiftPackagePathsManager Test Suite', () => {
    describe("swiftPackagePathsManager", () => {
        let fileSystem: TestFileSystem;
        beforeEach(() => {
            fileSystem = new TestFileSystem();
        });

        describe('isSourceFile', () => {
            test('returns true for files in Sources/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });
            
            test('returns true for files in Executable targets in Sources/', async () => {
                const pkg = makeStandardTestPackage();
                pkg.targets[0].type = TargetType.Executable;

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });
            
            test('returns true for files in Plugin targets in Sources/', async () => {
                const pkg = makeStandardTestPackage();
                pkg.targets[0].type = TargetType.Plugin;

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });
            
            test('returns false for files in Test targets in Sources/', async () => {
                const pkg = makeStandardTestPackage();
                pkg.targets[0].type = TargetType.Test;
                pkg.targets[0].path = "Sources";

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), false);
            });

            test('returns true for files in Source/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Source", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });

            test('returns true for files in src/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "src", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });

            test('returns true for files in srcs/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "srcs", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });

            test('returns true for files in custom path source target', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeSources", "Target", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), true);
            });

            test('returns false for files in test locations', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeTests", "TargetTests", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isSourceFile(fileUri), false);
            });

            test('returns false for files in non-source locations', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(
                    await sut.isSourceFile(
                        vscode.Uri.joinPath(baseUri, "UnknownFolder", "file.swift"),
                    ),
                    false
                );
                assert.strictEqual(
                    await sut.isSourceFile(
                        vscode.Uri.joinPath(baseUri, "UnknownFolder2", "Subfolder", "file.swift"),
                    ),
                    false
                );
            });
        });

        describe('isTestFile', () => {
            test('returns true for files in Tests/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Tests", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns true for files in Sources/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns true for files in Source/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "Source", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns true for files in src/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "src", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns true for files in srcs/', async () => {
                const pkg = makeStandardTestPackage();

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "srcs", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns true for files in custom path test target', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeTests", "TargetTests", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), true);
            });

            test('returns false for files in source locations', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");
                const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeSources", "Target", "file.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                    [fileUri, VirtualDiskEntryType.file]
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(await sut.isTestFile(fileUri), false);
            });

            test('returns false for files in non-target locations', async () => {
                const pkg = makeExplicitTestTargetPathPackage(
                    "AlternativeSources",
                    "AlternativeTests"
                );

                const baseUri = vscode.Uri.file(path.join("base", "path"));
                const manifestUri = vscode.Uri.joinPath(baseUri, "Package.swift");

                fileSystem.createEntriesWithKind(
                    [baseUri, VirtualDiskEntryType.directory],
                );

                const sut = await SwiftPackagePathsManager.create(baseUri, manifestUri, pkg, fileSystem);

                assert.strictEqual(
                    await sut.isTestFile(
                        vscode.Uri.joinPath(baseUri, "UnknownFolder", "file.swift"),
                    ),
                    false
                );
                assert.strictEqual(
                    await sut.isTestFile(
                        vscode.Uri.joinPath(baseUri, "UnknownFolder2", "Subfolder", "file.swift"),
                    ),
                    false
                );
            });
        });
    });
});

function makeStandardTestPackage(targetName: string = "Target", testTargetName: string = "TargetTests"): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: targetName,
                type: TargetType.Regular,
            },
            {
                name: testTargetName,
                type: TargetType.Test,
            },
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };
}

function makeExplicitTestTargetPathPackage(sourcesPath: string, testsPath: string): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: "Target",
                type: TargetType.Regular,
                path: `${sourcesPath}/Target`
            },
            {
                name: "TargetTests",
                type: TargetType.Test,
                path: `${testsPath}/TargetTests`
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
