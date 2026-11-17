/**
 * The JSON format of a model: `serializeModel` writes it, `parseModel` reads it. The format is the
 * `Model` type as JSON, nothing renamed. `parseModel` checks the shape only (every key present with
 * the right type, no other key); whether the model makes sense is `validateModel`'s question, so a
 * model in progress (no support yet, say) can be saved and loaded.
 */
import { issue, type ModelIssue } from "./issues";
import {
  type LoadCase,
  type Material,
  type Member,
  type MemberEndRelease,
  type MemberPointLoad,
  type MemberUniformLoad,
  MODEL_UNITS,
  MODEL_VERSION,
  type Model,
  type NodalLoad,
  type Node,
  type Section,
  type Support,
} from "./types";

export type ParseResult = { ok: true; model: Model } | { ok: false; issues: ModelIssue[] };

type Json = Record<string, unknown>;

/** Reads the keys of one JSON object, recording an `invalid-shape` issue for each one that is wrong. */
class Reader {
  private readonly used = new Set<string>();

  constructor(
    private readonly source: Json,
    private readonly path: string,
    private readonly issues: ModelIssue[],
  ) {}

  private at(key: string): string {
    return this.path === "" ? key : `${this.path}.${key}`;
  }

  private bad(key: string): void {
    this.issues.push(issue("invalid-shape", [], this.at(key)));
  }

  raw(key: string): unknown {
    this.used.add(key);
    return Object.hasOwn(this.source, key) ? this.source[key] : undefined;
  }

  /** A string; an id must not be empty. */
  string(key: string, nonEmpty = false): string {
    const value = this.raw(key);
    if (typeof value === "string" && !(nonEmpty && value === "")) {
      return value;
    }
    this.bad(key);
    return "";
  }

  id(key = "id"): string {
    return this.string(key, true);
  }

  /** A finite number (JSON has no NaN or Infinity; an in-memory model could). */
  number(key: string): number {
    const value = this.raw(key);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    this.bad(key);
    return 0;
  }

  boolean(key: string): boolean {
    const value = this.raw(key);
    if (typeof value === "boolean") {
      return value;
    }
    this.bad(key);
    return false;
  }

  oneOf<const T extends string>(key: string, allowed: readonly T[]): T {
    const value = this.raw(key);
    const found = allowed.find((item) => item === value);
    if (found !== undefined) {
      return found;
    }
    this.bad(key);
    return allowed[0] as T;
  }

  object<T>(key: string, read: (reader: Reader) => T): T | undefined {
    const value = this.raw(key);
    if (!isObject(value)) {
      this.bad(key);
      return undefined;
    }
    const reader = new Reader(value, this.at(key), this.issues);
    const result = read(reader);
    reader.done();
    return result;
  }

  list<T>(key: string, read: (reader: Reader) => T): T[] {
    const value = this.raw(key);
    if (!Array.isArray(value)) {
      this.bad(key);
      return [];
    }
    return value.flatMap((item: unknown, index) => {
      const path = `${this.at(key)}[${index}]`;
      if (!isObject(item)) {
        this.issues.push(issue("invalid-shape", [], path));
        return [];
      }
      const reader = new Reader(item, path, this.issues);
      const result = read(reader);
      reader.done();
      return [result];
    });
  }

