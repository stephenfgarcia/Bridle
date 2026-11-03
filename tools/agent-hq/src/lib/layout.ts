/** Desk placement on the fixed 1600x900 stage: rows front to back, a centre aisle for the globe. */

export const STAGE_W = 1600;
export const STAGE_H = 900;
/** The desk art is drawn in a 300x300 box whose bottom centre touches the floor. */
export const DESK_UNIT = 300;

export interface DeskSlot {
  /** Floor contact point, stage coordinates. */
  x: number;
  y: number;
  scale: number;
  row: number;
  z: number;
}

const AISLE_HALF = 115;
const MARGIN = 50;

export function layoutDesks(count: number): DeskSlot[] {
  if (count <= 0) return [];
  const perRow = count <= 12 ? 4 : 6;
  const perSide = perRow / 2;
  const rows = Math.ceil(count / perRow);
  const rowFactor = rows === 1 ? 1.08 : rows === 2 ? 1 : rows === 3 ? 0.92 : 0.84;
  const baseScale = (perRow === 4 ? 1 : 0.74) * rowFactor;
  const sideWidth = STAGE_W / 2 - AISLE_HALF - MARGIN;
  const spacing = sideWidth / perSide;
  const leftCentre = MARGIN + sideWidth / 2;
  const rightCentre = STAGE_W - MARGIN - sideWidth / 2;

  const scales: number[] = [];
  const baselines: number[] = [];
  let y = 885;
  for (let r = 0; r < rows; r += 1) {
    const s = baseScale * 0.84 ** r;
    if (r > 0) y -= 238 * s;
    scales.push(s);
    baselines.push(y);
  }

  const slots: DeskSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / perRow);
    const posInRow = i % perRow;
    const inThisRow = Math.min(perRow, count - row * perRow);
    const leftCount = Math.ceil(inThisRow / 2);
    const onLeft = posInRow < leftCount;
    const sideCount = onLeft ? leftCount : inThisRow - leftCount;
    const j = onLeft ? posInRow : posInRow - leftCount;
    const centre = onLeft ? leftCentre : rightCentre;
    const flatX = centre - ((sideCount - 1) / 2) * spacing + j * spacing;
    const scale = scales[row] ?? baseScale;
    const converge = 0.55 + 0.45 * (scale / baseScale);
    const x = STAGE_W / 2 + (flatX - STAGE_W / 2) * converge;
    slots.push({ x, y: baselines[row] ?? 885, scale, row, z: 10 + (rows - row) * 2 });
  }
  return slots;
}

/** Where the holographic globe's console touches the floor. */
export function globeAnchor(slots: readonly DeskSlot[]): { x: number; y: number } {
  const front = slots[0];
  if (!front) return { x: STAGE_W / 2, y: 700 };
  return { x: STAGE_W / 2, y: front.y - 120 * front.scale };
}

/** Stage point just above an agent's head, for the waiting lines. */
export function headAnchor(slot: DeskSlot): { x: number; y: number } {
  return { x: slot.x, y: slot.y - 230 * slot.scale };
}
