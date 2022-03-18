import * as assert from 'assert';
import { describe, it } from 'mocha';
import { SwiftPackageManifestParser } from '../../../data/swiftPackage';

suite('swiftPackage Test Suite', () => {
    describe('SwiftPackageManifestParser', () => {
        describe('toSwiftPackageManifest', () => {
            it("should recognize 'regular' targets", () => {
                assertParsesTargetType("regular");
            });

            it("should recognize 'test' targets", () => {
                assertParsesTargetType("test");
            });

            it("should recognize 'executable' targets", () => {
                assertParsesTargetType("executable");
            });

            it("should recognize 'system' targets", () => {
                assertParsesTargetType("system");
            });

            it("should recognize 'binary' targets", () => {
                assertParsesTargetType("binary");
            });

            it("should recognize 'plugin' targets", () => {
                assertParsesTargetType("plugin");
            });

            it("should recognize 'snippet' targets", () => {
                assertParsesTargetType("snippet");
            });
        });
    });
});

function assertParsesTargetType(targetType: string) {
    const json = makePackageJson(targetType);

    const pkg = SwiftPackageManifestParser.toSwiftPackageManifest(json);

    assert.ok(pkg.targets[0]);
    assert.strictEqual(pkg.targets[0].type, targetType);
}

function makePackageJson(targetType: string): string {
    const pkg = {
        name: "TestPackage",
        targets: [
            {
                name: "",
                type: targetType
            }
        ],
        toolsVersion: {
            _version: "5.5.0",
        },
    };

    return JSON.stringify(pkg);
}