  /** Reports every key of the object that no read asked for. */
  done(): void {
    for (const key of Object.keys(this.source)) {
      if (!this.used.has(key)) {
        this.bad(key);
      }
    }
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Each reader below builds its object key by key, in the order of the type: that order is the key
// order of the JSON text `serializeModel` writes.

const readNode = (r: Reader): Node => ({
  id: r.id(),
  x: r.number("x"),
  y: r.number("y"),
  z: r.number("z"),
});

const readRelease = (r: Reader): MemberEndRelease => ({
  rx: r.boolean("rx"),
  ry: r.boolean("ry"),
  rz: r.boolean("rz"),
});

const NO_RELEASE: MemberEndRelease = { rx: false, ry: false, rz: false };

const readMember = (r: Reader): Member => ({
  id: r.id(),
  startNodeId: r.id("startNodeId"),
  endNodeId: r.id("endNodeId"),
  sectionId: r.id("sectionId"),
  materialId: r.id("materialId"),
  kind: r.oneOf("kind", ["frame", "truss"]),
  rollAngleDeg: r.number("rollAngleDeg"),
  releases: r.object("releases", (releases) => ({
    start: releases.object("start", readRelease) ?? NO_RELEASE,
    end: releases.object("end", readRelease) ?? NO_RELEASE,
  })) ?? { start: NO_RELEASE, end: NO_RELEASE },
});

const readSection = (r: Reader): Section => ({
  id: r.id(),
  name: r.string("name"),
  A: r.number("A"),
  Iy: r.number("Iy"),
  Iz: r.number("Iz"),
  J: r.number("J"),
  depthY: r.number("depthY"),
  depthZ: r.number("depthZ"),
});

const readMaterial = (r: Reader): Material => ({
  id: r.id(),
  name: r.string("name"),
  E: r.number("E"),
  G: r.number("G"),
  fy: r.number("fy"),
  density: r.number("density"),
});

const readSupport = (r: Reader): Support => ({
  nodeId: r.id("nodeId"),
  ux: r.boolean("ux"),
  uy: r.boolean("uy"),
  uz: r.boolean("uz"),
  rx: r.boolean("rx"),
  ry: r.boolean("ry"),
  rz: r.boolean("rz"),
});

const readLoadCase = (r: Reader): LoadCase => ({ id: r.id(), name: r.string("name") });

const readNodalLoad = (r: Reader): NodalLoad => ({
  id: r.id(),
  loadCaseId: r.id("loadCaseId"),
  nodeId: r.id("nodeId"),
  fx: r.number("fx"),
  fy: r.number("fy"),
  fz: r.number("fz"),
  mx: r.number("mx"),
  my: r.number("my"),
  mz: r.number("mz"),
});

const readMemberUniformLoad = (r: Reader): MemberUniformLoad => ({
  id: r.id(),
  loadCaseId: r.id("loadCaseId"),
  memberId: r.id("memberId"),
  axes: r.oneOf("axes", ["global", "local"]),
  direction: r.oneOf("direction", ["x", "y", "z"]),
  value: r.number("value"),
});

const readMemberPointLoad = (r: Reader): MemberPointLoad => ({
  ...readMemberUniformLoad(r),
  position: r.number("position"),
});

/** Reads a value of unknown shape into a `Model` with the keys in a fixed order, collecting the issues. */
function readModel(value: unknown): { model: Model; issues: ModelIssue[] } {
  const issues: ModelIssue[] = [];
  if (!isObject(value)) {
    return { model: emptyModel(), issues: [issue("invalid-shape", [], "")] };
  }
  const r = new Reader(value, "", issues);

  // The version and the units are checked first: a file of another version is reported as that,
  // not as a list of shape differences.
  const version = r.raw("version");
  const units = r.raw("units");
  if (typeof version !== "number") {
    issues.push(issue("invalid-shape", [], "version"));
  } else if (version !== MODEL_VERSION) {
    return { model: emptyModel(), issues: [issue("unsupported-version", [], "version")] };
  }
  if (!isObject(units)) {
    issues.push(issue("invalid-shape", [], "units"));
  } else if (
    units.force !== MODEL_UNITS.force ||
    units.length !== MODEL_UNITS.length ||
    Object.keys(units).length !== 2
  ) {
    issues.push(issue("unsupported-units", [], "units"));
  }

  const model: Model = {
    version: MODEL_VERSION,
    units: { force: MODEL_UNITS.force, length: MODEL_UNITS.length },
    nodes: r.list("nodes", readNode),
    members: r.list("members", readMember),
    sections: r.list("sections", readSection),
    materials: r.list("materials", readMaterial),
    supports: r.list("supports", readSupport),
    loadCases: r.list("loadCases", readLoadCase),
    nodalLoads: r.list("nodalLoads", readNodalLoad),
    memberUniformLoads: r.list("memberUniformLoads", readMemberUniformLoad),
    memberPointLoads: r.list("memberPointLoads", readMemberPointLoad),
  };
  r.done();
  return { model, issues };
}

/** A model with nothing in it: the current version and units, and every list empty. */
export function emptyModel(): Model {
  return {
    version: MODEL_VERSION,
    units: { force: MODEL_UNITS.force, length: MODEL_UNITS.length },
    nodes: [],
    members: [],
    sections: [],
    materials: [],
    supports: [],
    loadCases: [],
    nodalLoads: [],
    memberUniformLoads: [],
    memberPointLoads: [],
  };
}

/**
 * Reads a model from JSON text. Text that is not JSON gives `invalid-json` instead of an exception;
 * JSON that is not an object gives one `invalid-shape` with an empty `path`; a numeric `version`
 * other than `MODEL_VERSION` gives `unsupported-version` alone; units other than kN and m give
 * `unsupported-units`; a missing key, a value of the wrong type, an empty id, or a key the format
 * does not have gives one `invalid-shape` per place, with its `path`.
 *
 * It checks the shape only: run `validateModel` on the result to check the model itself.
 */
export function parseModel(json: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, issues: [issue("invalid-json", [])] };
  }
  const { model, issues } = readModel(value);
  return issues.length === 0 ? { ok: true, model } : { ok: false, issues };
}

/**
 * Writes a model as JSON text: two-space indentation, a final newline, keys in the order of the
 * types whatever the key order of the objects passed in. `parseModel` of the result gives a model
 * equal to the one passed in (except that JSON turns a negative zero into zero).
 *
 * @throws Error when the value does not have the shape `parseModel` accepts, for example a number
 *   that is NaN or infinite, an empty id, or an extra key; the message lists the paths.
 */
export function serializeModel(model: Model): string {
  const { model: ordered, issues } = readModel(model);
  if (issues.length > 0) {
    const where = issues.map((item) => `${item.code} ${item.path ?? ""}`.trim()).join("; ");
    throw new Error(`serializeModel: not a well-formed model: ${where}`);
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
