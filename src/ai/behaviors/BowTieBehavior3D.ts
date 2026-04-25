// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// "The Diver" — aggressive vertical fighter. Attacks from above/below.
// Prefers dive pulls, split-S, and sharp altitude changes.
// Yo-yo energy traps — climbs high then dives on the player.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos } from '../Steering';

type Phase = 'chase' | 'evade';
type Maneuver = 'yo_yo' | 'dive_pull' | 'split_s' | 'climb_roll' | 'scissors';

export class BowTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private seed = 5.43;
  private maneuver: Maneuver = 'dive_pull';
  private maneuverDir = 1;
  private prevYaw = 0;
  private prevPitch = 0;

  private _interceptPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();
  private _divePt = new THREE.Vector3();

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
    const engageRange = leashRange * 0.7; // break off earlier

    if (dist > leashRange && this.phase !== 'chase') this._setPhase('chase');

    switch (this.phase) {
      case 'chase':
        if (dist < engageRange && facing > 0.3) this._setPhase('evade');
        break;
      case 'evade':
        if (this.phaseTimer > this.phaseDuration) this._setPhase('chase');
        break;
    }

    let yaw = 0, pitch = 0, thrust = 0.7, fire = false;
    let smooth = true;

    switch (this.phase) {
      case 'chase': {
        // Aggressive pursuit with altitude offset — approaches from above or below
        leadIntercept(self.position, target.position, target.velocity, 130, this._interceptPt);
        // Bias the intercept point vertically
        this._interceptPt.y += this.maneuverDir * 40;
        const steer = steerToward(self, this._interceptPt, sensitivity * 1.4, 0.5);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = facing > 0.3 ? 1.0 : 0.5;
        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }
      case 'evade': {
        const t = this.phaseTimer;
        const d = this.maneuverDir;
        const I = 0.8 + this.cfg.aggression * 0.2; // high intensity — aggressive

        switch (this.maneuver) {
          case 'yo_yo': {
            // Signature move: climb hard, pause, then dive on the player
            smooth = false;
            const climbPhase = this.phaseDuration * 0.4;
            const pausePhase = this.phaseDuration * 0.55;
            if (t < climbPhase) {
              // Climb phase — full thrust, steep pitch up, slight yaw
              yaw = d * 0.15; pitch = -I; thrust = 1.0;
            } else if (t < pausePhase) {
              // Apex pause — throttle cut, float
              yaw = 0; pitch = 0; thrust = 0.1;
            } else {
              // Dive phase — nose down hard, full thrust at the player
              this._divePt.copy(target.position);
              this._divePt.y -= 30; // aim below to extend the dive
              const steer = steerToward(self, this._divePt, sensitivity * 1.6, 0.6);
              yaw = steer.yaw; pitch = steer.pitch;
              thrust = 1.0;
              // Fire during dive
              if (facing > this.cfg.fireCone * 0.8) {
                if (now - self.lastFireTime >= this.fireRate * 0.4) fire = true;
              }
            }
            break;
          }
          case 'dive_pull':
            smooth = false;
            if (t < this.phaseDuration * 0.5) {
              // Deep dive — steep nose down
              yaw = d * 0.1; pitch = I; thrust = 1.0;
            } else {
              // Hard pull up with lateral break
              yaw = d * 0.4; pitch = -I; thrust = 0.9;
            }
            break;
          case 'split_s': {
            smooth = false;
            // Inverted half-loop — roll and pull
            const halfWay = this.phaseDuration * 0.35;
            if (t < halfWay) {
              yaw = 0; pitch = I * 0.9; thrust = 0.5; // nose down
            } else {
              yaw = d * 0.3; pitch = -I; thrust = 1.0; // hard pull through
            }
            break;
          }
          case 'climb_roll':
            smooth = false;
            if (t < this.phaseDuration * 0.45) {
              yaw = 0; pitch = -I; thrust = 1.0; // steep climb
            } else {
              yaw = d * I * 0.8; pitch = 0.3; thrust = 0.8; // roll off the top
            }
            break;
          case 'scissors': {
            smooth = false;
            // Vertical scissors — pitch alternates instead of yaw
            const sp = Math.floor(t / 1.4) % 2;
            yaw = d * 0.3;
            pitch = sp === 0 ? -I * 0.8 : I * 0.8;
            thrust = 0.8;
            break;
          }
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
    return { yaw, pitch, roll: -yaw * 0.7, thrust, fire }; // more roll — aggressive banking
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;
    switch (phase) {
      case 'chase':     this.phaseDuration = 2.5; break; // brief chase then back to maneuvers
      case 'evade': {
        this.phaseDuration = 4.0 + r * 2.0; // 4-6s — quick reset, more time pressuring the player
        this.maneuverDir *= -1;
        // Heavily weighted toward vertical maneuvers
        const maneuvers: Maneuver[] = ['yo_yo','yo_yo','yo_yo','dive_pull','dive_pull','split_s','split_s','climb_roll','scissors'];
        const pick = Math.floor((chaos(this.timer * 5, this.seed) + 1) * 0.5 * maneuvers.length) % maneuvers.length;
        this.maneuver = maneuvers[pick];
        this.prevYaw = 0; this.prevPitch = 0;
        break;
      }
    }
  }
}
