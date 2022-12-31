import { DirectedGraph } from "../algorithms/directedGraph";
import { SwiftPackageManifest, SwiftTarget } from "./swiftPackage";
import { targetDependenciesByName } from "./swiftPackage.ext";

/**
 * Represents the dependency graph of a package manifest.
 */
export class SwiftDependencyGraph extends DirectedGraph<string, number, number> {
    private _nextNodeId = 0;
    private _nextEdgeId = 0;
    private _targetNameMap: Map<string, number>;

    constructor(pkg: SwiftPackageManifest) {
        super();

        this._targetNameMap = new Map();

        for (const target of pkg.targets) {
            let targetId = this.ensureNode(target.name);

            const dependencies = targetDependenciesByName(target);

            for (const dependencyName of dependencies) {
                let dependencyId = this.ensureNode(dependencyName);
                
                this.createEdge(dependencyId, targetId);
            }
        }
    }

    private ensureNode(targetName: string) {
        let targetId = this._targetNameMap.get(targetName);
        if (targetId === undefined) {
            targetId = this.createNode(targetName);
            this._targetNameMap.set(targetName, targetId);
        }

        return targetId;
    }

    dependentsOf(target: SwiftTarget | string): string[] {
        const id = this._nodeIdForTarget(target);
        if (id === undefined) {
            return [];
        }

        return this.nodesFrom(id);
    }

    dependenciesFor(target: SwiftTarget | string): string[] {
        const id = this._nodeIdForTarget(target);
        if (id === undefined) {
            return [];
        }

        return this.nodesTo(id);
    }

    hasDependencyPath(target: SwiftTarget | string, dependency: SwiftTarget | string): boolean {
        const targetId =  this._nodeIdForTarget(target);
        const dependencyTargetId =  this._nodeIdForTarget(dependency);
        if (targetId === undefined || dependencyTargetId === undefined) {
            return false;
        }

        return this.hasPathBetween(dependencyTargetId, targetId);
    }

    hasDirectDependency(target: SwiftTarget | string, dependency: SwiftTarget | string): boolean {
        const targetId =  this._nodeIdForTarget(target);
        const dependencyTargetId =  this._nodeIdForTarget(dependency);
        if (targetId === undefined || dependencyTargetId === undefined) {
            return false;
        }

        return this.hasEdgeBetween(dependencyTargetId, targetId);
    }

    private _nodeIdForTarget(target: SwiftTarget | string): number | undefined {
        if (typeof target === "string") {
            return this._targetNameMap.get(target);
        }
        return this._targetNameMap.get(target.name);
    }

    // Abstract implementations

    generateNodeId(): number {
        return this._nextNodeId++;
    }

    generateEdgeId(): number {
        return this._nextEdgeId++;
    }
}
