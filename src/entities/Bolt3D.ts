// ── Bolt3D — Object-Pooled 3D Projectile ─────────────────
// Thin glowing cylinder with additive glow ring.
// Pre-allocated pool, activate/deactivate as needed.

import * as THREE from 'three';
import { WEAPONS, COLORS } from '../config';

export interface BoltData {
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  active: boolean;
  isPlayer: boolean;
  damage: number;
}

const POOL_SIZE = 100;
const BOLT_LENGTH = 16;
const BOLT_RADIUS = 0.3;

// Shared geometries (created once)
let boltGeo: THREE.CylinderGeometry | null = null;
let glowGeo: THREE.CylinderGeometry | null = null;

function getBoltGeo(): THREE.CylinderGeometry {
  if (!boltGeo) {
    boltGeo = new THREE.CylinderGeometry(BOLT_RADIUS, BOLT_RADIUS, BOLT_LENGTH, 6);
    boltGeo.rotateX(Math.PI / 2); // align along Z
  }
  return boltGeo;
}

function getGlowGeo(): THREE.CylinderGeometry {
  if (!glowGeo) {
    glowGeo = new THREE.CylinderGeometry(BOLT_RADIUS * 3, BOLT_RADIUS * 3, BOLT_LENGTH * 1.2, 6);
    glowGeo.rotateX(Math.PI / 2);
  }
  return glowGeo;
}

export class BoltPool {
  bolts: BoltData[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const playerBoltMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // white-hot core
    const enemyBoltMat = new THREE.MeshBasicMaterial({ color: 0xffccaa }); // hot orange-white core
    const playerGlowMat = new THREE.MeshBasicMaterial({
      color: COLORS.playerBolt,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const enemyGlowMat = new THREE.MeshBasicMaterial({
      color: COLORS.enemyBolt,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const geo = getBoltGeo();
    const gGeo = getGlowGeo();

    for (let i = 0; i < POOL_SIZE; i++) {
      const isPlayer = i < POOL_SIZE / 2;
      const mesh = new THREE.Mesh(geo, isPlayer ? playerBoltMat : enemyBoltMat);
      const glow = new THREE.Mesh(gGeo, isPlayer ? playerGlowMat : enemyGlowMat);

      mesh.visible = false;
      glow.visible = false;
      scene.add(mesh);
      scene.add(glow);

      this.bolts.push({
        mesh,
        glow,
        velocity: new THREE.Vector3(),
        lifetime: 0,
        active: false,
        isPlayer,
        damage: WEAPONS.BLASTER_DAMAGE,
      });
    }
  }

  /** Fire a bolt from position along direction. */
  fire(position: THREE.Vector3, direction: THREE.Vector3, isPlayer: boolean): BoltData | null {
    // Find an inactive bolt of the right type
    const bolt = this.bolts.find(b => !b.active && b.isPlayer === isPlayer);
    if (!bolt) return null;

    bolt.active = true;
    bolt.lifetime = WEAPONS.BLASTER_BOLT_LIFETIME;
    bolt.damage = WEAPONS.BLASTER_DAMAGE;

    bolt.mesh.position.copy(position);
    bolt.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
    bolt.mesh.visible = true;

    bolt.glow.position.copy(position);
    bolt.glow.quaternion.copy(bolt.mesh.quaternion);
    bolt.glow.visible = true;

    bolt.velocity.copy(direction).normalize().multiplyScalar(WEAPONS.BLASTER_BOLT_SPEED);

    return bolt;
  }

  /** Update all active bolts. */
  update(dt: number): void {
    const dtMs = dt * 1000;

    for (const bolt of this.bolts) {
      if (!bolt.active) continue;

      bolt.lifetime -= dtMs;
      if (bolt.lifetime <= 0) {
        this.deactivate(bolt);
        continue;
      }

      bolt.mesh.position.addScaledVector(bolt.velocity, dt);
      bolt.glow.position.copy(bolt.mesh.position);
    }
  }

  deactivate(bolt: BoltData): void {
    bolt.active = false;
    bolt.mesh.visible = false;
    bolt.glow.visible = false;
  }

  /** Get all active bolts. */
  getActive(): BoltData[] {
    return this.bolts.filter(b => b.active);
  }
}
