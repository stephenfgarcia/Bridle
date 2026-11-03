export const C = {
  bg: "#07060f",
  magenta: "#ff2bd6",
  violet: "#8b5cf6",
  emerald: "#19f5a1",
  lavender: "#a78bfa",
  amber: "#ffb020",
  red: "#ff4545",
  white: "#f4f2ff",
  steel: "#9aa3b5",
  steelDark: "#2b3040",
  dark: "#15131f",
  darker: "#0d0b1a",
  wall: "#120f22",
  robot: "#262638",
  robotHead: "#2c2c40",
  limb: "#33334a",
  joint: "#46466a",
} as const;

export const WINDOW_LIGHTS = ["#ffd9a0", "#9fe8ff", "#f4e8ff", "#ffb6e6"] as const;

/** Small deterministic PRNG so the skyline and snacks look the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setCursor(pointer: boolean): void {
  document.body.style.cursor = pointer ? "pointer" : "";
}
