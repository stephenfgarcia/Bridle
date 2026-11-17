/**
 * Degrees of freedom and their numbering in the global system.
 *
 * Every node has six degrees of freedom, in this order: `ux`, `uy`, `uz` (translations along the
 * axes, m) and `rx`, `ry`, `rz` (rotations about the axes, rad, positive by the right-hand rule).
 * The same six names and the same order are used at a node in the global axes and at a member end
 * in the member's local axes. The force that goes with a translation and the moment that goes with
 * a rotation are positive in the same sense.
 */

/** The six degrees of freedom of a node, in the order the solver numbers them. */
export const DOFS = ["ux", "uy", "uz", "rx", "ry", "rz"] as const;

export type Dof = (typeof DOFS)[number];

/** The number of degrees of freedom of one node. */
export const DOFS_PER_NODE = 6;

/**
 * The map from a node and a degree of freedom to a row (and column) of the global matrix. The nodes
 * are in the model's order: node number `n` (from 0) of `nodeIds` owns rows `6n` to `6n + 5`, in the
 * order of `DOFS`. It is plain data (no functions), so it can be passed to and from a Web Worker.
 */
export interface DofMap {
  /** The node ids, in the model's order. */
  nodeIds: string[];
  /** The position of each node id in `nodeIds`. */
  nodeIndex: Map<string, number>;
  /** The size of the global matrix: six times the number of nodes. */
  size: number;
}

/** The map for a list of nodes, in the order given. Node ids are taken to be unique. */
export function buildDofMap(nodes: readonly { id: string }[]): DofMap {
  const nodeIds = nodes.map((node) => node.id);
  const nodeIndex = new Map(nodeIds.map((id, index) => [id, index]));
  return { nodeIds, nodeIndex, size: DOFS_PER_NODE * nodeIds.length };
}

/** The row of a node's degree of freedom, or `undefined` when the map has no such node. */
export function dofIndex(map: DofMap, nodeId: string, dof: Dof): number | undefined {
  const node = map.nodeIndex.get(nodeId);
  return node === undefined ? undefined : DOFS_PER_NODE * node + DOFS.indexOf(dof);
}

/**
 * The twelve global rows of a member's degrees of freedom: the six of the start node, then the six
 * of the end node. `undefined` when the map lacks one of the two nodes.
 */
export function memberDofIndices(
  map: DofMap,
  startNodeId: string,
  endNodeId: string,
): number[] | undefined {
  const start = map.nodeIndex.get(startNodeId);
  const end = map.nodeIndex.get(endNodeId);
  if (start === undefined || end === undefined) {
    return undefined;
  }
  const rows: number[] = [];
  for (const node of [start, end]) {
    for (let d = 0; d < DOFS_PER_NODE; d++) {
      rows.push(DOFS_PER_NODE * node + d);
    }
  }
  return rows;
}
