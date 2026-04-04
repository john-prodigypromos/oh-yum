// ── Explosion3D — Particle Burst + Flash Light ───────────
// InstancedMesh particle system for explosions.
// Object-pooled: pre-allocate N explosion slots, recycle.

import * as THREE from 'three';

const PARTICLES_PER_EXPLOSION = 150;
const MAX_EXPLOSIONS = 10;
const EXPLOSION_DURATION = 1.2; // seconds — visible at distance

interface ExplosionSlot {
  active: boolean;
  elapsed: number;
  origin: THREE.Vector3;
  velocities: THREE.Vector3[];
  light: THREE.PointLight;
}

export class ExplosionPool {
  private scene: THREE.Scene;
  private mesh: THREE.InstancedMesh;
  private slots: ExplosionSlot[] = [];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Particle geometry — small plane quad
    const geo = new THREE.PlaneGeometry(1.5, 1.5); // big particles visible at 35 units
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const totalInstances = MAX_EXPLOSIONS * PARTICLES_PER_EXPLOSION;
    this.mesh = new THREE.InstancedMesh(geo, mat, totalInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = true;

    // Hide all instances initially
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < totalInstances; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);

    // Create slots
    for (let s = 0; s < MAX_EXPLOSIONS; s++) {
      const velocities: THREE.Vector3[] = [];
      for (let p = 0; p < PARTICLES_PER_EXPLOSION; p++) {
        // Spherical random velocity
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 30 + Math.random() * 80;
        velocities.push(new THREE.Vector3(
          speed * Math.sin(phi) * Math.cos(theta),
          speed * Math.sin(phi) * Math.sin(theta),
          speed * Math.cos(phi),
        ));
      }

      const light = new THREE.PointLight(0xffaa44, 0, 100, 2);
      light.visible = false;
      scene.add(light);

      this.slots.push({
        active: false,
        elapsed: 0,
        origin: new THREE.Vector3(),
        velocities,
        light,
      });
    }
  }

  /** Trigger an explosion at the given position. */
  spawn(position: THREE.Vector3): void {
    const slot = this.slots.find(s => !s.active);
    if (!slot) return;

    slot.active = true;
    slot.elapsed = 0;
    slot.origin.copy(position);
    slot.light.position.copy(position);
    slot.light.intensity = 50;
    slot.light.visible = true;
  }

  /** Update all active explosions. */
  update(dt: number): void {
    for (let s = 0; s < this.slots.length; s++) {
      const slot = this.slots[s];
      if (!slot.active) continue;

      slot.elapsed += dt;
      const t = slot.elapsed / EXPLOSION_DURATION;

      if (t >= 1) {
        // Explosion done — hide particles
        slot.active = false;
        slot.light.visible = false;
        slot.light.intensity = 0;

        const baseIdx = s * PARTICLES_PER_EXPLOSION;
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        for (let p = 0; p < PARTICLES_PER_EXPLOSION; p++) {
          this.mesh.setMatrixAt(baseIdx + p, this.dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        continue;
      }

      // ── Animate particles ──
      const baseIdx = s * PARTICLES_PER_EXPLOSION;
      const scale = Math.max(0, 1 - t * t); // shrink over time
      const alpha = Math.max(0, 1 - t);

      // Flash light decays fast
      slot.light.intensity = Math.max(0, 50 * (1 - t * 3));
      if (t > 0.3) slot.light.visible = false;

      // Color: white → yellow → orange → red over lifetime
      if (t < 0.2) {
        this.color.setHex(0xffffff);
      } else if (t < 0.5) {
        this.color.lerpColors(new THREE.Color(0xffff88), new THREE.Color(0xff8822), (t - 0.2) / 0.3);
      } else {
        this.color.lerpColors(new THREE.Color(0xff8822), new THREE.Color(0xff2200), (t - 0.5) / 0.5);
      }

      for (let p = 0; p < PARTICLES_PER_EXPLOSION; p++) {
        const vel = slot.velocities[p];
        this.dummy.position.set(
          slot.origin.x + vel.x * slot.elapsed,
          slot.origin.y + vel.y * slot.elapsed,
          slot.origin.z + vel.z * slot.elapsed,
        );
        this.dummy.scale.set(scale * (0.5 + Math.random() * 0.5), scale * (0.5 + Math.random() * 0.5), 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(baseIdx + p, this.dummy.matrix);
        this.mesh.setColorAt(baseIdx + p, this.color);
      }

      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
