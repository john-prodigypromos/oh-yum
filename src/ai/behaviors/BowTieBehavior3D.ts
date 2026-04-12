// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// Ghost: hit-and-run from the fog. Dives close, fires burst,
// retreats with parting shots. Darting, quick direction changes.
// Medium jink — unpredictable ambush timing.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type Phase = 'hidden' | 'approach' | 'attack' | 'retreat';

export class BowTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'hidden';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private breakDir = 1;
  private seed = 5.43;
  private _snapImpulse = 0;

  // Fog visibility range — enemies beyond this are "hidden"
  private readonly FOG_RANGE = 180;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _retreatPt = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();
  private _approachDir = new THREE.Vector3();
  private _orbitPt = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
    this.phaseTimer = 2;
    this._setPhase('hidden');
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

    // ── Phase transitions ──
    switch (this.phase) {
      case 'hidden':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('approach');
          // Warp to fog edge from a chaotic angle for the ambush
          const angle = chaos(this.timer, this.seed) * Math.PI + Math.PI;
          this._approachDir.set(
            Math.cos(angle), (chaos(this.timer, this.seed * 2) - 0.5) * 0.3, Math.sin(angle),
          ).normalize();
          self.position.copy(target.position).addScaledVector(this._approachDir, this.FOG_RANGE + 50);
          self.velocity.copy(this._approachDir).negate().multiplyScalar(50);
          self.group.lookAt(target.position);
          this.breakDir *= -1;
        }
        break;
      case 'approach':
        if (distToPlayer < 45 || this.phaseTimer > 3.5) {
          this._setPhase('attack');
        }
        break;
      case 'attack':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('retreat');
          // Set retreat point beyond fog — chaotic angle
          const retreatAngle = chaos(this.timer, this.seed * 3) * Math.PI + Math.PI;
          this._retreatPt.set(
            target.position.x + Math.cos(retreatAngle) * (this.FOG_RANGE + 100),
            target.position.y + chaos(this.timer, this.seed * 4) * 30,
            target.position.z + Math.sin(retreatAngle) * (this.FOG_RANGE + 100),
          );
        }
        break;
      case 'retreat':
        if (distToPlayer > this.FOG_RANGE + 30 || this.phaseTimer > 3) {
          this._setPhase('hidden');
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.5;
    let fire = false;

    switch (this.phase) {
      case 'hidden': {
        // Circle beyond fog range — tighter orbit
        const angle = this.timer * 0.5 + chaos(this.timer, this.seed) * 0.5;
        this._orbitPt.set(
          target.position.x + Math.cos(angle) * (this.FOG_RANGE + 30),
          target.position.y + Math.sin(this.timer * 0.3) * 20,
          target.position.z + Math.sin(angle) * (this.FOG_RANGE + 30),
        );
        const steer = steerToward(self, this._orbitPt, 1.5, 0.4);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }

      case 'approach': {
        // Dive toward player at high speed — aggressive intercept
        leadIntercept(self.position, target.position, target.velocity, 110, this._interceptPt);
        this._interceptPt.y += 16;
        const steer = steerToward(self, this._interceptPt, 3.0, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;
        break;
      }

      case 'attack': {
        // Close-range attack pass — tight pursuit, aggressive firing
        leadIntercept(self.position, target.position, target.velocity, 100, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(this._right, chaos(this.timer, this.seed) * 40);

        const steer = steerToward(self, this._interceptPt, 2.5, 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        // Aggressive burst fire during attack
        if (distToPlayer < 120 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }

      case 'retreat': {
        // Flee to retreat point at high speed
        const steer = steerToward(self, this._retreatPt, 2.5, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Delayed afterburner kick
        thrust = this.phaseTimer < 0.5 ? 0.85 : 1.0;

        // Parting shots during retreat
        if (distToPlayer < 120 && facingAlignment > 0.25) {
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

    // ── Jink overlay — darting ghost ──
    const jink = jinkOverlay(this.timer, this.seed, 0.5);
    yaw = Math.max(-1, Math.min(1, yaw + jink.yaw));
    pitch = Math.max(-1, Math.min(1, pitch + jink.pitch));

    return { yaw, pitch, roll: 0, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this._snapImpulse = 0.4 * this.breakDir;

    switch (phase) {
      case 'hidden': this.phaseDuration = 2.0 + (chaos(this.timer, this.seed) + 1) * 1.0; break; // 2-4s
      case 'attack': this.phaseDuration = 1.8 + (chaos(this.timer, this.seed) + 1) * 0.7; break; // 1.8-3.2s
      default:       this.phaseDuration = 3; break;
    }
  }
}
