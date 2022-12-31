import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { DirectedGraph } from '../../../algorithms/directedGraph';

suite('directedGraph.ts Test Suite', () => {
    describe('DirectedGraph', () => {
        let sut: TestDirectedGraph<string>;
        beforeEach(() => {
            sut = new TestDirectedGraph();
        });

        describe('createNode', () => {
            it('must create and return a valid node ID', () => {
                const nodeId = sut.createNode('node1');

                assert.ok(sut.hasNodeId(nodeId));
            });

            it('must create and return different IDs after each invocation', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');

                assert.notStrictEqual(node1, node2);
            });
        });

        describe('createEdge', () => {
            it('must create and return a valid edge ID', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');

                const edge = sut.createEdge(node1, node2);

                assert.ok(sut.hasEdgeId(edge));
            });

            it('must return existing edges if invoked between the same nodes multiple times', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');

                const edge1 = sut.createEdge(node1, node2);
                const edge2 = sut.createEdge(node1, node2);
                const revEdge1 = sut.createEdge(node2, node1);

                assert.strictEqual(edge1, edge2);
                assert.notStrictEqual(edge1, revEdge1);
                assert.notStrictEqual(edge2, revEdge1);
            });
        });

        describe('hasNodeId', () => {
            it('must return true if node exists in graph', () => {
                const nodeId = sut.createNode('node1');

                assert.ok(sut.hasNodeId(nodeId));
            });

            it('must return false if node does not exist in graph', () => {
                assert.ok(!sut.hasNodeId(0));
            });
        });

        describe('hasEdgeId', () => {
            it('must return true if edge exists in graph', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');

                const edge = sut.createEdge(node1, node2);

                assert.ok(sut.hasEdgeId(edge));
            });

            it('must return false if edge does not exist in graph', () => {
                assert.ok(!sut.hasEdgeId(0));
            });
        });

        describe('hasPathBetween', () => {
            it('must return true if any path between the nodes exists in graph', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');
                const node3 = sut.createNode('node3');
                const node4 = sut.createNode('node4');

                sut.createEdge(node1, node2);
                sut.createEdge(node2, node3);
                sut.createEdge(node3, node4);

                assert.ok(sut.hasPathBetween(node1, node4));
            });

            it('must return false if no paths between the nodes exist in graph', () => {
                const node1 = sut.createNode('node1');
                const node2 = sut.createNode('node2');

                assert.ok(!sut.hasPathBetween(node1, node2));
            });
        });

        describe('breadthFirstVisit', () => {
            it('must visit the graph in breadth-first order', () => {
                const nodes = mockNestedGraph(sut);

                const visits: number[][] = [];

                sut.breadthFirstVisit(nodes[0], (_data, id, path) => {
                    visits.push(path.concat(id));

                    return true;
                });

                assert.deepStrictEqual(visits, [
                    [nodes[0], nodes[1]],
                    [nodes[0], nodes[4]],
                    [nodes[0], nodes[5]],
                    [nodes[0], nodes[1], nodes[2]],
                    [nodes[0], nodes[1], nodes[2], nodes[3]],
                ]);
            });

            it('must not visit subsequent nodes if false is returned', () => {
                const nodes = mockNestedGraph(sut);

                const visits: number[][] = [];

                sut.breadthFirstVisit(nodes[0], (_data, id, path) => {
                    visits.push(path.concat(id));

                    return false;
                });

                assert.deepStrictEqual(visits, [
                    [nodes[0], nodes[1]],
                    [nodes[0], nodes[4]],
                    [nodes[0], nodes[5]],
                ]);
            });
        });

        describe('depthFirstVisit', () => {
            it('must visit the graph in depth-first order', () => {
                const nodes = mockNestedGraph(sut);

                const visits: number[][] = [];

                sut.depthFirstVisit(nodes[0], (_data, id, path) => {
                    visits.push(path.concat(id));

                    return true;
                });

                assert.deepStrictEqual(visits, [
                    [nodes[0], nodes[1]],
                    [nodes[0], nodes[1], nodes[2]],
                    [nodes[0], nodes[1], nodes[2], nodes[3]],
                    [nodes[0], nodes[4]],
                    [nodes[0], nodes[5]],
                ]);
            });

            it('must not visit subsequent nodes if false is returned', () => {
                const nodes = mockNestedGraph(sut);

                const visits: number[][] = [];

                sut.depthFirstVisit(nodes[0], (_data, id, path) => {
                    visits.push(path.concat(id));

                    return false;
                });

                assert.deepStrictEqual(visits, [
                    [nodes[0], nodes[1]],
                    [nodes[0], nodes[4]],
                    [nodes[0], nodes[5]],
                ]);
            });
        });

        describe('topologicalSorted', () => {
            it('must return topologically sorted list for non-cyclic graphs', () => {
                const nodeIds = mockNestedGraph(sut);
                const nodes = nodeIds.map((id) => sut.getNodeData(id));

                const result = sut.topologicalSorted();

                assert.deepStrictEqual(result, [
                    nodes[0],
                    nodes[1],
                    nodes[2],
                    nodes[3],
                    nodes[4],
                    nodes[5],
                ]);
            });

            it('must return null for cyclic graphs', () => {
                const nodeIds = mockNestedGraph(sut);
                sut.createEdge(nodeIds[5], nodeIds[0]);

                const result = sut.topologicalSorted();

                assert.strictEqual(result, null);
            });
        });
    });
});

function mockNestedGraph(graph: TestDirectedGraph<string>): number[] {
    const node1 = graph.createNode('node1');
    const node2 = graph.createNode('node2');
    const node3 = graph.createNode('node3');
    const node4 = graph.createNode('node4');
    const node5 = graph.createNode('node5');
    const node6 = graph.createNode('node6');

    graph.createEdge(node1, node2);
    graph.createEdge(node2, node3);
    graph.createEdge(node3, node4);
    graph.createEdge(node1, node5);
    graph.createEdge(node1, node6);
    
    return [node1, node2, node3, node4, node5, node6];
}

class TestDirectedGraph<T> extends DirectedGraph<T, number, number> {
    private _nextNodeId = 0;
    private _nextEdgeId = 0;

    generateNodeId(): number {
        return this._nextNodeId++;
    }

    generateEdgeId(): number {
        return this._nextEdgeId++;
    }
}
