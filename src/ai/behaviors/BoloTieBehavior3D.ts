// ── Bolo Tie Boss AI (Level 1) ───────────────────────────
// Brute: ram charges, wide turns, slow but hits hard.
// Telegraphed charge with engine flare, 3x collision damage.
// Uses physics-based steering — never stalls.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept } from '../Steering';

type Phase = 'dogfight' | 'charge_telegraph' | 'charging' | 'charge_cooldown' | 'breakaway';

export class BoloTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'dogfight';
  private phaseTimer = 0;
  private timer = 0;
  private chargeCooldown = 5;
  private breakDir = 1;

  private _interceptPt = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
  }

  /** Whether a charge just landed (for 3x collision damage in ArenaLoop). */
  isCharging = false;

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      this.isCharging = false;
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;
    this.isCharging = false;

    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = new THREE.Vector3().subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Phase transitions ──
    switch (this.phase) {
      case 'dogfight':
        if (this.phaseTimer > this.chargeCooldown && distToPlayer < 300) {
          this.phase = 'charge_telegraph';
          this.phaseTimer = 0;
        }
        break;
      case 'charge_telegraph':
        if (this.phaseTimer > 0.8) {
          this.phase = 'charging';
          this.phaseTimer = 0;
        }
        break;
      case 'charging':
        if (this.phaseTimer > 2.0 || distToPlayer < 25) {
          this.phase = 'charge_cooldown';
          this.phaseTimer = 0;
          this.breakDir *= -1;
        }
        break;
      case 'charge_cooldown':
        if (this.phaseTimer > 1.5) {
          this.phase = 'breakaway';
          this.phaseTimer = 0;
        }
        break;
      case 'breakaway':
        if (distToPlayer > 200 || this.phaseTimer > 3) {
          this.phase = 'dogfight';
          this.phaseTimer = 0;
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.phase) {
      case 'dogfight': {
        // Orbit the player with wide turns, firing when aligned
        leadIntercept(self.position, target.position, target.velocity, 50, this._interceptPt);
        // Offset to orbit rather than fly straight at them
        const orbitOffset = Math.sin(this.timer * 0.5) * 80;
        const right = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(right, orbitOffset);
        this._interceptPt.y += Math.cos(this.timer * 0.4) * 20;

        const steer = steerToward(self, this._interceptPt, 1.8, 0.4);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        if (distToPlayer < 200 && facingAlignment > 0.5) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'charge_telegraph': {
        // Slow down, face the player — winding up for the charge
        const steer = steerToward(self, target.position, 3.0, 0.1);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 0.1; // braking
        break;
      }

      case 'charging': {
        // Full-speed ram toward the player
        this.isCharging = true;
        const steer = steerToward(self, target.position, 1.5, 1.0);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // max afterburner

        // Add direct velocity boost for the charge feel
        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 200 * dt);
        break;
      }

      case 'charge_cooldown': {
        // Drift forward after the charge, decelerating
        thrust = 0.3;
        // Gentle turn to start recovering
        const steer = steerAway(self, target.position, 1.0, 0.3, this.breakDir * 0.3);
        yaw = steer.yaw * 0.5;
        pitch = steer.pitch * 0.5;
        break;
      }

      case 'breakaway': {
        // Hard turn away to reset for the next charge
        const steer = steerAway(self, target.position, 2.5, 0.6, this.breakDir * 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }
    }

    return { yaw, pitch, roll: 0, thrust, fire };
  }
}
