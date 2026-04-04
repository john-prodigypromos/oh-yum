// ── Explosion3D — Simple Glowing Sphere Explosions ───────
// Large emissive spheres that scale up and fade out.
// Guaranteed visible — no InstancedMesh complexity.

import * as THREE from 'three';

const MAX_EXPLOSIONS = 12;
const EXPLOSION_DURATION = 3.0; // long dramatic explosion

interface ExplosionSlot {
  active: boolean;
  elapsed: number;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  startSize: number;
}

export class ExplosionPool {
  private scene: THREE.Scene;
  private slots: ExplosionSlot[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const geo = new THREE.SphereGeometry(1, 16, 12);

    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff8833,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      scene.add(mesh);

      const light = new THREE.PointLight(0xff6622, 0, 120, 2);
      light.visible = false;
      scene.add(light);

      this.slots.push({
        active: false,
        elapsed: 0,
        mesh,
        light,
        startSize: 4,
      });
    }
  }

  /** Trigger an explosion. size controls how big it gets. */
  spawn(position: THREE.Vector3, size = 4): void {
    const slot = this.slots.find(s => !s.active);
    if (!slot) return;

    slot.active = true;
    slot.elapsed = 0;
    slot.startSize = size;
    slot.mesh.position.copy(position);
    slot.mesh.scale.set(0.5, 0.5, 0.5);
    slot.mesh.visible = true;

    slot.light.position.copy(position);
    slot.light.intensity = 80;
    slot.light.visible = true;

    // Randomize color slightly
    const r = 0.9 + Math.random() * 0.1;
    const g = 0.4 + Math.random() * 0.3;
    const b = 0.1 + Math.random() * 0.2;
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
  }

  update(dt: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;

      slot.elapsed += dt;
      const t = slot.elapsed / EXPLOSION_DURATION;

      if (t >= 1) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.light.visible = false;
        continue;
      }

      // Scale: expand quickly then hold
      const scaleT = Math.min(1, t * 3); // reaches full size at t=0.33
      const s = slot.startSize * (0.5 + scaleT * 0.8);
      slot.mesh.scale.set(s, s, s);

      // Opacity: hold bright then fade
      const opacity = t < 0.3 ? 1 : Math.max(0, 1 - (t - 0.3) / 0.7);
      (slot.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;

      // Light: bright flash then quick decay
      slot.light.intensity = Math.max(0, 80 * (1 - t * 2));
      if (t > 0.5) slot.light.visible = false;

      // Color shift: white → orange → red over lifetime
      const mat = slot.mesh.material as THREE.MeshBasicMaterial;
      if (t < 0.15) {
        mat.color.setRGB(1, 1, 0.9); // white-hot
      } else if (t < 0.4) {
        const p = (t - 0.15) / 0.25;
        mat.color.setRGB(1, 0.7 - p * 0.3, 0.3 - p * 0.2); // orange
      } else {
        const p = (t - 0.4) / 0.6;
        mat.color.setRGB(1 - p * 0.5, 0.2 - p * 0.15, 0.1); // deep red
      }
    }
  }
}
