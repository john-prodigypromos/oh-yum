// ── Ship Sprite Sheet Generator ──────────────────────────
// Renders a ship draw function at 36 rotation angles (10-degree increments)
// using a grid layout to stay within canvas size limits.

import Phaser from 'phaser';

/** Total rotation frames (360 / 10 = 36) */
export const ROTATION_FRAMES = 36;
/** Degrees per frame */
export const DEGREES_PER_FRAME = 360 / ROTATION_FRAMES;

/** Grid layout: 6 columns × 6 rows = 36 frames. Max canvas = 6*280 = 1680px */
const GRID_COLS = 6;

export type ShipDrawFunction = (ctx: CanvasRenderingContext2D, seed?: number) => void;

/**
 * Renders all rotation frames in a grid layout and registers as a Phaser texture.
 * Uses grid layout to keep canvas within browser limits (16384px max dimension).
 */
export function generateShipSpriteSheet(
  scene: Phaser.Scene,
  key: string,
  drawFn: ShipDrawFunction,
  frameSize: number,
  seed = 42,
): void {
  const cols = GRID_COLS;
  const rows = Math.ceil(ROTATION_FRAMES / cols);
  const sheetWidth = frameSize * cols;
  const sheetHeight = frameSize * rows;

  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext('2d')!;

  for (let i = 0; i < ROTATION_FRAMES; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const angle = (i * DEGREES_PER_FRAME * Math.PI) / 180;

    ctx.save();
    ctx.translate(col * frameSize + frameSize / 2, row * frameSize + frameSize / 2);
    ctx.rotate(angle);
    drawFn(ctx, seed);
    ctx.restore();
  }

  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }

  const texture = scene.textures.addCanvas(key, canvas)!;

  for (let i = 0; i < ROTATION_FRAMES; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    texture.add(i, 0, col * frameSize, row * frameSize, frameSize, frameSize);
  }
}

/**
 * Convert a rotation angle (radians) to the nearest sprite frame index.
 * Frame 0 = pointing UP, increases clockwise.
 */
export function rotationToFrame(rotation: number): number {
  let angleDeg = ((rotation + Math.PI / 2) * 180) / Math.PI;
  angleDeg = ((angleDeg % 360) + 360) % 360;
  const frame = Math.round(angleDeg / DEGREES_PER_FRAME) % ROTATION_FRAMES;
  return frame;
}
