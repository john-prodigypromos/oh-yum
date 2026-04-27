// ── Explosion3D — WebGL sprite explosions ────────────────
// Pooled billboard sprites drawn by Three.js. Replaces the old
// DOM/CSS implementation (radial-gradient + box-shadow + filter
// divs caused paint storms during combat). Sprites are additively
// blended with a shared procedural radial texture, so many
// overlapping explosions read as one glowing fireball.

import * as THREE from 'three';

// ── Shared fireball texture ─────────────────────────────
// One 128x128 radial-gradient canvas, reused by every sprite in the pool.
let sharedTexture: THREE.CanvasTexture | null = null;
function getBlastTexture(): THREE.CanvasTexture {
  if (sharedTexture) return sharedTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, 'rgba(255,255,240,1)');
  g.addColorStop(0.12, 'rgba(255,230,140,0.95)');
  g.addColorStop(0.30, 'rgba(255,160,60,0.8)');
  g.addColorStop(0.55, 'rgba(220,70,20,0.55)');
  g.addColorStop(0.80, 'rgba(80,20,10,0.2)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  sharedTexture = new THREE.CanvasTexture(canvas);
  sharedTexture.colorSpace = THREE.SRGBColorSpace;
  return sharedTexture;
}

interface ExplosionSprite {
  mesh: THREE.Sprite;
  life: number;
  maxLife: number;
  peakScale: number;
  rotSpeed: number;
  active: boolean;
}

const POOL_SIZE = 80;

export class ExplosionPool {
  private sprites: ExplosionSprite[] = [];
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | null;
  private tmpVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera | null = null) {
    this.scene = scene;
    this.camera = camera;
    const tex = getBlastTexture();
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      });
      const mesh = new THREE.Sprite(mat);
      mesh.visible = false;
      scene.add(mesh);
      this.sprites.push({ mesh, life: 0, maxLife: 1, peakScale: 1, rotSpeed: 0, active: false });
    }
  }

  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  private acquire(): ExplosionSprite | null {
    for (const s of this.sprites) if (!s.active) return s;
    return null;
  }

  private spawnSprite(worldPos: THREE.Vector3, peakScale: number, lifetime: number, color: number): void {
    const s = this.acquire();
    if (!s) return;
    s.mesh.position.copy(worldPos);
    s.mesh.scale.setScalar(0.01);
    s.mesh.material.color.setHex(color);
    s.mesh.material.opacity = 1;
    s.mesh.material.rotation = Math.random() * Math.PI * 2;
    s.mesh.visible = true;
    s.life = lifetime;
    s.maxLife = lifetime;
    s.peakScale = peakScale;
    s.rotSpeed = (Math.random() - 0.5) * 2;
    s.active = true;
  }

  /** Small impact flash at a world-space hit point. */
  spawnHit(worldPos: THREE.Vector3): void {
    this.spawnSprite(worldPos, 6, 0.3, 0xffe080);
  }

  /** Big multi-sprite ship death at a world-space position.
   *  Staggered secondary fireballs + ember sparks for a ~2s sequence. */
  spawnDeath(worldPos: THREE.Vector3): void {
    this.spawnDeathWorld(worldPos);
  }

  /** Legacy signature kept for compatibility — camera param is ignored
   *  (sprites billboard automatically in WebGL, no manual re-project needed). */
  spawnDeathWorld(worldPos: THREE.Vector3, _camera?: THREE.PerspectiveCamera): void {
    const tmp = this.tmpVec;

    // Core blasts — bright overlapping (3x scale: enemy craft explosions 200% larger)
    this.spawnSprite(worldPos, 105, 1.8, 0xffffff);
    tmp.copy(worldPos).addScalar(0); tmp.x += (Math.random() - 0.5) * 9; tmp.y += (Math.random() - 0.5) * 9;
    this.spawnSprite(tmp, 84, 1.5, 0xffcc66);
    tmp.copy(worldPos); tmp.x += (Math.random() - 0.5) * 12; tmp.y += (Math.random() - 0.5) * 12; tmp.z += (Math.random() - 0.5) * 12;
    this.spawnSprite(tmp, 66, 1.4, 0xff8833);

    // Secondary fireballs — staggered
    for (let i = 0; i < 5; i++) {
      const delay = 40 + i * 50 + Math.random() * 40;
      const offsetX = (Math.random() - 0.5) * 24;
      const offsetY = (Math.random() - 0.5) * 24;
      const offsetZ = (Math.random() - 0.5) * 18;
      const scale = 36 + Math.random() * 30;
      const life = 0.9 + Math.random() * 0.6;
      setTimeout(() => {
        this.tmpVec.copy(worldPos);
        this.tmpVec.x += offsetX;
        this.tmpVec.y += offsetY;
        this.tmpVec.z += offsetZ;
        this.spawnSprite(this.tmpVec, scale, life, 0xff5511);
      }, delay);
    }

    // Ember sparks — tiny, quick
    for (let i = 0; i < 8; i++) {
      const delay = Math.random() * 400;
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.random() * 18;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      const dy = (Math.random() - 0.5) * 12;
      const scale = 6 + Math.random() * 9;
      const life = 0.3 + Math.random() * 0.4;
      setTimeout(() => {
        this.tmpVec.copy(worldPos);
        this.tmpVec.x += dx;
        this.tmpVec.y += dy;
        this.tmpVec.z += dz;
        this.spawnSprite(this.tmpVec, scale, life, 0xffcc66);
      }, delay);
    }
  }

  /** Screen-center explosion — used for player-death big fireball.
   *  Places a large sprite ~30 units in front of the camera. */
  spawnAt(screenX: number, screenY: number, size: number, _anim: string, duration: number, _extraStyle = ''): void {
    if (!this.camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ndcX = (screenX / w) * 2 - 1;
    const ndcY = -((screenY / h) * 2 - 1);
    const v = this.tmpVec.set(ndcX, ndcY, 0.5).unproject(this.camera);
    v.sub(this.camera.position).normalize().multiplyScalar(30).add(this.camera.position);
    this.spawnSprite(v, size * 0.1, duration, 0xffffff);
  }

  /** Advance sprite lifetimes — must be called every frame. */
  update(dt: number): void {
    for (const s of this.sprites) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      // t = 0 at spawn, 1 at end
      const t = 1 - s.life / s.maxLife;
      // Scale: ramps from 0 → peak over first 25% of life, then eases slightly larger
      const scale = t < 0.25
        ? (t / 0.25) * s.peakScale
        : s.peakScale * (1 + (t - 0.25) * 0.3);
      s.mesh.scale.setScalar(scale);
      // Opacity: full for first 15%, then fade out
      s.mesh.material.opacity = t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.85);
      s.mesh.material.rotation += s.rotSpeed * dt;
    }
  }

  destroy(): void {
    for (const s of this.sprites) {
      this.scene.remove(s.mesh);
      s.mesh.material.dispose();
    }
    this.sprites = [];
  }
}
