/**
 * The models and the timing of the speed test. Used by ../bench/run.mjs (`pnpm bench`) and by
 * ./bench.test.ts; not exported by the package. The models are fixed by their arguments: no random
 * number is used.
 */
import type { Member, Model, Node, Support } from "@bridle/model";
import { solve } from "./solve";

const FIXED: Omit<Support, "nodeId"> = {
  ux: true,
  uy: true,
  uz: true,
  rx: true,
  ry: true,
  rz: true,
};

function frameMember(id: string, startNodeId: string, endNodeId: string): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    sectionId: "s1",
    materialId: "mat1",
    kind: "frame",
    rollAngleDeg: 0,
    releases: {
      start: { rx: false, ry: false, rz: false },
      end: { rx: false, ry: false, rz: false },
    },
  };
}

/** The section and the material of the fixtures of `@bridle/model`, and no load. */
function modelOf(nodes: Node[], members: Member[], supports: Support[]): Model {
  return {
    version: 1,
    units: { force: "kN", length: "m" },
    nodes,
    members,
    sections: [
      {
        id: "s1",
        name: "I 300x150",
        A: 5.4e-3,
        Iy: 8.4e-5,
        Iz: 6.0e-6,
        J: 2.0e-7,
        depthY: 0.15,
        depthZ: 0.3,
      },
    ],
    materials: [{ id: "mat1", name: "S355", E: 2.1e8, G: 8.1e7, fy: 3.55e5, density: 7850 }],
    supports,
    loadCases: [],
    nodalLoads: [],
    memberUniformLoads: [],
    memberPointLoads: [],
  };
}

/**
 * A building frame on a rectangular grid: `baysX` by `baysY` bays of 6 m by 5 m, `storeys` storeys
 * of 3.5 m, a column on every grid point and beams along X and along Y at every floor. The column
 * bases are fixed. It has (baysX + 1)(baysY + 1)(storeys + 1) nodes and
 * storeys · ((baysX + 1)(baysY + 1) + baysX (baysY + 1) + (baysX + 1) baysY) members.
 *
 * Two load cases: `gravity`, 12 kN/m downward on every beam, and `wind`, 8 kN along +X on every
 * node of the face x = 0 above the ground.
 */
export function buildingFrame(baysX: number, baysY: number, storeys: number): Model {
  const id = (i: number, j: number, level: number) => `n${i}_${j}_${level}`;
  const nodes: Node[] = [];
  const members: Member[] = [];
  const supports: Support[] = [];
  const model = modelOf(nodes, members, supports);
  model.loadCases.push({ id: "gravity", name: "Gravity" }, { id: "wind", name: "Wind" });
  const beam = (start: string, end: string) => {
    const memberId = `m${members.length}`;
    members.push(frameMember(memberId, start, end));
    model.memberUniformLoads.push({
      id: `ul${model.memberUniformLoads.length}`,
      loadCaseId: "gravity",
      memberId,
      axes: "global",
      direction: "z",
      value: -12,
    });
  };
  for (let level = 0; level <= storeys; level++) {
    for (let i = 0; i <= baysX; i++) {
      for (let j = 0; j <= baysY; j++) {
        nodes.push({ id: id(i, j, level), x: 6 * i, y: 5 * j, z: 3.5 * level });
        if (level === 0) {
          supports.push({ nodeId: id(i, j, 0), ...FIXED });
          continue;
        }
        members.push(frameMember(`m${members.length}`, id(i, j, level - 1), id(i, j, level)));
        if (i > 0) {
          beam(id(i - 1, j, level), id(i, j, level));
        }
        if (j > 0) {
          beam(id(i, j - 1, level), id(i, j, level));
        }
        if (i === 0) {
          model.nodalLoads.push({
            id: `nl${model.nodalLoads.length}`,
            loadCaseId: "wind",
            nodeId: id(i, j, level),
            fx: 8,
            fy: 0,
            fz: 0,
            mx: 0,
            my: 0,
            mz: 0,
          });
        }
      }
    }
  }
  return model;
}

/**
 * A cantilever 10 m long from the origin along `direction`, cut into `elements` equal members,
 * fixed at the origin, with one load case `tip`: 10 kN along global -Z on the last node.
 */
