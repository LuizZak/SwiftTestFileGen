import * as assert from 'assert';
import { describe, it } from 'mocha';
import { targetDependenciesByName } from '../../../data/swiftPackage.ext';
import { SwiftPackageManifest, SwiftPackageManifestParser } from '../../../data/swiftPackage';

suite('swiftPackage.ext Test Suite', () => {
    describe('targetDependenciesByName', () => {
        it('must return target dependencies from "byName" and "product" entries', () => {
            const sut = makeTestPackage();

            const result = targetDependenciesByName(sut.targets[0]);

            assert.deepStrictEqual(result, [
                "ObjcGrammarModels",
                "ObjcParser",
                "SwiftSyntaxParser",
                "SwiftFormat",
            ]);
        });
    });
});

function makeTestPackage(): SwiftPackageManifest {
    const json = makePackageJson();
    const pkg = SwiftPackageManifestParser.toSwiftPackageManifest(json);

    return pkg;
}

function makePackageJson(): string {
    const pkg = {
        name: "TestPackage",
        targets: [
            {
                name: "TargetA",
                type: "regular",
                dependencies: [
                    {
                        "byName": [
                            "ObjcGrammarModels",
                            null
                        ]
                    },
                    {
                        "byName": [
                            "ObjcParser",
                            null
                        ]
                    },
                    {
                        "product": [
                            "SwiftSyntaxParser",
                            "swift-syntax",
                            null,
                            null
                        ]
                    },
                    {
                        "product": [
                            "SwiftFormat",
                            "swift-format",
                            null,
                            null
                        ]
                    },
                ]
            },
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };

    return JSON.stringify(pkg);
}
