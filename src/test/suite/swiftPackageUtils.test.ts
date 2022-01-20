import * as assert from 'assert';
import { describe } from 'mocha';
import path = require('path');
import * as vscode from 'vscode';
import { SwiftPackageManifest, TargetType } from '../../data/swiftPackage';
import { isSourceFile, isTestFile } from '../../swiftPackageUtils';


suite('swiftPackageUtils Test Suite', () => {
    describe('isSourceFile', () => {
        test('returns true for files in Sources/', () => {
            const pkg = makeEmptyTestPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "Sources", "file.swift");

            assert.strictEqual(isSourceFile(fileUri, baseUri, pkg), true);
        });

        test('returns true for files in Source/', () => {
            const pkg = makeEmptyTestPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "Source", "file.swift");

            assert.strictEqual(isSourceFile(fileUri, baseUri, pkg), true);
        });

        test('returns true for files in custom path source target', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeSources", "Target", "file.swift");

            assert.strictEqual(isSourceFile(fileUri, baseUri, pkg), true);
        });

        test('returns false for files in test locations', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeTests", "TargetTests", "file.swift");

            assert.strictEqual(isSourceFile(fileUri, baseUri, pkg), false);
        });

        test('returns false for files in non-source locations', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));

            assert.strictEqual(
                isSourceFile(
                    vscode.Uri.joinPath(baseUri, "UnknownFolder", "file.swift"),
                    baseUri,
                    pkg
                ),
                false
            );
            assert.strictEqual(
                isSourceFile(
                    vscode.Uri.joinPath(baseUri, "UnknownFolder2", "Subfolder", "file.swift"),
                    baseUri,
                    pkg
                ),
                false
            );
        });
    });

    describe('isTestFile', () => {
        test('returns true for files in Tests/', () => {
            const pkg = makeEmptyTestPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "Tests", "file.swift");

            assert.strictEqual(isTestFile(fileUri, baseUri, pkg), true);
        });

        test('returns true for files in Test/', () => {
            const pkg = makeEmptyTestPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "Test", "file.swift");

            assert.strictEqual(isTestFile(fileUri, baseUri, pkg), true);
        });

        test('returns true for files in custom path test target', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeTests", "TargetTests", "file.swift");

            assert.strictEqual(isTestFile(fileUri, baseUri, pkg), true);
        });

        test('returns false for files in source locations', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));
            const fileUri = vscode.Uri.joinPath(baseUri, "AlternativeSources", "Target", "file.swift");

            assert.strictEqual(isTestFile(fileUri, baseUri, pkg), false);
        });

        test('returns false for files in non-target locations', () => {
            const pkg = makeExplicitTestTargetPathPackage();

            const baseUri = vscode.Uri.file(path.join("base", "path"));

            assert.strictEqual(
                isTestFile(
                    vscode.Uri.joinPath(baseUri, "UnknownFolder", "file.swift"),
                    baseUri,
                    pkg
                ),
                false
            );
            assert.strictEqual(
                isTestFile(
                    vscode.Uri.joinPath(baseUri, "UnknownFolder2", "Subfolder", "file.swift"),
                    baseUri,
                    pkg
                ),
                false
            );
        });
    });
});

function makeExplicitTestTargetPathPackage(): SwiftPackageManifest {
    return {
        name: "TestPackage",
        targets: [
            {
                name: "Target",
                type: TargetType.Regular,
                path: "AlternativeSources/Target"
            },
            {
                name: "TargetTests",
                type: TargetType.Test,
                path: "AlternativeTests/TargetTests"
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
