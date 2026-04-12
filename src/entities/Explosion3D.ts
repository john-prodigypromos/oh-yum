// ── Explosion3D — Screen-space DOM explosions ────────────
// Organic, chaotic explosions using irregular CSS shapes.
// World-anchored re-projection keeps blasts locked in 3D space.

import * as THREE from 'three';

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .explosion-fx {
      position: fixed;
      pointer-events: none !important;
      z-index: 9999;
      transform: translate(-50%, -50%);
    }

    /* ── Core blast — irregular blob, white-hot → orange → smoke ── */
    @keyframes boom1 {
      0% { transform: translate(-50%,-50%) scale(0.05) rotate(0deg); opacity: 1;
           border-radius: 42% 58% 45% 55% / 52% 44% 56% 48%;
           background: radial-gradient(ellipse 70% 80% at 45% 40%, #fff 0%, #fffbe6 10%, #ffcc44 25%, #ff7700 45%, #cc2200 65%, transparent 85%);
           box-shadow: 0 0 60px 30px rgba(255,220,120,0.8), 0 0 120px 60px rgba(255,100,0,0.3); }
      6% { transform: translate(-50%,-50%) scale(0.7) rotate(12deg); opacity: 1;
           border-radius: 48% 52% 55% 45% / 44% 56% 42% 58%;
           background: radial-gradient(ellipse 65% 75% at 50% 45%, #ffee88 0%, #ff9922 20%, #dd4400 40%, #881100 60%, rgba(40,15,5,0.5) 80%, transparent 100%);
           box-shadow: 0 0 50px 25px rgba(255,150,50,0.6), 0 0 100px 50px rgba(200,60,0,0.2); }
      20% { transform: translate(-50%,-50%) scale(1.1) rotate(25deg); opacity: 0.85;
           border-radius: 55% 45% 50% 50% / 48% 52% 46% 54%;
           background: radial-gradient(ellipse 60% 70% at 52% 48%, #ff6622 0%, #cc2200 25%, #661100 45%, rgba(30,15,8,0.5) 70%, transparent 100%);
           box-shadow: 0 0 30px 15px rgba(200,60,0,0.3); }
      45% { transform: translate(-50%,-50%) scale(1.4) rotate(35deg); opacity: 0.5;
           border-radius: 50% 50% 45% 55% / 55% 45% 50% 50%;
           background: radial-gradient(ellipse at 50% 50%, #883311 0%, #442200 30%, rgba(25,12,6,0.4) 60%, transparent 90%);
           box-shadow: none; }
      100% { transform: translate(-50%,-50%) scale(1.8) rotate(45deg); opacity: 0;
           border-radius: 45% 55% 52% 48%;
           background: radial-gradient(circle, rgba(30,15,8,0.15) 0%, transparent 50%); }
    }

    /* ── Secondary fireball — delayed, billowing, drifts sideways ── */
    @keyframes boom2 {
      0% { transform: translate(-50%,-50%) scale(0.08) rotate(0deg); opacity: 0; }
      5% { transform: translate(-50%,-50%) scale(0.25) rotate(-8deg); opacity: 0.95;
           border-radius: 55% 45% 48% 52% / 50% 50% 44% 56%;
           background: radial-gradient(ellipse 75% 65% at 40% 50%, #ffcc44 0%, #ff7711 30%, #cc3300 55%, transparent 80%);
           box-shadow: 0 0 35px 18px rgba(255,150,0,0.5); }
      22% { transform: translate(calc(-50% + 8px),-50%) scale(0.75) rotate(-18deg); opacity: 0.8;
           border-radius: 48% 52% 56% 44% / 45% 55% 50% 50%;
           background: radial-gradient(ellipse 70% 60% at 45% 48%, #ff8833 0%, #bb3300 35%, #551500 60%, rgba(25,10,5,0.3) 85%, transparent 100%); }
      50% { transform: translate(calc(-50% + 14px),-50%) scale(1.0) rotate(-28deg); opacity: 0.4;
           border-radius: 52% 48% 44% 56% / 56% 44% 52% 48%;
           background: radial-gradient(ellipse at 48% 50%, #773311 0%, #331100 40%, rgba(20,10,5,0.2) 70%, transparent 100%);
           box-shadow: none; }
      100% { transform: translate(calc(-50% + 20px),-50%) scale(1.2) rotate(-35deg); opacity: 0;
           border-radius: 50% 50% 46% 54%;
           background: radial-gradient(circle, rgba(25,10,5,0.1) 0%, transparent 45%); }
    }

    /* ── Ember sparks — small bright shards that scatter outward ── */
    @keyframes boom3 {
      0% { transform: translate(-50%,-50%) scale(0.1) rotate(0deg); opacity: 0; }
      8% { transform: translate(-50%,-50%) scale(0.4) rotate(15deg); opacity: 1;
           border-radius: 35% 65% 40% 60% / 60% 40% 55% 45%;
           background: radial-gradient(ellipse 80% 50% at 50% 50%, #fff 0%, #ffcc44 25%, #ff6600 55%, transparent 80%);
           box-shadow: 0 0 12px 6px rgba(255,200,80,0.6); }
      35% { transform: translate(-50%,-50%) scale(0.7) rotate(40deg); opacity: 0.6;
           border-radius: 40% 60% 55% 45% / 50% 50% 45% 55%;
           background: radial-gradient(ellipse 75% 45% at 50% 50%, #ffaa44 0%, #cc4400 45%, transparent 75%);
           box-shadow: 0 0 6px 3px rgba(255,100,0,0.2); }
      100% { transform: translate(-50%,-50%) scale(0.9) rotate(70deg); opacity: 0;
           border-radius: 45% 55% 50% 50%;
           background: radial-gradient(circle, #882200 0%, transparent 40%); box-shadow: none; }
    }

    /* ── Smoke cloud — large, dark, slow-fading, drifts upward ── */
    @keyframes boom-smoke {
      0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
      10% { transform: translate(-50%,-55%) scale(0.5); opacity: 0.5;
           border-radius: 55% 45% 50% 50% / 48% 52% 46% 54%;
           background: radial-gradient(ellipse 70% 80% at 48% 52%, rgba(30,18,10,0.7) 0%, rgba(20,12,6,0.4) 50%, transparent 85%); }
      40% { transform: translate(-50%,-62%) scale(0.9); opacity: 0.35;
           border-radius: 50% 50% 45% 55% / 52% 48% 54% 46%;
           background: radial-gradient(ellipse at 50% 50%, rgba(25,15,8,0.5) 0%, rgba(15,8,4,0.2) 55%, transparent 90%); }
      100% { transform: translate(-50%,-72%) scale(1.3); opacity: 0;
           border-radius: 48% 52% 55% 45%;
           background: radial-gradient(circle, rgba(20,10,5,0.1) 0%, transparent 50%); }
    }

    /* ── Shockwave ring — fast-expanding bright outline ── */
    @keyframes boom-ring {
      0% { transform: translate(-50%,-50%) scale(0.1); opacity: 0.9;
           border: 3px solid rgba(255,220,150,0.8);
           border-radius: 50%;
           background: transparent;
           box-shadow: 0 0 15px 5px rgba(255,180,80,0.4), inset 0 0 15px 5px rgba(255,180,80,0.2); }
      30% { transform: translate(-50%,-50%) scale(0.7); opacity: 0.5;
           border: 2px solid rgba(255,180,100,0.5);
           box-shadow: 0 0 10px 3px rgba(255,120,40,0.2); }
      100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0;
           border: 1px solid rgba(255,150,80,0.1);
           box-shadow: none; }
    }

    /* ── Debris chunk — small, elongated, tumbles outward ── */
    @keyframes boom-debris {
      0% { transform: translate(-50%,-50%) scale(0.3) rotate(0deg); opacity: 1;
           background: linear-gradient(135deg, #ffcc44 0%, #ff6600 40%, #993300 100%);
           box-shadow: 0 0 6px 2px rgba(255,150,50,0.5); }
      30% { opacity: 0.8;
           background: linear-gradient(135deg, #ff8833 0%, #cc3300 50%, #662200 100%);
           box-shadow: 0 0 3px 1px rgba(255,80,0,0.3); }
      100% { transform: translate(-50%,-50%) scale(0.1) rotate(360deg); opacity: 0;
           background: #331100; box-shadow: none; }
    }

    /* ── Screen flash — brief white overlay ── */
    @keyframes boom-flash {
      0% { opacity: 0.4; }
      100% { opacity: 0; }
    }

    /* Hit spark — quick bright flash */
    @keyframes hit-flash {
      0% { transform: translate(-50%,-50%) scale(0.15) rotate(0deg); opacity: 1;
           border-radius: 40% 60% 45% 55% / 55% 45% 50% 50%;
           background: radial-gradient(ellipse 80% 60% at 50% 50%, #fff 0%, #ffdd66 30%, #ff8800 60%, transparent 80%);
           box-shadow: 0 0 15px 8px rgba(255,220,100,0.5); }
      30% { transform: translate(-50%,-50%) scale(0.55) rotate(12deg); opacity: 0.6;
           border-radius: 45% 55% 50% 50% / 50% 50% 45% 55%;
           background: radial-gradient(ellipse 70% 55% at 50% 50%, #ffaa44 0%, #ff6600 45%, transparent 75%); }
      100% { transform: translate(-50%,-50%) scale(0.8) rotate(20deg); opacity: 0;
           border-radius: 50%;
           background: radial-gradient(circle, #cc4400 0%, transparent 50%); box-shadow: none; }
    }
  `;
  document.head.appendChild(style);
}

/** Randomize border-radius for organic blob shapes */
function blobRadius(): string {
  const r = () => 38 + Math.floor(Math.random() * 24); // 38-62%
  return `${r()}% ${100-r()}% ${r()}% ${100-r()}% / ${r()}% ${100-r()}% ${r()}% ${100-r()}%`;
}

export class ExplosionPool {
  private overlay: HTMLElement;
  private pool: HTMLDivElement[] = [];
  private activeCount = 0;
  private static MAX_ACTIVE = 40; // hard cap on simultaneous DOM elements

  constructor() {
    injectCSS();
    this.overlay = document.getElementById('ui-overlay') || document.body;
    // Pre-allocate pool
    for (let i = 0; i < ExplosionPool.MAX_ACTIVE; i++) {
      const el = document.createElement('div');
      el.className = 'explosion-fx';
      el.style.display = 'none';
      this.overlay.appendChild(el);
      this.pool.push(el);
    }
  }

  private acquire(): HTMLDivElement | null {
    if (this.activeCount >= ExplosionPool.MAX_ACTIVE) return null;
    for (const el of this.pool) {
      if (el.style.display === 'none') {
        this.activeCount++;
        return el;
      }
    }
    return null;
  }

  private release(el: HTMLDivElement, delayMs: number): void {
    setTimeout(() => {
      el.style.display = 'none';
      el.style.animation = 'none';
      this.activeCount--;
    }, delayMs);
  }

  /** Spawn a single explosion element at screen pixel coordinates */
  spawnAt(screenX: number, screenY: number, size: number, anim: string, duration: number, extraStyle = ''): void {
    const el = this.acquire();
    if (!el) return; // at capacity — skip gracefully
    el.style.cssText = `left:${screenX}px;top:${screenY}px;width:${size}px;height:${size}px;display:block;animation:${anim} ${duration}s ease-out forwards;border-radius:${blobRadius()};${extraStyle}`;
    this.release(el, duration * 1000 + 100);
  }

  /** Small impact flash */
  spawnHit(screenX: number, screenY: number): void {
    this.spawnAt(screenX, screenY, 50, 'hit-flash', 0.35);
  }

  /** Chaotic multi-stage death explosion — screen-space fallback */
  spawnDeath(screenX: number, screenY: number): void {
    this.spawnDeathAt(screenX, screenY);
  }

  /** World-anchored death explosion — re-projects each element from 3D
   *  so the explosion stays locked to the death point as the camera moves. */
  spawnDeathWorld(worldPos: THREE.Vector3, camera: THREE.PerspectiveCamera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const _projV = new THREE.Vector3();
    const project = (): { x: number; y: number; visible: boolean } => {
      _projV.copy(worldPos).project(camera);
      return {
        x: (_projV.x * 0.5 + 0.5) * w,
        y: (-_projV.y * 0.5 + 0.5) * h,
        visible: _projV.z < 1,
      };
    };

    const jit = (spread = 50) => (Math.random() - 0.5) * spread;
    const rDur = () => 1.2 + Math.random() * 1.5;
    const fireAnims = ['boom1', 'boom2', 'boom3'];
    const rAnim = () => fireAnims[Math.floor(Math.random() * fireAnims.length)];

    const pos0 = project();
    if (!pos0.visible) return;

    // ── Screen flash — brief bright overlay ──
    const flash = this.acquire();
    if (flash) {
      flash.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,200,120,0.2);z-index:9998;pointer-events:none;display:block;animation:boom-flash 0.3s ease-out forwards;`;
      this.release(flash, 400);
    }

    // ── Shockwave rings ──  (3 pieces)
    this.spawnAt(pos0.x, pos0.y, 260, 'boom-ring', 0.5, 'background:transparent;');
    this.spawnAt(pos0.x, pos0.y, 180, 'boom-ring', 0.7, 'background:transparent;animation-delay:0.08s;');
    this.spawnAt(pos0.x, pos0.y, 320, 'boom-ring', 0.9, 'background:transparent;animation-delay:0.15s;');

    // ── Core blasts ──  (4 pieces)
    this.spawnAt(pos0.x, pos0.y, 240, 'boom1', 2.5);
    this.spawnAt(pos0.x + jit(15), pos0.y + jit(15), 180, 'boom1', 2.2);
    this.spawnAt(pos0.x + jit(20), pos0.y + jit(20), 140, 'boom1', 2.0);
    this.spawnAt(pos0.x + jit(10), pos0.y + jit(10), 200, 'boom2', 2.3);

    // ── Secondary fireballs — staggered waves ──
    for (let i = 0; i < 3; i++) {
      const delay = i * 40 + Math.random() * 100;
      const size = 80 + Math.random() * 120;
      setTimeout(() => {
        const pos = project();
        if (pos.visible) {
          this.spawnAt(pos.x + jit(50), pos.y + jit(50), size, rAnim(), rDur());
        }
      }, delay);
    }

    // ── Smoke clouds — large dark billowing ──
    for (let i = 0; i < 3; i++) {
      const delay = 50 + Math.random() * 800;
      const size = 80 + Math.random() * 140;
      setTimeout(() => {
        const pos = project();
        if (pos.visible) {
          this.spawnAt(pos.x + jit(80), pos.y + jit(60), size, 'boom-smoke', 2.0 + Math.random() * 1.5);
        }
      }, delay);
    }

    // ── Delayed fireballs — sustained burn ──
    for (let i = 0; i < 5; i++) {
      const delay = 20 + Math.random() * 1400;
      const size = 30 + Math.random() * 110;
      setTimeout(() => {
        const pos = project();
        if (pos.visible) {
          this.spawnAt(pos.x + jit(100), pos.y + jit(100), size, rAnim(), rDur());
        }
      }, delay);
    }

    // ── Ember sparks — tiny bright fast ──
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 120;
      const delay = Math.random() * 600;
      setTimeout(() => {
        const pos = project();
        if (pos.visible) {
          this.spawnAt(
            pos.x + Math.cos(angle) * dist,
            pos.y + Math.sin(angle) * dist,
            8 + Math.random() * 20, 'boom3', 0.4 + Math.random() * 0.6,
          );
        }
      }, delay);
    }

    // ── Debris chunks — tumbling outward ──
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 150;
      const delay = Math.random() * 500;
      const w2 = 4 + Math.random() * 8;
      const h2 = 2 + Math.random() * 3;
      const rot = Math.floor(Math.random() * 360);
      setTimeout(() => {
        const pos = project();
        if (pos.visible) {
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          const dur = 0.5 + Math.random() * 0.8;
          this.spawnAt(pos.x + dx, pos.y + dy, w2, 'boom-debris', dur,
            `height:${h2}px;border-radius:2px;transform-origin:center;transform:translate(-50%,-50%) rotate(${rot}deg);`);
        }
      }, delay);
    }
  }

  private spawnDeathAt(screenX: number, screenY: number): void {
    const jit = (spread = 50) => (Math.random() - 0.5) * spread;
    const rDur = () => 1.2 + Math.random() * 1.5;
    const fireAnims = ['boom1', 'boom2', 'boom3'];
    const rAnim = () => fireAnims[Math.floor(Math.random() * fireAnims.length)];

    // Screen flash
    const flash2 = this.acquire();
    if (flash2) {
      flash2.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,200,120,0.2);z-index:9998;pointer-events:none;display:block;animation:boom-flash 0.3s ease-out forwards;`;
      this.release(flash2, 400);
    }

    // Shockwave rings (2)
    this.spawnAt(screenX, screenY, 260, 'boom-ring', 0.5, 'background:transparent;');
    this.spawnAt(screenX, screenY, 180, 'boom-ring', 0.7, 'background:transparent;');

    // Core blasts (3)
    this.spawnAt(screenX, screenY, 240, 'boom1', 2.5);
    this.spawnAt(screenX + jit(15), screenY + jit(15), 180, 'boom1', 2.2);
    this.spawnAt(screenX + jit(10), screenY + jit(10), 200, 'boom2', 2.3);

    // Secondary fireballs (5)
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.spawnAt(screenX + jit(50), screenY + jit(50), 80 + Math.random() * 120, rAnim(), rDur());
      }, i * 40 + Math.random() * 100);
    }

    // Smoke clouds (4)
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.spawnAt(screenX + jit(80), screenY + jit(60), 80 + Math.random() * 140, 'boom-smoke', 2.0 + Math.random() * 1.5);
      }, 50 + Math.random() * 800);
    }

    // Delayed fireballs (6)
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.spawnAt(screenX + jit(100), screenY + jit(100), 30 + Math.random() * 110, rAnim(), rDur());
      }, 20 + Math.random() * 1400);
    }

    // Ember sparks (8)
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 120;
      setTimeout(() => {
        this.spawnAt(screenX + Math.cos(angle) * dist, screenY + Math.sin(angle) * dist,
          8 + Math.random() * 20, 'boom3', 0.4 + Math.random() * 0.6);
      }, Math.random() * 600);
    }

    // Debris chunks (10)
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 150;
      const w2 = 3 + Math.random() * 9;
      const h2 = 1 + Math.random() * 4;
      const rot = Math.floor(Math.random() * 360);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = 0.4 + Math.random() * 0.9;
      setTimeout(() => {
        this.spawnAt(screenX + dx, screenY + dy, w2, 'boom-debris', dur,
          `height:${h2}px;border-radius:2px;transform-origin:center;transform:translate(-50%,-50%) rotate(${rot}deg);`);
      }, Math.random() * 500);
    }
  }

  // No-op update — explosions are self-managing via CSS animation + setTimeout cleanup
  update(_dt: number): void {}
  setCamera(_camera: unknown): void {}
}
