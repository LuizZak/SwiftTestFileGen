import { DirectedGraph } from "../algorithms/directedGraph";
import { SwiftPackageManifest, SwiftTarget } from "./swiftPackage";
import { targetDependenciesByName } from "./swiftPackage.ext";

export class SwiftDependencyGraph extends DirectedGraph<SwiftTarget, number, number> {
    private _nextNodeId = 0;
    private _nextEdgeId = 0;
    private _targetMap: Map<string, number>;

    constructor(pkg: SwiftPackageManifest) {
        super();

        this._targetMap = new Map();

        // Collect packages first
        for (const target of pkg.targets) {
            this._targetMap.set(target.name, this.createNode(target));
        }

        // Join targets
        for (const target of pkg.targets) {
            const targetId = this._targetMap.get(target.name);
            if (targetId === undefined) {
                continue;
            }

            const dependencies = targetDependenciesByName(target);

            for (const dependencyName of dependencies) {
                const dependencyId = this._targetMap.get(dependencyName);
                if (dependencyId === undefined) {
                    continue;
                }

                this.createEdge(dependencyId, targetId);
            }
        }
    }

    dependentsOf(target: SwiftTarget): SwiftTarget[] {
        const id = this._targetMap.get(target.name);
        if (id === undefined) {
            return [];
        }

        return this.nodesFrom(id);
    }

    dependenciesFor(target: SwiftTarget): SwiftTarget[] {
        const id = this._targetMap.get(target.name);
        if (id === undefined) {
            return [];
        }

        return this.nodesTo(id);
    }

    generateNodeId(): number {
        return this._nextNodeId++;
    }

    generateEdgeId(): number {
        return this._nextEdgeId++;
    }
}