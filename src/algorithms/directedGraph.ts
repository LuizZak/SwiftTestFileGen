import { assert } from "console";

/** An interface for a directed graph. */
export interface DirectedGraphInterface<T, TNodeId, TEdgeId> {
    allNodeIds(): Set<TNodeId>;
    allEdgeIds(): Set<TEdgeId>;

    getNodeData(nodeId: TNodeId): T | null;
    edgesFrom(start: TNodeId): Set<TEdgeId>;
    edgesTo(end: TNodeId): Set<TEdgeId>;
    edgeEnd(edgeId: TEdgeId): TNodeId | null;
    edgeStart(edgeId: TEdgeId): TNodeId | null;

    nodesFrom(start: TNodeId): T[];
    nodesTo(end: TNodeId): T[];

    nodeIdsFrom(start: TNodeId): Set<TNodeId>;
    nodeIdsTo(end: TNodeId): Set<TNodeId>;

    hasNodeId(nodeId: TNodeId): boolean;
    hasEdgeId(edgeId: TEdgeId): boolean;

    edgeBetween(start: TNodeId, end: TNodeId): TEdgeId | null;
    hasEdgeBetween(start: TNodeId, end: TNodeId): boolean;
    hasPathBetween(start: TNodeId, end: TNodeId): boolean;

    createNode(data: T): TNodeId;
    createEdge(start: TNodeId, end: TNodeId): TEdgeId;

    breadthFirstVisit(
        start: TNodeId,
        shouldVisit: (data: T, id: TNodeId, leadingPath: TNodeId[]) => boolean
    ): void;

    depthFirstVisit(
        start: TNodeId,
        shouldVisit: (data: T, id: TNodeId, leadingPath: TNodeId[]) => boolean
    ): void;

    topologicalSorted(): T[] | null;

    generateNodeId(): TNodeId;
    generateEdgeId(): TEdgeId;
}

export abstract class DirectedGraph<T, TNodeId, TEdgeId> implements DirectedGraphInterface<T, TNodeId, TEdgeId> {
    private nodes: Set<NodeStorage<T, TNodeId>>;
    private edges: Set<EdgeStorage<TNodeId, TEdgeId>>;

    constructor() {
        this.nodes = new Set();
        this.edges = new Set();
    }

    allNodeIds(): Set<TNodeId> {
        const result = new Set<TNodeId>();
        for (const node of this.nodes) {
            result.add(node.id);
        }

        return result;
    }

    allEdgeIds(): Set<TEdgeId> {
        const result = new Set<TEdgeId>();
        for (const edge of this.edges) {
            result.add(edge.id);
        }

        return result;
    }

    getNodeData(nodeId: TNodeId): T | null {
        for (const node of this.nodes) {
            if (node.idEquals(nodeId)) {
                return node.data;
            }
        }

        return null;
    }

    edgesFrom(start: TNodeId): Set<TEdgeId> {
        const result = new Set<TEdgeId>();
        for (const edge of this.edges) {
            if (edge.start === start) {
                result.add(edge.id);
            }
        }

        return result;
    }

    edgesTo(end: TNodeId): Set<TEdgeId> {
        const result = new Set<TEdgeId>();
        for (const edge of this.edges) {
            if (edge.end === end) {
                result.add(edge.id);
            }
        }

        return result;
    }

    edgeEnd(edgeId: TEdgeId): TNodeId | null {
        for (const edge of this.edges) {
            if (edge.idEquals(edgeId)) {
                return edge.end;
            }
        }

        return null;
    }

    edgeStart(edgeId: TEdgeId): TNodeId | null {
        for (const edge of this.edges) {
            if (edge.idEquals(edgeId)) {
                return edge.start;
            }
        }

        return null;
    }

    nodesFrom(start: TNodeId): T[] {
        const result: T[] = [];
        for (const edge of this.edges) {
            if (edge.start === start) {
                const data = this.getNodeData(edge.end);

                if (data !== null) {
                    result.push(data);
                }
            }
        }

        return result;
    }

    nodesTo(end: TNodeId): T[] {
        const result: T[] = [];
        for (const edge of this.edges) {
            if (edge.end === end) {
                const data = this.getNodeData(edge.start);
                
                if (data !== null) {
                    result.push(data);
                }
            }
        }

        return result;
    }

    nodeIdsFrom(start: TNodeId): Set<TNodeId> {
        const result: Set<TNodeId> = new Set();
        for (const edge of this.edges) {
            if (edge.start === start) {
                result.add(edge.end);
            }
        }

        return result;
    }

    nodeIdsTo(end: TNodeId): Set<TNodeId> {
        const result: Set<TNodeId> = new Set();
        for (const edge of this.edges) {
            if (edge.end === end) {
                result.add(edge.start);
            }
        }

        return result;
    }

    hasNodeId(nodeId: TNodeId): boolean {
        for (const node of this.nodes) {
            if (node.idEquals(nodeId)) {
                return true;
            }
        }

        return false;
    }

    hasEdgeId(edgeId: TEdgeId): boolean {
        for (const edge of this.edges) {
            if (edge.idEquals(edgeId)) {
                return true;
            }
        }

        return false;
    }
    
    edgeBetween(start: TNodeId, end: TNodeId): TEdgeId | null {
        for (const edge of this.edges) {
            if (edge.start === start && edge.end === end) {
                return edge.id;
            }
        }

        return null;
    }

