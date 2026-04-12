// ── Ship3D Entity ────────────────────────────────────────
// Core 3D ship entity used for both player and enemies.
// Wraps a Three.js Group with game state (hull, shield, velocity).

import * as THREE from 'three';
import { SHIP } from '../config';

export interface Ship3DConfig {
  group: THREE.Group;
  maxHull: number;
  maxShield: number;
  speedMult: number;
  rotationMult: number;
  isPlayer: boolean;
}

export class Ship3D {
  group: THREE.Group;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  speedMult: number;
  rotationMult: number;
  isPlayer: boolean;
  alive = true;

  velocity = new THREE.Vector3();
  angularVelocity = new THREE.Vector3(); // pitch, yaw, roll rates

  iframesUntil = 0;
  lastFireTime = 0;
  lastDamageTime = 0;
  shieldRegenTimer = 0;
  score = 0;

  constructor(config: Ship3DConfig) {
    this.group = config.group;
    this.hull = config.maxHull;
    this.maxHull = config.maxHull;
    this.shield = config.maxShield;
    this.maxShield = config.maxShield;
    this.speedMult = config.speedMult;
    this.rotationMult = config.rotationMult;
    this.isPlayer = config.isPlayer;
  }

  /** Forward direction in world space (ship faces +Z locally).
   *  Returns a shared scratch vector — treat as ephemeral (do not store). */
  private static _fwd = new THREE.Vector3();
  getForward(): THREE.Vector3 {
    return Ship3D._fwd.set(0, 0, 1).applyQuaternion(this.group.quaternion);
  }

  /** Position shorthand. */
  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Quaternion shorthand. */
  get quaternion(): THREE.Quaternion {
    return this.group.quaternion;
  }

  /** Apply damage — shields absorb first, then hull. Returns actual damage dealt. */
  applyDamage(amount: number, now: number): number {
    if (!this.alive || this.isInvincible(now)) return 0;

    let remaining = amount;

    // Shield absorbs first
    if (this.shield > 0) {
      const shieldAbsorb = Math.min(this.shield, remaining);
      this.shield -= shieldAbsorb;
      remaining -= shieldAbsorb;
    }

    // Hull takes the rest
    if (remaining > 0) {
      this.hull -= remaining;
    }

    this.lastDamageTime = now;
    this.shieldRegenTimer = 0;
    this.iframesUntil = now + SHIP.IFRAMES;

    if (this.hull <= 0) {
      this.hull = 0;
      this.alive = false;
    }

    return amount - remaining;
  }

  isInvincible(now: number): boolean {
    return now < this.iframesUntil;
  }

  /** Regenerate shield over time. */
  updateShieldRegen(dt: number): void {
    if (!this.alive || this.shield >= this.maxShield) return;

    this.shieldRegenTimer += dt * 1000;
    if (this.shieldRegenTimer >= SHIP.SHIELD_REGEN_DELAY) {
      this.shieldRegenTimer = SHIP.SHIELD_REGEN_DELAY; // cap — prevent runaway accumulation
      this.shield = Math.min(this.maxShield, this.shield + SHIP.SHIELD_REGEN_RATE * dt);
    }
  }

  /** Hull damage as 0-1 fraction. */
  get damagePct(): number {
    return 1 - this.hull / this.maxHull;
  }

  /** Shield as 0-1 fraction. */
  get shieldPct(): number {
    return this.maxShield > 0 ? this.shield / this.maxShield : 0;
  }

  /** Reset to full health for new round. */
  reset(): void {
    this.hull = this.maxHull;
    this.shield = this.maxShield;
    this.alive = true;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.iframesUntil = 0;
    this.shieldRegenTimer = 0;
  }
}
