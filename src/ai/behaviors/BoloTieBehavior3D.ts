// ── Bolo Tie Boss AI (Level 1) ───────────────────────────
// Predator: prowls close, tightens the noose, charges at full
// afterburner. Cat-and-mouse with speed variation. Controlled
// jink — deliberate, not sloppy. NEVER stops moving.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type Phase = 'prowl' | 'close_in' | 'charging' | 'recovery';

export class BoloTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'prowl';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private breakDir = 1;
  private seed = 3.71; // unique per boss
  private _snapImpulse = 0;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _prowlPt = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
    this._setPhase('prowl');
  }

  /** Whether a charge is active (for 3x collision damage in ArenaLoop). */
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
    const toPlayer = this._toPlayer.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — always re-engage if too far ──
    if (distToPlayer > 160 && this.phase !== 'close_in') {
      this._setPhase('close_in');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'prowl':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('close_in');
        }
        break;

      case 'close_in':
        if (distToPlayer < 65 && facingAlignment > 0.5) {
          this._setPhase('charging');
        }
        if (this.phaseTimer > 3.0 && distToPlayer < 120) {
          this._setPhase('charging');
        }
        break;

      case 'charging':
        if (this.phaseTimer > this.phaseDuration || (this.phaseTimer > 0.6 && facingAlignment < -0.3)) {
          this.breakDir *= -1;
          this._setPhase('recovery');
        }
        break;

      case 'recovery':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('prowl');
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.phase) {
      case 'prowl': {
        // Circle the player at close range — predatory lunges
        const orbitAngle = this.timer * 0.7 + chaos(this.timer, this.seed) * 0.8;
        const orbitRadius = 35 + (chaos(this.timer, this.seed * 1.3) + 1) * 15; // 35-65u
        this._prowlPt.set(
          target.position.x + Math.cos(orbitAngle) * orbitRadius,
          target.position.y + Math.sin(this.timer * 0.5) * 20 + 18,
          target.position.z + Math.sin(orbitAngle) * orbitRadius,
        );

        const steer = steerToward(self, this._prowlPt, 2.5, 0.55);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Predatory lunges — speed bursts every ~0.8s
        thrust = this.phaseTimer % 0.8 < 0.3 ? 0.9 : 0.7;

        if (distToPlayer < 120 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'close_in': {
        leadIntercept(self.position, target.position, target.velocity, 95, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(this._right, chaos(this.timer, this.seed) * 30 * this.breakDir);
        this._interceptPt.y += 14;

        const steer = steerToward(self, this._interceptPt, 3.5, 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 0.85;

        if (distToPlayer < 140 && facingAlignment > 0.25) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'charging': {
        this.isCharging = true;
        const steer = steerToward(self, target.position, 2.0, 1.0);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;

        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 200 * dt);

        if (distToPlayer < 150 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.4) fire = true;
        }
        break;
      }

      case 'recovery': {
        const steer = steerAway(self, target.position, 3.5, 0.6, this.breakDir * 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = Math.max(0.6, steer.thrust);
        pitch += this.breakDir * 0.3;
        pitch = Math.max(-1, Math.min(1, pitch));

        // Opportunistic fire during recovery
        if (distToPlayer < 100 && facingAlignment > 0.2) {
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

    // ── Jink overlay — controlled predator ──
    const jink = jinkOverlay(this.timer, this.seed, 0.35);
    yaw = Math.max(-1, Math.min(1, yaw + jink.yaw));
    pitch = Math.max(-1, Math.min(1, pitch + jink.pitch));

    return { yaw, pitch, roll: 0, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this._snapImpulse = 0.4 * this.breakDir;

    switch (phase) {
      case 'prowl':    this.phaseDuration = 1.2 + (chaos(this.timer, this.seed) + 1) * 0.65; break; // 1.2-2.5s
      case 'charging': this.phaseDuration = 1.5 + (chaos(this.timer, this.seed) + 1) * 0.5; break;  // 1.5-2.5s
      case 'recovery': this.phaseDuration = 0.4 + (chaos(this.timer, this.seed) + 1) * 0.2; break;  // 0.4-0.8s
      default:         this.phaseDuration = 3; break;
    }
  }
}
