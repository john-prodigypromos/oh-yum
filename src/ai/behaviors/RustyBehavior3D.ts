// ── Rusty AI Behavior (3D) ───────────────────────────────
// F-22 style BFM with organic feel: lead turns, lag pursuit,
// high yo-yos, defensive reversals. Difficulty-driven aggression,
// jink evasion, and engagement intensity.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

let enemyIndex = 0;

type Phase =
  | 'merge'         // closing to fight range
  | 'lead_turn'     // aggressive nose-on, cutting inside target's turn
  | 'lag_pursuit'   // trail behind target's velocity vector — guns setup
  | 'high_yo_yo'    // vertical reversal after overshoot — pull up, then dive
  | 'break_reversal'; // defensive break when caught out — short, sharp

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private timer = 0;
  private phase: Phase = 'merge';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private idx: number;
  private seed: number;
  private cfg: AIConfig;

  // Break direction: +1 = break right, -1 = break left
  private breakDir = 1;
  // Alternates between break_reversal and lag_pursuit after lead_turn
  private _lastBreak = false;
  // Vertical offset per enemy so they don't stack
  private verticalBias: number;
  // Yo-yo apex target
  private yoYoApex = new THREE.Vector3();

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _lagPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
    cfg: AIConfig,
  ) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this.idx = enemyIndex++;
    this.seed = this.idx * 2.17;
    this.timer = this.idx * 3;
    this.phaseTimer = this.idx * 1.5;
    this.breakDir = this.idx % 2 === 0 ? 1 : -1;
    this.verticalBias = (this.idx % 3 - 1) * 20;
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const { sensitivity, aggression, leashRange } = this.cfg;
    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._tmpVec.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — always steer back when beyond leash range ──
    if (distToPlayer > leashRange) {
      if (this.phase !== 'merge') this._setPhase('merge');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'merge':
        if (distToPlayer < leashRange * 0.5 && facingAlignment > 0.4) {
          this._setPhase('lead_turn');
        }
        break;

      case 'lead_turn':
        if (this.phaseTimer > this.phaseDuration) {
          if (this._lastBreak) {
            this._setPhase('lag_pursuit');
          } else {
            this.breakDir *= -1;
            this._setPhase('break_reversal');
          }
          this._lastBreak = !this._lastBreak;
        }
        // Overshoot → yo-yo
        if (this.phaseTimer > 0.4 && facingAlignment < -0.3 && distToPlayer < 80) {
          this._setupYoYo(self, target);
          this._setPhase('high_yo_yo');
        }
        break;

      case 'lag_pursuit':
        if (distToPlayer > leashRange * 0.7) {
          this._setPhase('lead_turn');
        }
        if (facingAlignment < -0.4 && distToPlayer < 50) {
          this.breakDir *= -1;
          this._setPhase('break_reversal');
        }
        if (this.phaseTimer > this.phaseDuration) {
          this.breakDir *= -1;
          this._setPhase('lead_turn');
        }
        break;

      case 'high_yo_yo':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('lag_pursuit');
        }
        break;

      case 'break_reversal':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('lead_turn');
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.phase) {
      case 'merge': {
        leadIntercept(
          self.position, target.position, target.velocity,
          100, this._interceptPt,
        );
        this._interceptPt.y += this.verticalBias + 15 * (this.idx % 2 === 0 ? 1 : -1);

        const steer = steerToward(self, this._interceptPt, sensitivity * 1.2, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = facingAlignment > 0 ? 0.9 : 0.2;

        if (distToPlayer < 120 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'lead_turn': {
        leadIntercept(
          self.position, target.position, target.velocity,
          110, this._interceptPt,
        );
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        const scissorOffset = chaos(this.timer, this.seed) * 35 * this.breakDir;
        this._interceptPt.addScaledVector(this._right, scissorOffset);
        this._interceptPt.y += Math.cos(this.timer * 1.2) * 15 + 15 * (this.idx % 2 === 0 ? 1 : -1);

        const steer = steerToward(self, this._interceptPt, sensitivity, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = this.phaseTimer < this.phaseDuration * 0.5 ? 1.0 : 0.8;

        if (distToPlayer < 120 && facingAlignment > 0.25) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }

      case 'lag_pursuit': {
        const playerFwd = target.getForward();
        this._lagPt.copy(target.position);
        this._lagPt.addScaledVector(playerFwd, -15);
        this._lagPt.y += this.verticalBias * 0.5;

        const steer = steerToward(self, this._lagPt, sensitivity * 1.1, 0.65);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = facingAlignment > 0.5 ? 1.0 : 0.85;

        if (distToPlayer < 100 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.45) fire = true;
        }
        break;
      }

      case 'high_yo_yo': {
        if (this.phaseTimer < this.phaseDuration * 0.5) {
          const steer = steerToward(self, this.yoYoApex, sensitivity * 0.8, 0.5);
          yaw = steer.yaw;
          pitch = steer.pitch;
          thrust = 0.5;
        } else {
          leadIntercept(
            self.position, target.position, target.velocity,
            90, this._interceptPt,
          );
          const steer = steerToward(self, this._interceptPt, sensitivity, 0.8);
          yaw = steer.yaw;
          pitch = steer.pitch;
          thrust = 0.9;
        }

        if (distToPlayer < 100 && facingAlignment > 0.35) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'break_reversal': {
        const steer = steerAway(self, target.position, sensitivity, 0.75, this.breakDir * 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        pitch += (this.idx % 2 === 0 ? -0.4 : 0.4);
        pitch = Math.max(-1, Math.min(1, pitch));

        if (distToPlayer < 80 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 1.2) fire = true;
        }
        break;
      }
    }

    // ── Jink evasion overlay — scaled by difficulty and phase ──
    const isAttacking = this.phase === 'lead_turn' || this.phase === 'lag_pursuit';
    const jinkScale = isAttacking ? 0.3 : 1.0; // less jink when aiming
    const jink = jinkOverlay(this.timer, this.seed, this.cfg.jinkIntensity * jinkScale);
    yaw += jink.yaw;
    pitch += jink.pitch;

    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));

    // ── Banking roll — fighter jets bank into turns ──
    const roll = -yaw * 0.6;

    return { yaw, pitch, roll, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;

    // Higher aggression = shorter phase durations (more rapid transitions)
    const aggrScale = 1 - this.cfg.aggression * 0.5;

    switch (phase) {
      case 'lead_turn':      this.phaseDuration = (0.7 + (chaos(this.timer, this.seed) + 1) * 0.4) * aggrScale; break;
      case 'lag_pursuit':    this.phaseDuration = (1.2 + (chaos(this.timer, this.seed) + 1) * 0.8) * aggrScale; break;
      case 'high_yo_yo':     this.phaseDuration = (0.6 + (chaos(this.timer, this.seed) + 1) * 0.2) * aggrScale; break;
      case 'break_reversal': this.phaseDuration = (0.3 + (chaos(this.timer, this.seed) + 1) * 0.2) * aggrScale; break;
      default:               this.phaseDuration = 3 * aggrScale; break;
    }
  }

  private _setupYoYo(self: Ship3D, target: Ship3D): void {
    this.yoYoApex.addVectors(self.position, target.position).multiplyScalar(0.5);
    this.yoYoApex.y += 35 + (this.idx % 2) * 10;
  }
}
