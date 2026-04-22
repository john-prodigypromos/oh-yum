// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// Fast committed breaks + steering smoothing.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos } from '../Steering';

type Phase = 'chase' | 'engage' | 'overshoot' | 'evade';

export class BowTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private seed = 5.43;
  private evadeYaw = 0;
  private evadePitch = 0;
  private prevYaw = 0;
  private prevPitch = 0;

  private _interceptPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();

  constructor(_aimAccuracy: number, fireRate: number, _chaseRange: number, cfg: AIConfig) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this._setPhase('chase');
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const { sensitivity, leashRange } = this.cfg;
    const dist = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._tmpVec.subVectors(target.position, self.position).normalize();
    const facing = forward.dot(toPlayer);
    const engageRange = leashRange * 0.5;

    if (dist > leashRange && this.phase !== 'chase') this._setPhase('chase');

    switch (this.phase) {
      case 'chase':
        if (dist < engageRange && facing > 0.3) this._setPhase('engage');
        break;
      case 'engage':
        if (facing < -0.3 && dist < 80) this._setPhase('overshoot');
        else if (this.phaseTimer > this.phaseDuration || dist > leashRange * 0.7) this._setPhase('evade');
        else if (facing < -0.15) this._setPhase('evade');
        break;
      case 'overshoot':
        if (this.phaseTimer > this.phaseDuration) this._setPhase('chase');
        break;
      case 'evade':
        if (this.phaseTimer > this.phaseDuration) this._setPhase('chase');
        break;
    }

    let yaw = 0, pitch = 0, thrust = 0.7, fire = false;
    let smooth = true;

    switch (this.phase) {
      case 'chase': {
        leadIntercept(self.position, target.position, target.velocity, 120, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, sensitivity * 1.4, 0.5);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = facing > 0.3 ? 1.0 : 0.4;
        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.7) fire = true;
        }
        break;
      }
      case 'engage': {
        leadIntercept(self.position, target.position, target.velocity, 130, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, sensitivity * 1.5, 0.6);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = 1.0;
        if (facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.4) fire = true;
        }
        break;
      }
      case 'overshoot': {
        const steer = steerAway(self, target.position, sensitivity * 1.1, 0.5, 0);
        yaw = steer.yaw; pitch = steer.pitch - 0.5;
        pitch = Math.max(-1, Math.min(1, pitch));
        thrust = 0.4;
        break;
      }
      case 'evade': {
        yaw = this.evadeYaw;
        pitch = this.evadePitch;
        thrust = 1.0;
        smooth = false;
        break;
      }
    }

    if (smooth) {
      yaw = yaw * 0.3 + this.prevYaw * 0.7;
      pitch = pitch * 0.3 + this.prevPitch * 0.7;
    }
    this.prevYaw = yaw;
    this.prevPitch = pitch;

    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));
    return { yaw, pitch, roll: -yaw * 0.6, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    const a = this.cfg.aggression;
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;
    switch (phase) {
      case 'chase':     this.phaseDuration = 5; break;
      case 'engage':    this.phaseDuration = 1.5 + r * 2.0; break;
      case 'overshoot': this.phaseDuration = 0.2 + r * 0.2; break;
      case 'evade': {
        this.phaseDuration = 2.0 + r * 1.0;
        const dirSeed = chaos(this.timer * 3, this.seed);
        const dir = Math.floor((dirSeed + 1) * 5) % 10;
        const intensity = 0.7 + a * 0.3;
        switch (dir) {
          case 0: this.evadeYaw = -intensity; this.evadePitch = 0; break;
          case 1: this.evadeYaw = intensity;  this.evadePitch = 0; break;
          case 2: this.evadeYaw = 0;          this.evadePitch = -intensity; break;
          case 3: this.evadeYaw = 0;          this.evadePitch = -intensity; break;
          case 4: this.evadeYaw = 0;          this.evadePitch = intensity; break;
          case 5: this.evadeYaw = 0;          this.evadePitch = intensity; break;
          case 6: this.evadeYaw = -intensity * 0.5; this.evadePitch = -intensity; break;
          case 7: this.evadeYaw = intensity * 0.5;  this.evadePitch = -intensity; break;
          case 8: this.evadeYaw = -intensity * 0.5; this.evadePitch = intensity; break;
          case 9: this.evadeYaw = intensity * 0.5;  this.evadePitch = intensity; break;
        }
        this.prevYaw = this.evadeYaw;
        this.prevPitch = this.evadePitch;
        break;
      }
    }
  }
}
