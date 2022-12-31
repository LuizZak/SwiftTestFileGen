import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { SwiftDependencyGraph } from '../../../data/swiftDependencyGraph';
import { SwiftPackageManifest, TargetType } from '../../../data/swiftPackage';
import { stubPackage } from '../fullTestFixture';
import { makePackageDependency, makeStringDependency } from '../testMocks/testDataFactory';

suite('swiftDependencyGraph.ts Test Suite', () => {
    describe('SwiftDependencyGraph', () => {
        let pkg: SwiftPackageManifest;
        let sut: SwiftDependencyGraph;
        beforeEach(() => {
            pkg = stubPackage([
                {
                    name: "Target2",
                    type: TargetType.Regular,
                    dependencies: [
                        makeStringDependency("Target1"),
                    ],
                },
                {
                    name: "Target3",
                    type: TargetType.Regular,
                    dependencies: [
                        makeStringDependency("Target2"),
                        makePackageDependency("ExternalTarget", "external-lib"),
                    ],
                },
                {
                    name: "Target1",
                    type: TargetType.Regular,
                },
                {
                    name: "Target4",
                    type: TargetType.Regular,
                    dependencies: [
                        makeStringDependency("Target1"),
                        makeStringDependency("Target3"),
                    ],
                },
            ]);
            sut = new SwiftDependencyGraph(pkg);
        });

        describe('dependentsOf', () => {
            it('must return dependents appropriately', () => {
                const result = sut.dependentsOf("Target1");

                assert.deepStrictEqual(result,
                    [
                        "Target2",
                        "Target4",
                    ]
                );
            });

            it('must return dependents of external targets', () => {
                const result = sut.dependentsOf("ExternalTarget");

                assert.deepStrictEqual(result,
                    [
                        "Target3",
                    ]
                );
            });
        });

        describe('dependenciesFor', () => {
            it('must return dependencies appropriately', () => {
                assert.deepStrictEqual(
                    sut.dependenciesFor("Target4"),
                    [
                        "Target1",
                        "Target3",
                    ]
                );
                assert.deepStrictEqual(
                    sut.dependenciesFor("Target3"),
                    [
                        "Target2",
                        "ExternalTarget",
                    ]
                );
            });
        });

        describe('hasDependencyPath', () => {
            it('must return true for targets that have direct and/or indirect dependency', () => {
                const target = pkg.targets[3];
                const directDependency = "Target3";
                const indirectDependency = "Target2";

                assert.ok(sut.hasDependencyPath(target, directDependency));
                assert.ok(sut.hasDependencyPath(target, indirectDependency));
            });

            it('must return true for targets that have direct and/or indirect dependency on external targets', () => {
                const directTarget = "Target3";
                const indirectTarget = pkg.targets[3];
                const external = "ExternalTarget";

                assert.ok(sut.hasDependencyPath(directTarget, external));
                assert.ok(sut.hasDependencyPath(indirectTarget, external));
            });

            it('must return false for targets that have no direct or indirect dependency', () => {
                const target = "Target3";
                const unrelatedTarget = pkg.targets[3];

                assert.ok(!sut.hasDependencyPath(target, unrelatedTarget));
            });
        });

        describe('hasDirectDependency', () => {
            it('must return true for targets that have direct dependency', () => {
                const target = pkg.targets[3];
                const directDependency = "Target3";

                assert.ok(sut.hasDirectDependency(target, directDependency));
            });

            it('must return true for targets that have direct dependency on external targets', () => {
                const directTarget = "Target3";
                const external = "ExternalTarget";

                assert.ok(sut.hasDependencyPath(directTarget, external));
            });

            it('must return false for targets that have indirect dependency', () => {
                const target = "Target4";
                const indirectDependency = "Target2";

                assert.ok(!sut.hasDirectDependency(target, indirectDependency));
            });

            it('must return true for targets that have indirect dependency on external targets', () => {
                const indirectTarget = "Target4";
                const external = "ExternalTarget";

                assert.ok(sut.hasDependencyPath(indirectTarget, external));
            });

            it('must return false for targets that have no direct or indirect dependency', () => {
                const target = "Target3";
                const unrelatedTarget = "Target4";

                assert.ok(!sut.hasDirectDependency(target, unrelatedTarget));
            });
        });

        test('topologicalSorted', () => {
            const result = sut.topologicalSorted();

            assert.deepStrictEqual(result,
                [
                    "Target1",
                    "Target2",
                    "ExternalTarget",
                    "Target3",
                    "Target4",
                ]
            );
        });
    });
});
