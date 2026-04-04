// ── Explosion3D — DOM-based explosions overlaid on canvas ─
// Uses CSS-animated divs projected to screen space.
// Guaranteed visible — it's a DOM element on top of the 3D canvas.

import * as THREE from 'three';

const MAX_EXPLOSIONS = 15;

interface ExplosionSlot {
  active: boolean;
  elapsed: number;
  duration: number;
  worldPos: THREE.Vector3;
  el: HTMLDivElement;
}

// Inject explosion CSS once
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .explosion-fx {
      position: fixed;
      pointer-events: none;
      z-index: 18;
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    @keyframes explode {
      0% { transform: translate(-50%,-50%) scale(0.3); opacity: 1; background: radial-gradient(circle, #fff 0%, #ffcc00 30%, #ff6600 60%, #ff2200 80%, transparent 100%); }
      20% { transform: translate(-50%,-50%) scale(1); opacity: 1; background: radial-gradient(circle, #ffee88 0%, #ff8800 40%, #ff3300 70%, transparent 100%); }
      50% { transform: translate(-50%,-50%) scale(1.3); opacity: 0.8; background: radial-gradient(circle, #ff8844 0%, #ff4400 50%, #aa2200 80%, transparent 100%); }
      100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; background: radial-gradient(circle, #ff4422 0%, #882200 60%, transparent 100%); }
    }
  `;
  document.head.appendChild(style);
}

export class ExplosionPool {
  private slots: ExplosionSlot[] = [];
  private camera: THREE.PerspectiveCamera | null = null;

  constructor(_scene: THREE.Scene) {
    injectCSS();

    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const el = document.createElement('div');
      el.className = 'explosion-fx';
      el.style.display = 'none';
      document.body.appendChild(el);

      this.slots.push({
        active: false,
        elapsed: 0,
        duration: 2,
        worldPos: new THREE.Vector3(),
        el,
      });
    }
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  spawn(position: THREE.Vector3, size = 80): void {
    const slot = this.slots.find(s => !s.active);
    if (!slot) return;

    slot.active = true;
    slot.elapsed = 0;
    slot.duration = 2.0 + Math.random() * 1.0; // 2-3 seconds
    slot.worldPos.copy(position);

    slot.el.style.width = size + 'px';
    slot.el.style.height = size + 'px';
    slot.el.style.display = 'block';
    slot.el.style.animation = `explode ${slot.duration}s ease-out forwards`;
  }

  update(dt: number): void {
    if (!this.camera) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const slot of this.slots) {
      if (!slot.active) continue;

      slot.elapsed += dt;
      if (slot.elapsed >= slot.duration) {
        slot.active = false;
        slot.el.style.display = 'none';
        slot.el.style.animation = '';
        continue;
      }

      // Project world position to screen
      const projected = slot.worldPos.clone().project(this.camera);
      const behind = projected.z > 1;

      if (behind) {
        slot.el.style.display = 'none';
        continue;
      }

      const sx = (projected.x * 0.5 + 0.5) * w;
      const sy = (-projected.y * 0.5 + 0.5) * h;

      slot.el.style.display = 'block';
      slot.el.style.left = sx + 'px';
      slot.el.style.top = sy + 'px';
    }
  }
}
