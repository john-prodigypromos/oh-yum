// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// Fast darting fighter: stays in close combat, makes quick
// attack dives from different angles, hard bank turns, never
// retreats. Difficulty-driven aggression and jink evasion.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type Phase = 'circling' | 'dive_attack' | 'bank_away';

export class BowTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'circling';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private breakDir = 1;
  private seed = 5.43;
  private cfg: AIConfig;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();
  private _orbitPt = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
    cfg: AIConfig,
  ) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this._setPhase('circling');
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const { sensitivity, leashRange } = this.cfg;
    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._toPlayer.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — always re-engage if too far ──
    if (distToPlayer > leashRange && this.phase !== 'circling') {
      this._setPhase('circling');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'circling':
        if (this.phaseTimer > this.phaseDuration && facingAlignment > 0.2) {
          this._setPhase('dive_attack');
        }
        if (this.phaseTimer > this.phaseDuration + 1.0) {
          this._setPhase('dive_attack');
        }
        break;

      case 'dive_attack':
        if (this.phaseTimer > this.phaseDuration || (this.phaseTimer > 0.5 && facingAlignment < -0.3)) {
          this.breakDir *= -1;
          this._setPhase('bank_away');
        }
        break;

      case 'bank_away':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('circling');
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.7;
    let fire = false;

    switch (this.phase) {
      case 'circling': {
        // Fast tight orbit — aggressive fire during orbit
        const orbitAngle = this.timer * 0.9 + chaos(this.timer, this.seed) * 1.0;
        const orbitRadius = 40 + (chaos(this.timer, this.seed * 1.5) + 1) * 15;
        this._orbitPt.set(
          target.position.x + Math.cos(orbitAngle) * orbitRadius,
          target.position.y + chaos(this.timer, this.seed * 2) * 25,
          target.position.z + Math.sin(orbitAngle) * orbitRadius,
        );
        const steer = steerToward(self, this._orbitPt, sensitivity, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = facingAlignment > 0 ? 0.9 : 0.3;

        // Aggressive fire even while circling
        if (distToPlayer < 100 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }

      case 'dive_attack': {
        // Full speed straight at the player — aggressive intercept
        leadIntercept(self.position, target.position, target.velocity, 120, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(this._right, chaos(this.timer, this.seed) * 25);

        const steer = steerToward(self, this._interceptPt, sensitivity * 1.1, 0.8);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;

        // Aggressive fire during dive
        if (distToPlayer < 130 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.5) fire = true;
        }
        break;
      }

      case 'bank_away': {
        // Hard bank turn — fast, aggressive, short
        const steer = steerAway(self, target.position, sensitivity, 0.7, this.breakDir * 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = Math.max(0.7, steer.thrust);
        pitch += this.breakDir * 0.35;
        pitch = Math.max(-1, Math.min(1, pitch));

        // Snap shots during bank
        if (distToPlayer < 90 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }
    }

    // ── Jink evasion overlay — less during dive, more during orbit/bank ──
    const isAttacking = this.phase === 'dive_attack';
    const jinkScale = isAttacking ? 0.25 : 1.0;
    const jink = jinkOverlay(this.timer, this.seed, this.cfg.jinkIntensity * jinkScale);
    yaw += jink.yaw;
    pitch += jink.pitch;

    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));

    // ── Banking roll ──
    const roll = -yaw * 0.6;

    return { yaw, pitch, roll, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;

    const aggrScale = 1 - this.cfg.aggression * 0.5;

    switch (phase) {
      case 'circling':    this.phaseDuration = (0.8 + (chaos(this.timer, this.seed) + 1) * 0.6) * aggrScale; break;
      case 'dive_attack': this.phaseDuration = (1.0 + (chaos(this.timer, this.seed) + 1) * 0.5) * aggrScale; break;
      case 'bank_away':   this.phaseDuration = (0.3 + (chaos(this.timer, this.seed) + 1) * 0.2) * aggrScale; break;
      default:            this.phaseDuration = 2 * aggrScale; break;
    }
  }
}
