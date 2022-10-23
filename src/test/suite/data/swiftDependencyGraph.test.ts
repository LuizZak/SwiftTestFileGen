import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { SwiftDependencyGraph } from '../../../data/swiftDependencyGraph';
import { SwiftPackageManifest, TargetType } from '../../../data/swiftPackage';
import { stubPackage } from '../fullTestFixture';

suite('swiftDependencyGraph.ts Test Suite', () => {
    describe('SwiftDependencyGraph', () => {
        let pkg: SwiftPackageManifest;
        let sut: SwiftDependencyGraph;
        beforeEach(() => {
            pkg = stubPackage([
                {
                    name: "Target1",
                    type: TargetType.Regular,
                },
                {
                    name: "Target2",
                    type: TargetType.Regular,
                    dependencies: [
                        {
                            byName: [
                                "Target1",
                                null,
                            ],
                        },
                    ],
                },
                {
                    name: "Target3",
                    type: TargetType.Regular,
                    dependencies: [
                        {
                            byName: [
                                "Target2",
                                null,
                            ],
                        },
                    ],
                },
                {
                    name: "Target4",
                    type: TargetType.Regular,
                    dependencies: [
                        {
                            byName: [
                                "Target1",
                                null,
                            ],
                        },
                        {
                            byName: [
                                "Target3",
                                null,
                            ],
                        },
                    ],
                },
            ]);
            sut = new SwiftDependencyGraph(pkg);
        });

        describe('dependentsOf', () => {
            it('must return dependents appropriately', () => {
                const result = sut.dependentsOf(pkg.targets[0]);

                assert.deepStrictEqual(result,
                    [
                        pkg.targets[1],
                        pkg.targets[3],
                    ]
                );
            });
        });

        describe('dependenciesFor', () => {
            it('must return dependencies appropriately', () => {
                const result = sut.dependenciesFor(pkg.targets[3]);

                assert.deepStrictEqual(result,
                    [
                        pkg.targets[0],
                        pkg.targets[2],
                    ]
                );
            });
        });

        test('topologicalSorted', () => {
            const result = sut.topologicalSorted();

            assert.deepStrictEqual(result,
                [
                    pkg.targets[0],
                    pkg.targets[1],
                    pkg.targets[2],
                    pkg.targets[3],
                ]
            );
        });
    });
});
