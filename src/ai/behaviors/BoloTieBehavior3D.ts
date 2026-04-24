// ── Bolo Tie Boss AI (Level 1) ───────────────────────────
// Top Gun maneuvers + afterburner charge.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos } from '../Steering';

type Phase = 'chase' | 'evade';
type Maneuver = 'break_turn' | 'dive_pull' | 'climb_roll' | 'split_s' | 'scissors' | 'throttle_cut';

export class BoloTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private seed = 3.71;
  private maneuver: Maneuver = 'break_turn';
  private maneuverDir = 1;
  private prevYaw = 0;
  private prevPitch = 0;

  isCharging = false;

  private _interceptPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();

  constructor(_aimAccuracy: number, fireRate: number, _chaseRange: number, cfg: AIConfig) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this._setPhase('chase');
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      this.isCharging = false;
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;
    this.isCharging = false;

    const { sensitivity, leashRange } = this.cfg;
    const dist = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._tmpVec.subVectors(target.position, self.position).normalize();
    const facing = forward.dot(toPlayer);
    const engageRange = leashRange * 0.5;

    if (dist > leashRange && this.phase !== 'chase') this._setPhase('chase');

    switch (this.phase) {
      case 'chase':
        if (dist < engageRange && facing > 0.35) this._setPhase('evade');
        break;
      case 'evade':
        if (this.phaseTimer > this.phaseDuration) this._setPhase('chase');
        break;
    }

    let yaw = 0, pitch = 0, thrust = 0.7, fire = false;
    let smooth = true;

    switch (this.phase) {
      case 'chase': {
        leadIntercept(self.position, target.position, target.velocity, 95, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, sensitivity * 1.3, 0.5);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = facing > 0.3 ? 1.0 : 0.5;
        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }
      case 'evade': {
        smooth = false;
        const t = this.phaseTimer;
        const d = this.maneuverDir;
        const I = 0.6 + this.cfg.aggression * 0.4;

        switch (this.maneuver) {
          case 'break_turn':
            yaw = d * I; pitch = -0.3 * I; thrust = 1.0;
            break;
          case 'dive_pull':
            if (t < this.phaseDuration * 0.45) {
              yaw = 0; pitch = 0.9 * I; thrust = 1.0;
            } else {
              yaw = d * 0.3; pitch = -0.9 * I; thrust = 0.8;
            }
            break;
          case 'climb_roll':
            if (t < this.phaseDuration * 0.5) {
              yaw = 0; pitch = -I; thrust = 1.0;
            } else {
              yaw = d * I; pitch = 0; thrust = 0.9;
            }
            break;
          case 'split_s':
            if (t < this.phaseDuration * 0.3) {
              yaw = 0; pitch = 0.8 * I; thrust = 0.6;
            } else {
              yaw = d * 0.2; pitch = -0.7 * I; thrust = 1.0;
            }
            break;
          case 'scissors': {
            const sp = Math.floor(t / 1.6) % 2;
            yaw = sp === 0 ? d * I : -d * I;
            pitch = (sp === 0 ? -0.3 : 0.3) * I;
            thrust = 0.7;
            break;
          }
          case 'throttle_cut':
            if (t < this.phaseDuration * 0.35) {
              yaw = d * 0.3; pitch = 0; thrust = 0;
            } else {
              yaw = d * I; pitch = -0.4 * I; thrust = 1.0;
            }
            break;
        }
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
    this.isCharging = false;
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;
    switch (phase) {
      case 'chase':     this.phaseDuration = 5; break;
      case 'evade': {
        this.phaseDuration = 5.0 + r * 3.0;
        this.maneuverDir *= -1;
        const maneuvers: Maneuver[] = ['break_turn','break_turn','dive_pull','dive_pull','climb_roll','split_s','scissors','throttle_cut'];
        const pick = Math.floor((chaos(this.timer * 5, this.seed) + 1) * 0.5 * maneuvers.length) % maneuvers.length;
        this.maneuver = maneuvers[pick];
        this.prevYaw = 0; this.prevPitch = 0;
        break;
      }
    }
  }
}