    hasEdgeBetween(start: TNodeId, end: TNodeId): boolean {
        for (const edge of this._edgesFrom(start)) {
            if (edge.end === end) {
                return true;
            }
        }

        return false;
    }

    hasPathBetween(start: TNodeId, end: TNodeId): boolean {
        let found = false;

        this.breadthFirstVisit(start, (_data, next) => {
            if (next === end) {
                found = true;
            }

            return !found;
        });

        return found;
    }

    createNode(data: T): TNodeId {
        const node = new NodeStorage<T, TNodeId>(data, this.generateNodeId());
        this.nodes.add(node);

        return node.id;
    }

    createEdge(start: TNodeId, end: TNodeId): TEdgeId {
        assert(this.hasNodeId(start), `Cannot connect start node ID ${start} that does not exist in this graph.`);
        assert(this.hasNodeId(end), `Cannot connect end node ID ${end} that does not exist in this graph.`);

        const existing = this.edgeBetween(start, end);
        if (existing !== null) {
            return existing;
        }

        const edge = new EdgeStorage<TNodeId, TEdgeId>(start, end, this.generateEdgeId());
        this.edges.add(edge);

        return edge.id;
    }

    breadthFirstVisit(
        start: TNodeId,
        shouldVisit: (data: T, id: TNodeId, leadingPath: TNodeId[]) => boolean
    ): void {

        const queue: [TNodeId, TNodeId[]][] = [[start, []]];
        const visited: Set<TNodeId> = new Set();

        while (queue.length > 0) {
            const value = queue.shift();
            if (value === undefined) {
                break;
            }
            const node = value[0];
            const path = value[1];

            visited.add(node);

            const data = this.getNodeData(node);
            if (data === null) {
                continue;
            }
            if (node !== start && !shouldVisit(data, node, path)) {
                continue;
            }

            const totalPath = path.concat(node);
            
            const edges = this._edgesFrom(node);

            for (const edge of edges) {
                const next = edge.end;
                if (visited.has(next)) {
                    continue;
                }

                queue.push([next, totalPath]);
            }
        }
    }

    depthFirstVisit(
        start: TNodeId,
        shouldVisit: (data: T, id: TNodeId, leadingPath: TNodeId[]) => boolean
    ): void {

        const stack: [TNodeId, TNodeId[]][] = [[start, []]];
        const visited: Set<TNodeId> = new Set();

        while (stack.length > 0) {
            const value = stack.pop();
            if (value === undefined) {
                break;
            }
            const node = value[0];
            const path = value[1];

            visited.add(node);

            const data = this.getNodeData(node);
            if (data === null) {
                continue;
            }
            if (node !== start && !shouldVisit(data, node, path)) {
                continue;
            }

            const totalPath = path.concat(node);
            
            let edges = Array.from(this._edgesFrom(node));
            edges = edges.reverse();

            for (const edge of edges) {
                const next = edge.end;
                if (visited.has(next)) {
                    continue;
                }

                stack.push([next, totalPath]);
            }
        }
    }

    /**
     * Returns a list which represents the [topologically sorted](https://en.wikipedia.org/wiki/Topological_sorting)
     * nodes of this graph.
     * 
     * Returns null, in case it cannot be topologically sorted, e.g. when any
     * cycles are found.
     * 
     * @returns A list of the nodes from this graph, topologically sorted, or
     * `null`, in case it cannot be sorted.
     */
    topologicalSorted(): T[] | null {
        const permanentMark = new Set<TNodeId>();
        const temporaryMark = new Set<TNodeId>();
        
        const unmarkedNodes = Array.from(this.allNodeIds());
        const list: T[] = [];
        
        function visit(graph: DirectedGraph<T, TNodeId, TEdgeId>, node: TNodeId): boolean {
            if (permanentMark.has(node)) {
                return true;
            }
            if (temporaryMark.has(node)) {
                return false;
            }

            temporaryMark.add(node);
            for (const next of graph.nodeIdsFrom(node)) {
                if (!visit(graph, next)) {
                    return false;
                }
            }
            
            permanentMark.add(node);

            const data = graph.getNodeData(node);
            if (data) {
                list.unshift(data);
            }

            return true;
        }
        
        while (unmarkedNodes.length > 0) {
            const node = unmarkedNodes.pop();
            if (node === undefined) {
                continue;
            }

            if (!visit(this, node)) {
                return null;
            }
        }
        
        return list;
    }

    private _edgesFrom(start: TNodeId): Set<EdgeStorage<TNodeId, TEdgeId>> {
        const result = new Set<EdgeStorage<TNodeId, TEdgeId>>();
        for (const edge of this.edges) {
            if (edge.start === start) {
                result.add(edge);
            }
        }

        return result;
    }
    private _edgesTo(end: TNodeId): Set<EdgeStorage<TNodeId, TEdgeId>> {
        const result = new Set<EdgeStorage<TNodeId, TEdgeId>>();
        for (const edge of this.edges) {
            if (edge.end === end) {
                result.add(edge);
            }
        }

        return result;
    }

    abstract generateNodeId(): TNodeId;
    abstract generateEdgeId(): TEdgeId;
}

class NodeStorage<T, TNodeId> {
    constructor(public data: T, public id: TNodeId) {

    }

    idEquals(value: TNodeId): boolean {
        return this.id === value;
    }
}

class EdgeStorage<TNodeId, TEdgeId> {
    constructor(public start: TNodeId, public end: TNodeId, public id: TEdgeId) {
        
    }

    idEquals(value: TEdgeId): boolean {
        return this.id === value;
    }
}
