// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// Fast darting fighter: stays in close combat, makes quick
// attack dives from different angles, hard bank turns, never
// retreats. Ghost feel from jink, speed, and unpredictable
// approach angles — not from hiding at distance.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
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
  private _snapImpulse = 0;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();
  private _orbitPt = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
    this._setPhase('circling');
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._toPlayer.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — always re-engage if too far ──
    if (distToPlayer > 150 && this.phase !== 'circling') {
      this._setPhase('circling');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'circling':
        // Orbit close, then dive when time is up and roughly facing player
        if (this.phaseTimer > this.phaseDuration && facingAlignment > 0.2) {
          this._setPhase('dive_attack');
        }
        // Safety: dive anyway after extra time
        if (this.phaseTimer > this.phaseDuration + 1.5) {
          this._setPhase('dive_attack');
        }
        break;

      case 'dive_attack':
        // Break off after passing or time limit
        if (this.phaseTimer > this.phaseDuration || (this.phaseTimer > 0.5 && facingAlignment < -0.3)) {
          this.breakDir *= -1;
          this._setPhase('bank_away');
        }
        break;

      case 'bank_away':
        // Hard bank, then back to circling
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
        // Fast tight orbit — different angle each cycle via chaos
        const orbitAngle = this.timer * 0.9 + chaos(this.timer, this.seed) * 1.0;
        const orbitRadius = 40 + (chaos(this.timer, this.seed * 1.5) + 1) * 15; // 40-70u
        this._orbitPt.set(
          target.position.x + Math.cos(orbitAngle) * orbitRadius,
          target.position.y + chaos(this.timer, this.seed * 2) * 25,
          target.position.z + Math.sin(orbitAngle) * orbitRadius,
        );
        const steer = steerToward(self, this._orbitPt, 4.0, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Direction-aware: coast if facing away
        thrust = facingAlignment > 0 ? 0.9 : 0.3;

        // Opportunistic fire while circling
        if (distToPlayer < 100 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'dive_attack': {
        // Full speed straight at the player — aggressive intercept
        leadIntercept(self.position, target.position, target.velocity, 120, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(this._right, chaos(this.timer, this.seed) * 25);

        const steer = steerToward(self, this._interceptPt, 4.5, 0.8);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // full afterburner

        // Aggressive fire during dive
        if (distToPlayer < 130 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.5) fire = true;
        }
        break;
      }

      case 'bank_away': {
        // Hard bank turn — fast, aggressive, short
        const steer = steerAway(self, target.position, 5.0, 0.7, this.breakDir * 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = Math.max(0.7, steer.thrust);
        pitch += this.breakDir * 0.35;
        pitch = Math.max(-1, Math.min(1, pitch));

        // Snap shots during bank
        if (distToPlayer < 90 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }
    }

    // ── Snap impulse on phase transitions ──
    if (this._snapImpulse !== 0) {
      yaw += this._snapImpulse;
      this._snapImpulse = 0;
    }

    // ── Jink overlay — darting, quick ──
    const jink = jinkOverlay(this.timer, this.seed, 0.55);
    yaw = Math.max(-1, Math.min(1, yaw + jink.yaw));
    pitch = Math.max(-1, Math.min(1, pitch + jink.pitch));

    return { yaw, pitch, roll: 0, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this._snapImpulse = 0.4 * this.breakDir;

    switch (phase) {
      case 'circling':    this.phaseDuration = 0.8 + (chaos(this.timer, this.seed) + 1) * 0.6; break; // 0.8-2.0s
      case 'dive_attack': this.phaseDuration = 1.0 + (chaos(this.timer, this.seed) + 1) * 0.5; break; // 1.0-2.0s
      case 'bank_away':   this.phaseDuration = 0.3 + (chaos(this.timer, this.seed) + 1) * 0.2; break; // 0.3-0.7s
      default:            this.phaseDuration = 2; break;
    }
  }
}
