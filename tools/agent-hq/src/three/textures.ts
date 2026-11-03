/** Small generated textures (no files to load): a soft shadow blob and a soft glow. */
import { CanvasTexture } from "three";

function radial(inner: string, mid: string, outer: string): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

let blob: CanvasTexture | null = null;
let glow: CanvasTexture | null = null;

/** Black with a soft alpha falloff: contact shadows under furniture and robots. */
export function blobTexture(): CanvasTexture {
  if (!blob) blob = radial("rgba(0,0,0,1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)");
  return blob;
}

/** White with a soft alpha falloff: haze sprites. */
export function glowTexture(): CanvasTexture {
  if (!glow) glow = radial("rgba(255,255,255,1)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)");
  return glow;
}
