/**
 * What the Properties section shows for one or several selected members (card PX-02.6): for each field the
 * value they share, or that they differ ("mixed"). Pure; tested in ./memberSummary.test.ts.
 */
import {
  distance,
  type Member,
  type MemberEndRelease,
  type MemberKind,
  type Model,
} from "@bridle/model";
import { formatCoordinate } from "../tools/workPlane";

/** What a list of values has in common: nothing to compare, one value shared by all, or different values. */
export type Common<T> = { state: "none" } | { state: "same"; value: T } | { state: "mixed" };

/**
 * The value every entry of `values` has, compared with `equal` (`Object.is` by default): `none` for an empty
 * list, `same` with the first value when every other one equals it, else `mixed`.
 */
export function commonValue<T>(
  values: readonly T[],
  equal: (a: T, b: T) => boolean = Object.is,
): Common<T> {
  const [first, ...rest] = values;
  if (values.length === 0) {
    return { state: "none" };
  }
  return rest.every((value) => equal(first as T, value))
    ? { state: "same", value: first as T }
    : { state: "mixed" };
}

/** The rotations a member end releases, in the order rx, ry, rz. */
export type ReleasedRotation = "rx" | "ry" | "rz";

export function releasedRotations(end: MemberEndRelease): ReleasedRotation[] {
  return (["rx", "ry", "rz"] as const).filter((rotation) => end[rotation]);
}

/** The released rotations at the two ends of a member. */
export interface ReleasesSummary {
  start: ReleasedRotation[];
  end: ReleasedRotation[];
}

function sameReleases(a: ReleasesSummary, b: ReleasesSummary): boolean {
  return a.start.join() === b.start.join() && a.end.join() === b.end.join();
}

/** The fields of the selected members: for each, what the members have in common. */
export interface MemberSummary {
  /** The ids of the members, in the order given. */
  ids: string[];
  sectionId: Common<string>;
  materialId: Common<string>;
  /** Degrees. */
  rollAngleDeg: Common<number>;
  kind: Common<MemberKind>;
  releases: Common<ReleasesSummary>;
  /**
   * The length in m as the panel prints it (`formatCoordinate`); members whose lengths print alike share it.
   * `null` is the length of a member with a node the model does not hold.
   */
  length: Common<string | null>;
}

function lengthText(model: Model, member: Member): string | null {
  const start = model.nodes.find((node) => node.id === member.startNodeId);
  const end = model.nodes.find((node) => node.id === member.endNodeId);
  return start && end ? formatCoordinate(distance(start, end)) : null;
}

/** The summary of some members of `model` (`state: "none"` in every field for an empty list). */
export function summarizeMembers(model: Model, members: readonly Member[]): MemberSummary {
  return {
    ids: members.map((member) => member.id),
    sectionId: commonValue(members.map((member) => member.sectionId)),
    materialId: commonValue(members.map((member) => member.materialId)),
    rollAngleDeg: commonValue(members.map((member) => member.rollAngleDeg)),
    kind: commonValue(members.map((member) => member.kind)),
    releases: commonValue(
      members.map((member) => ({
        start: releasedRotations(member.releases.start),
        end: releasedRotations(member.releases.end),
      })),
      sameReleases,
    ),
    length: commonValue(members.map((member) => lengthText(model, member))),
  };
}