export function cantilever(elements: number, direction: readonly [number, number, number]): Model {
  const norm = Math.hypot(...direction);
  const nodes: Node[] = [];
  const members: Member[] = [];
  for (let i = 0; i <= elements; i++) {
    const s = (10 * i) / elements / norm;
    nodes.push({ id: `n${i}`, x: direction[0] * s, y: direction[1] * s, z: direction[2] * s });
    if (i > 0) {
      members.push(frameMember(`m${i - 1}`, `n${i - 1}`, `n${i}`));
    }
  }
  const model = modelOf(nodes, members, [{ nodeId: "n0", ...FIXED }]);
  model.loadCases.push({ id: "tip", name: "Tip load" });
  model.nodalLoads.push({
    id: "nl0",
    loadCaseId: "tip",
    nodeId: `n${elements}`,
    fx: 0,
    fy: 0,
    fz: -10,
    mx: 0,
    my: 0,
    mz: 0,
  });
  return model;
}

/** The four models of the speed test, in the order of the table. */
export function benchCases(): { name: string; model: Model }[] {
  return [
    { name: "frame, 3 x 3 bays, 5 storeys", model: buildingFrame(3, 3, 5) },
    { name: "frame, 3 x 3 bays, 10 storeys", model: buildingFrame(3, 3, 10) },
    { name: "cantilever, 200 elements, along X", model: cantilever(200, [1, 0, 0]) },
    { name: "cantilever, 200 elements, along (2, 3, 6)", model: cantilever(200, [2, 3, 6]) },
  ];
}

export interface BenchRow {
  name: string;
  members: number;
  nodes: number;
  /** Degrees of freedom that no support restrains: the size of the matrix that is factorized. */
  freeDofs: number;
  loadCases: number;
  /** Milliseconds of one `solve` call over the timed calls. */
  medianMs: number;
  minMs: number;
  maxMs: number;
  smallestPivotRatio: number;
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? Number.NaN;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? Number.NaN) + upper) / 2;
}

/**
 * Times `solve(model)`: `warmUp` calls that are not timed, then `runs` timed calls, with the clock
 * `performance.now()`. Throws when the model does not solve.
 */
export function measure(name: string, model: Model, runs: number, warmUp: number): BenchRow {
  let smallestPivotRatio = Number.NaN;
  const times: number[] = [];
  for (let call = 0; call < warmUp + runs; call++) {
    const start = performance.now();
    const result = solve(model);
    const elapsed = performance.now() - start;
    if (!result.ok) {
      throw new Error(`bench: "${name}" did not solve (${result.reason})`);
    }
    smallestPivotRatio = result.smallestPivotRatio;
    if (call >= warmUp) {
      times.push(elapsed);
    }
  }
  times.sort((a, b) => a - b);
  const restrained = model.supports.reduce(
    (count, s) => count + [s.ux, s.uy, s.uz, s.rx, s.ry, s.rz].filter(Boolean).length,
    0,
  );
  return {
    name,
    members: model.members.length,
    nodes: model.nodes.length,
    freeDofs: 6 * model.nodes.length - restrained,
    loadCases: model.loadCases.length,
    medianMs: median(times),
    minMs: times[0] ?? Number.NaN,
    maxMs: times[times.length - 1] ?? Number.NaN,
    smallestPivotRatio,
  };
}

/** Measures the four models of `benchCases`. */
export function runBench(runs = 15, warmUp = 3): BenchRow[] {
  return benchCases().map(({ name, model }) => measure(name, model, runs, warmUp));
}

/** The rows as a Markdown table, times in ms with one decimal. */
export function formatBench(rows: BenchRow[]): string {
  const header = [
    "model",
    "members",
    "nodes",
    "free dofs",
    "load cases",
    "median ms",
    "min ms",
    "max ms",
    "smallest pivot ratio",
  ];
  const lines = rows.map((row) => [
    row.name,
    String(row.members),
    String(row.nodes),
    String(row.freeDofs),
    String(row.loadCases),
    row.medianMs.toFixed(1),
    row.minMs.toFixed(1),
    row.maxMs.toFixed(1),
    row.smallestPivotRatio.toExponential(2),
  ]);
  const widths = header.map((title, column) =>
    Math.max(title.length, ...lines.map((line) => (line[column] ?? "").length)),
  );
  const format = (cells: string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(" | ")} |`;
  return [
    format(header),
    format(widths.map((width) => "-".repeat(width))),
    ...lines.map(format),
  ].join("\n");
}
