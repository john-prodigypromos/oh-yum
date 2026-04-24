// ── Bolo Tie Boss AI (Level 1) ───────────────────────────
// "The Circler" — lazy wide sweeping arcs, predictable orbits.
// Easiest boss. Prefers break turns and wide orbits at distance.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos } from '../Steering';

type Phase = 'chase' | 'evade';
type Maneuver = 'wide_orbit' | 'break_turn' | 'climb_roll' | 'throttle_cut';

export class BoloTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private seed = 3.71;
  private maneuver: Maneuver = 'wide_orbit';
  private maneuverDir = 1;
  private prevYaw = 0;
  private prevPitch = 0;
  private orbitAngle = 0;

  isCharging = false;

  private _interceptPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();
  private _orbitPt = new THREE.Vector3();

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
        // Lazy pursuit — low sensitivity, wide arcs
        leadIntercept(self.position, target.position, target.velocity, 80, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, sensitivity * 0.9, 0.4);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = facing > 0.3 ? 0.8 : 0.5;
        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }
      case 'evade': {
        const t = this.phaseTimer;
        const d = this.maneuverDir;
        const I = 0.5 + this.cfg.aggression * 0.3; // lower intensity — lazier

        switch (this.maneuver) {
          case 'wide_orbit': {
            // Circle the player at distance — signature Bolo Tie move
            smooth = true;
            this.orbitAngle += d * 0.6 * dt;
            const orbitRadius = 100 + chaos(this.timer, this.seed) * 20;
            this._orbitPt.set(
              target.position.x + Math.cos(this.orbitAngle) * orbitRadius,
              target.position.y + Math.sin(this.timer * 0.3) * 25,
              target.position.z + Math.sin(this.orbitAngle) * orbitRadius,
            );
            const steer = steerToward(self, this._orbitPt, sensitivity * 1.0, 0.4);
            yaw = steer.yaw; pitch = steer.pitch;
            thrust = 0.7;
            // Fire while orbiting if aligned
            if (facing > this.cfg.fireCone && dist < engageRange * 1.5) {
              if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
            }
            break;
          }
          case 'break_turn':
            smooth = false;
            yaw = d * I * 0.7; pitch = -0.2 * I; thrust = 0.8;
            break;
          case 'climb_roll':
            smooth = false;
            if (t < this.phaseDuration * 0.5) {
              yaw = d * 0.15; pitch = -I * 0.7; thrust = 0.9;
            } else {
              yaw = d * I * 0.6; pitch = 0.1; thrust = 0.7;
            }
            break;
          case 'throttle_cut':
            smooth = false;
            if (t < this.phaseDuration * 0.4) {
              yaw = d * 0.2; pitch = 0; thrust = 0.1;
            } else {
              yaw = d * I * 0.5; pitch = -0.2 * I; thrust = 0.8;
            }
            break;
        }
        break;
      }
    }

    if (smooth) {
      yaw = yaw * 0.2 + this.prevYaw * 0.8; // extra smooth for lazy arcs
      pitch = pitch * 0.2 + this.prevPitch * 0.8;
    }
    this.prevYaw = yaw;
    this.prevPitch = pitch;
    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));
    return { yaw, pitch, roll: -yaw * 0.4, thrust, fire }; // less roll — gentler banking
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this.isCharging = false;
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;
    switch (phase) {
      case 'chase':     this.phaseDuration = 6; break; // longer chase — slower to react
      case 'evade': {
        this.phaseDuration = 6.0 + r * 4.0; // long lazy evades
        this.maneuverDir *= -1;
        // Heavily weighted toward wide_orbit — signature move
        const maneuvers: Maneuver[] = ['wide_orbit','wide_orbit','wide_orbit','wide_orbit','break_turn','climb_roll','throttle_cut'];
        const pick = Math.floor((chaos(this.timer * 5, this.seed) + 1) * 0.5 * maneuvers.length) % maneuvers.length;
        this.maneuver = maneuvers[pick];
        this.prevYaw = 0; this.prevPitch = 0;
        break;
      }
    }
  }
}
