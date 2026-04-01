import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export function createStarfieldTexture(scene: Phaser.Scene, key: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  let seed = 42;
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ── Deep space gradient ──
  const bg = ctx.createRadialGradient(
    GAME_WIDTH * 0.4, GAME_HEIGHT * 0.45, 0,
    GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH * 0.7
  );
  bg.addColorStop(0, '#0c1828');
  bg.addColorStop(0.5, '#070e1a');
  bg.addColorStop(1, '#020508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // ── Nebula clouds ──
  drawNebula(ctx, rng, GAME_WIDTH * 0.2, GAME_HEIGHT * 0.25, GAME_WIDTH * 0.35,
    'rgba(60,20,80,0.08)', 'rgba(40,10,60,0.04)');
  drawNebula(ctx, rng, GAME_WIDTH * 0.75, GAME_HEIGHT * 0.6, GAME_WIDTH * 0.3,
    'rgba(15,30,70,0.1)', 'rgba(10,20,50,0.05)');
  drawNebula(ctx, rng, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.85, GAME_WIDTH * 0.4,
    'rgba(10,50,50,0.06)', 'rgba(5,30,40,0.03)');

  // ── MASSIVE close sun (bottom-left, partially off-screen) ──
  const sunX = GAME_WIDTH * 0.08;
  const sunY = GAME_HEIGHT * 1.1;
  const sunR = 400;

  // Enormous outer glow — hot orange wash across the screen
  const outerGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 2.5);
  outerGlow.addColorStop(0, 'rgba(255,120,20,0.12)');
  outerGlow.addColorStop(0.3, 'rgba(255,80,10,0.06)');
  outerGlow.addColorStop(0.6, 'rgba(255,50,0,0.025)');
  outerGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = outerGlow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Corona layer 3 (huge fiery wash)
  const corona3 = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 1.5);
  corona3.addColorStop(0, 'rgba(255,140,30,0.18)');
  corona3.addColorStop(0.4, 'rgba(255,100,10,0.08)');
  corona3.addColorStop(1, 'transparent');
  ctx.fillStyle = corona3;
  ctx.fillRect(sunX - sunR * 1.5, sunY - sunR * 1.5, sunR * 3, sunR * 3);

  // Corona layer 2 — deep orange
  const corona2 = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 1.1);
  corona2.addColorStop(0, 'rgba(255,160,40,0.25)');
  corona2.addColorStop(0.5, 'rgba(255,120,20,0.12)');
  corona2.addColorStop(1, 'transparent');
  ctx.fillStyle = corona2;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Corona layer 1 (inner, intense)
  const corona1 = ctx.createRadialGradient(sunX, sunY, sunR * 0.6, sunX, sunY, sunR);
  corona1.addColorStop(0, 'rgba(255,200,80,0.4)');
  corona1.addColorStop(0.3, 'rgba(255,160,40,0.25)');
  corona1.addColorStop(0.7, 'rgba(255,120,20,0.1)');
  corona1.addColorStop(1, 'transparent');
  ctx.fillStyle = corona1;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Sun surface — blazing orange-white
  const surfGrad = ctx.createRadialGradient(sunX, sunY, sunR * 0.7, sunX, sunY, sunR * 0.82);
  surfGrad.addColorStop(0, 'rgba(255,220,120,0.8)');
  surfGrad.addColorStop(0.3, 'rgba(255,180,60,0.6)');
  surfGrad.addColorStop(0.6, 'rgba(255,140,30,0.3)');
  surfGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = surfGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 0.82, 0, Math.PI * 2);
  ctx.fill();

  // Bright limb (the sharp visible edge — hot orange)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ff9922';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 0.78, -Math.PI * 0.6, -Math.PI * 0.1);
  ctx.stroke();
  ctx.restore();

  // White-hot core glow at the visible arc
  const coreX = sunX + sunR * 0.55;
  const coreY = sunY - sunR * 0.55;
  const coreGlow = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 80);
  coreGlow.addColorStop(0, 'rgba(255,240,180,0.2)');
  coreGlow.addColorStop(0.3, 'rgba(255,180,60,0.1)');
  coreGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = coreGlow;
  ctx.beginPath();
  ctx.arc(coreX, coreY, 80, 0, Math.PI * 2);
  ctx.fill();

  // Solar prominences / flare wisps
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ff7711';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI * 0.5 + (rng() - 0.5) * Math.PI * 0.8;
    const startR = sunR * 0.78;
    const len = 30 + rng() * 80;
    const sx = sunX + Math.cos(angle) * startR;
    const sy = sunY + Math.sin(angle) * startR;
    const ex = sunX + Math.cos(angle) * (startR + len);
    const ey = sunY + Math.sin(angle) * (startR + len);
    const cpx = (sx + ex) / 2 + (rng() - 0.5) * 40;
    const cpy = (sy + ey) / 2 + (rng() - 0.5) * 40;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
    ctx.stroke();
  }
  ctx.restore();

  // ── Distant galaxy smudge ──
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.translate(GAME_WIDTH * 0.6, GAME_HEIGHT * 0.3);
  ctx.rotate(0.5);
  const galGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
  galGrad.addColorStop(0, 'rgba(200,180,255,1)');
  galGrad.addColorStop(0.5, 'rgba(150,130,200,0.5)');
  galGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = galGrad;
  ctx.scale(2.5, 1);
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Stars ──
  for (let i = 0; i < 700; i++) {
    const x = rng() * GAME_WIDTH;
    const y = rng() * GAME_HEIGHT;
    const size = i < 550 ? 0.3 + rng() * 0.5 : 0.8 + rng() * 1.4;
    const brightness = i < 550 ? 0.1 + rng() * 0.25 : 0.35 + rng() * 0.6;

    const colorRoll = rng();
    let r = 220, g = 230, b = 255;
    if (colorRoll < 0.1) { r = 255; g = 200; b = 150; }
    else if (colorRoll < 0.15) { r = 180; g = 200; b = 255; }
    else if (colorRoll < 0.2) { r = 255; g = 240; b = 200; }

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${brightness})`;
    ctx.fill();

    if (size > 1.2) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
      glow.addColorStop(0, `rgba(${r},${g},${b},${brightness * 0.15})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
    }
  }

  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function drawNebula(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cx: number, cy: number, radius: number,
  colorInner: string, colorOuter: string,
): void {
  for (let i = 0; i < 5; i++) {
    const ox = cx + (rng() - 0.5) * radius * 0.6;
    const oy = cy + (rng() - 0.5) * radius * 0.6;
    const r = radius * (0.4 + rng() * 0.6);
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    grad.addColorStop(0, colorInner);
    grad.addColorStop(0.6, colorOuter);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
  }
}
