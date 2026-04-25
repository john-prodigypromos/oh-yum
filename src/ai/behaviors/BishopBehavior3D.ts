// ── Bishop Boss AI (Level 3) ─────────────────────────────
// "The Ghost" — erratic, unpredictable. Rapid direction changes,
// feints, sudden speed shifts. Chaos jinking layered on everything.
// Corkscrew spirals + HP-gated escalation + drones.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type Phase = 'chase' | 'evade';
type BossPhase = 'phase1' | 'phase2' | 'phase3';
type Maneuver = 'corkscrew' | 'feint' | 'snap_turn' | 'dive_pull' | 'scissors' | 'throttle_cut';

export class BishopBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private seed = 7.19;
  private bossPhase: BossPhase = 'phase1';
  private maneuver: Maneuver = 'corkscrew';
  private maneuverDir = 1;
  private prevYaw = 0;
  private prevPitch = 0;

  dronesRequested = 0;
  droneRespawnTimer = 0;
  readonly DRONE_RESPAWN_DELAY = 15;

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
    const hpPct = self.hull / self.maxHull;
    const dist = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._tmpVec.subVectors(target.position, self.position).normalize();
    const facing = forward.dot(toPlayer);
    const engageRange = leashRange * 0.7; // break off earlier

    if (hpPct <= 0.2 && this.bossPhase !== 'phase3') this.bossPhase = 'phase3';
    else if (hpPct <= 0.5 && this.bossPhase === 'phase1') {
      this.bossPhase = 'phase2';
      this.dronesRequested = 2;
    }
    if (this.bossPhase === 'phase2') this.droneRespawnTimer += dt;

    const phaseSens = this.bossPhase === 'phase3' ? sensitivity * 1.8
      : this.bossPhase === 'phase2' ? sensitivity * 1.4 : sensitivity;
    const fireRateMult = this.bossPhase === 'phase3' ? 0.2
      : this.bossPhase === 'phase2' ? 0.4 : 0.6;
    // Escalating jink intensity — gets more erratic as HP drops
    const jinkStr = this.bossPhase === 'phase3' ? 0.7
      : this.bossPhase === 'phase2' ? 0.4 : 0.2;

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
        // Erratic pursuit — jinking overlay makes it hard to track
        leadIntercept(self.position, target.position, target.velocity, 110, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, phaseSens * 1.3, 0.5);
        yaw = steer.yaw; pitch = steer.pitch;
        thrust = facing > 0.3 ? 1.0 : 0.5;

        // Layer chaos jinking on top of pursuit — signature ghost behavior
        const jink = jinkOverlay(this.timer, this.seed, jinkStr);
        yaw += jink.yaw;
        pitch += jink.pitch;

        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * fireRateMult) fire = true;
        }
        break;
      }
      case 'evade': {
        const t = this.phaseTimer;
        const d = this.maneuverDir;
        const I = 0.8 + this.cfg.aggression * 0.2;

        switch (this.maneuver) {
          case 'corkscrew': {
            // Signature Bishop move — spiraling evasion, very hard to hit
            smooth = false;
            const spiralRate = 4.0 + this.timer * 0.5; // accelerating spiral
            yaw = Math.sin(t * spiralRate) * I * 0.8;
            pitch = Math.cos(t * spiralRate) * I * 0.6;
            thrust = 0.9;
            // Occasional shots during spiral if aligned
            if (facing > this.cfg.fireCone && dist < engageRange) {
              if (now - self.lastFireTime >= this.fireRate * fireRateMult) fire = true;
            }
            break;
          }
          case 'feint': {
            // Fake one direction, then snap the other way
            smooth = false;
            const feintEnd = this.phaseDuration * 0.3;
            if (t < feintEnd) {
              // Commit to one direction
              yaw = d * I; pitch = -0.3 * I; thrust = 1.0;
            } else {
              // Snap reverse — hard opposite
              yaw = -d * I; pitch = 0.4 * I; thrust = 0.8;
            }
            break;
          }
          case 'snap_turn': {
            // Rapid alternating sharp turns — very jerky and unpredictable
            smooth = false;
            const snapPeriod = 0.8 + chaos(this.timer, this.seed) * 0.4;
            const snapPhase = Math.floor(t / snapPeriod) % 3;
            if (snapPhase === 0) {
              yaw = d * I; pitch = -0.5 * I; thrust = 1.0;
            } else if (snapPhase === 1) {
              yaw = -d * I * 0.7; pitch = 0.6 * I; thrust = 0.6;
            } else {
              yaw = 0; pitch = -I; thrust = 1.0;
            }
            break;
          }
          case 'dive_pull':
            smooth = false;
            if (t < this.phaseDuration * 0.4) {
              yaw = d * 0.2; pitch = I; thrust = 1.0;
            } else {
              yaw = -d * 0.5; pitch = -I; thrust = 0.9;
            }
            break;
          case 'scissors': {
            smooth = false;
            // Fast scissors — shorter period than other bosses
            const sp = Math.floor(t / 0.9) % 2;
            yaw = sp === 0 ? d * I : -d * I;
            pitch = (sp === 0 ? -0.4 : 0.4) * I;
            thrust = 0.8;
            break;
          }
          case 'throttle_cut': {
            // Sudden stop then burst in unexpected direction
            smooth = false;
            if (t < this.phaseDuration * 0.25) {
              yaw = 0; pitch = 0; thrust = 0; // dead stop
            } else if (t < this.phaseDuration * 0.35) {
              // Pause — floating, unpredictable
              yaw = d * 0.1; pitch = chaos(this.timer * 3, this.seed) * 0.3; thrust = 0.05;
            } else {
              // Burst in unexpected direction
              yaw = -d * I; pitch = (chaos(this.timer * 7, this.seed)) * I; thrust = 1.0;
            }
            break;
          }
        }

        // Always layer jink on evade maneuvers for extra unpredictability
        const jink = jinkOverlay(this.timer, this.seed, jinkStr * 0.5);
        yaw += jink.yaw;
        pitch += jink.pitch;
        break;
      }
    }

    if (smooth) {
      yaw = yaw * 0.35 + this.prevYaw * 0.65;
      pitch = pitch * 0.35 + this.prevPitch * 0.65;
    }
    this.prevYaw = yaw;
    this.prevPitch = pitch;
    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));
    return { yaw, pitch, roll: -yaw * 0.8, thrust, fire }; // heavy roll — erratic feel
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    const berserk = this.bossPhase === 'phase3' ? 0.5 : 1;
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;
    switch (phase) {
      case 'chase':     this.phaseDuration = 2; break; // very brief chase — constantly shifting
      case 'evade': {
        this.phaseDuration = (3.5 + r * 2.0) * berserk; // 3.5-5.5s × berserk — relentless re-engagement
        this.maneuverDir *= -1;
        // Ghost maneuvers — corkscrew, feints, snap turns
        const maneuvers: Maneuver[] = ['corkscrew','corkscrew','corkscrew','feint','feint','snap_turn','snap_turn','dive_pull','scissors','throttle_cut'];
        const pick = Math.floor((chaos(this.timer * 5, this.seed) + 1) * 0.5 * maneuvers.length) % maneuvers.length;
        this.maneuver = maneuvers[pick];
        this.prevYaw = 0; this.prevPitch = 0;
        break;
      }
    }
  }
}
