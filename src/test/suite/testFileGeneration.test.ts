import * as assert from 'assert';
import * as vscode from 'vscode';
import { SwiftPackageManifest, SwiftPackageManifestParser, TargetType } from '../../data/swiftPackage';
import { proposeTestFiles } from '../../testFileGeneration';

suite('Test File Generation Test Suite', () => {
	test('proposeTestFiles with target rooted in Sources/', () => {
        const testPackage = makeSingleTargetTestPackage();

        const packageRoot = vscode.Uri.file("Package/Path");
		const filePaths: vscode.Uri[] = [
            vscode.Uri.file("/Package/Path/Sources/A.swift"),
            vscode.Uri.file("/Package/Path/Sources/B.swift"),
        ];
        
        const result = proposeTestFiles(filePaths, packageRoot, testPackage);

        assert.deepStrictEqual(
            result,
            [
                {
                    name: "ATests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/ATests.swift"),
                    contents: makeExpectedTestString("Target", "ATests")
                },
                {
                    name: "BTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/BTests.swift"),
                    contents: makeExpectedTestString("Target", "BTests")
                },
            ]
        );
	});

    test('proposeTestFiles with file in nested folder', () => {
        const testPackage = makeMultiTargetTestPackage();

        const packageRoot = vscode.Uri.file("Package/Path");
		const filePaths: vscode.Uri[] = [
            vscode.Uri.file("/Package/Path/Sources/Target/SubfolderA/A.swift"),
            vscode.Uri.file("/Package/Path/Sources/TargetWithPath/SubfolderA/SubfolderB/B.swift"),
        ];
        
        const result = proposeTestFiles(filePaths, packageRoot, testPackage);

        assert.deepStrictEqual(
            result,
            [
                {
                    name: "ATests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetTests/SubfolderA/ATests.swift"),
                    contents: makeExpectedTestString("Target", "ATests")
                },
                {
                    name: "BTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/SubfolderA/SubfolderB/BTests.swift"),
                    contents: makeExpectedTestString("TargetWithPath", "BTests")
                },
            ]
        );
	});

    test('proposeTestFiles with target with explicit path', () => {
        const testPackage = makeMultiTargetTestPackage();

        const packageRoot = vscode.Uri.file("Package/Path");
		const filePaths: vscode.Uri[] = [
            vscode.Uri.file("/Package/Path/Sources/ExplicitPath/A.swift"),
            vscode.Uri.file("/Package/Path/Sources/ExplicitPath/B.swift"),
        ];
        
        const result = proposeTestFiles(filePaths, packageRoot, testPackage);

        assert.deepStrictEqual(
            result,
            [
                {
                    name: "ATests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/ATests.swift"),
                    contents: makeExpectedTestString("TargetWithPath", "ATests")
                },
                {
                    name: "BTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetWithPathTests/BTests.swift"),
                    contents: makeExpectedTestString("TargetWithPath", "BTests")
                },
            ]
        );
	});

    test('proposeTestFiles with test target with explicit path', () => {
        const testPackage = makeExplicitTestTargetPathTestPackage();

        const packageRoot = vscode.Uri.file("Package/Path");
		const filePaths: vscode.Uri[] = [
            vscode.Uri.file("/Package/Path/Sources/Target/A.swift"),
            vscode.Uri.file("/Package/Path/Sources/Target/B.swift"),
        ];
        
        const result = proposeTestFiles(filePaths, packageRoot, testPackage);

        assert.deepStrictEqual(
            result,
            [
                {
                    name: "ATests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/ATests.swift"),
                    contents: makeExpectedTestString("Target", "ATests")
                },
                {
                    name: "BTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/AlternatePath/BTests.swift"),
                    contents: makeExpectedTestString("Target", "BTests")
                },
            ]
        );
	});

    test('proposeTestFiles with unknown targets', () => {
        const testPackage = makeEmptyTestPackage();

        const packageRoot = vscode.Uri.file("Package/Path");
		const filePaths: vscode.Uri[] = [
            vscode.Uri.file("/Package/Path/Sources/TargetA/A.swift"),
            vscode.Uri.file("/Package/Path/Sources/TargetB/B.swift"),
            vscode.Uri.file("/Package/Path/Sources/C.swift"),
        ];
        
        const result = proposeTestFiles(filePaths, packageRoot, testPackage);

        assert.deepStrictEqual(
            result,
            [
                {
                    name: "ATests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetATests/ATests.swift"),
                    contents: makeExpectedTestString("TargetA", "ATests")
                },
                {
                    name: "BTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/TargetBTests/BTests.swift"),
                    contents: makeExpectedTestString("TargetB", "BTests")
                },
                {
                    name: "CTests.swift",
                    path: vscode.Uri.file("/Package/Path/Tests/CTests.swift"),
                    contents: makeExpectedTestString("<#TargetName#>", "CTests")
                },
            ]
        );
	});
});

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
