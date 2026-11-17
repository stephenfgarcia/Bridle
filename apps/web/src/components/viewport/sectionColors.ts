/**
 * "Colour by section" (card PX-02.6): which colour of the palette each member is drawn in, and the legend.
 * Pure; tested in ./sectionColors.test.ts. The colours themselves are tokens of ../../styles/tokens.css.
 */
import type { Model } from "@bridle/model";

/**
 * The tokens of the colours, in the order they are given out. Six colours of the data palette, none of them
 * the colour of the load arrows (`--viz-case-E`) or of the selection and the hover (`--canvas-selection`,
 * `--canvas-hover`).
 */
export const SECTION_COLOR_TOKENS = [
  "--viz-case-W",
  "--viz-case-T",
  "--viz-case-L",
  "--viz-case-Lr",
  "--viz-diag-N",
  "--viz-case-S",
] as const;

/** One line of the legend. */
export interface SectionLegendEntry {
  sectionId: string;
  /** The section's name, or its id when the model has no section with that id. */
  name: string;
  /** The index into `SECTION_COLOR_TOKENS`, or `null`: the plain colour of members ("other sections"). */
  color: number | null;
  /** How many members use the section. */
  members: number;
}

export interface SectionColors {
  /**
   * The sections that at least one member uses: those of the model in the model's order, then any section id
   * that only members name. The first `SECTION_COLOR_TOKENS.length` of them have a colour of their own.
   */
  legend: SectionLegendEntry[];
  /** For each member id, the index of its colour, or `null` for the plain colour. */
  byMember: Map<string, number | null>;
}

export function sectionColors(model: Model): SectionColors {
  const counts = new Map<string, number>();
  for (const member of model.members) {
    counts.set(member.sectionId, (counts.get(member.sectionId) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const section of model.sections) {
    if (!names.has(section.id)) {
      names.set(section.id, section.name);
    }
  }
  const used = [
    ...[...names.keys()].filter((id) => counts.has(id)),
    ...[...counts.keys()].filter((id) => !names.has(id)),
  ];
  const legend = used.map((sectionId, index) => ({
    sectionId,
    name: names.get(sectionId) ?? sectionId,
    color: index < SECTION_COLOR_TOKENS.length ? index : null,
    members: counts.get(sectionId) ?? 0,
  }));
  const colorOf = new Map(legend.map((entry) => [entry.sectionId, entry.color]));
  const byMember = new Map<string, number | null>();
  for (const member of model.members) {
    if (!byMember.has(member.id)) {
      byMember.set(member.id, colorOf.get(member.sectionId) ?? null);
    }
  }
  return { legend, byMember };
}
