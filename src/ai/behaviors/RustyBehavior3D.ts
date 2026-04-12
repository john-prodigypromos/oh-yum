// ── Rusty AI Behavior (3D) ───────────────────────────────
// F-22 style BFM with organic feel: lead turns, lag pursuit,
// high yo-yos, defensive reversals. Tight engagement envelope,
// chaotic offsets, jinking micro-corrections, thrust stepping.
// Scrappy and relentless — a persistent pest.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
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
  private phaseDuration = 0; // randomized per phase entry
  private idx: number;
  private seed: number;

  // Break direction: +1 = break right, -1 = break left
  private breakDir = 1;
  // Vertical offset per enemy so they don't stack
  private verticalBias: number;
  // Yo-yo apex target
  private yoYoApex = new THREE.Vector3();
  // Snap impulse on phase transitions
  private _snapImpulse = 0;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _lagPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();
  private _right = new THREE.Vector3();

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.idx = enemyIndex++;
    this.seed = this.idx * 2.17; // irrational multiplier prevents phase-locking
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

    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._tmpVec.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — never drift beyond 130 units ──
    if (distToPlayer > 130 && this.phase !== 'merge') {
      this._setPhase('merge');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'merge':
        if (distToPlayer < 65 && facingAlignment > 0.4) {
          this._setPhase('lead_turn');
        }
        if (this.phaseTimer > 5) {
          this._setPhase('lead_turn');
        }
        break;

      case 'lead_turn':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('lag_pursuit');
        }
        // Overshoot → yo-yo
        if (this.phaseTimer > 0.6 && facingAlignment < -0.4 && distToPlayer < 70) {
          this._setupYoYo(self, target);
          this._setPhase('high_yo_yo');
        }
        break;

      case 'lag_pursuit':
        if (distToPlayer > 90) {
          this._setPhase('lead_turn');
        }
        // Head-on merge → break reversal
        if (facingAlignment < -0.6 && distToPlayer < 40) {
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

        const steer = steerToward(self, this._interceptPt, 3.0, 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 0.85; // constant aggressive approach

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

        const steer = steerToward(self, this._interceptPt, 4.0, 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Thrust stepping: aggressive first half, moderate second half
        thrust = this.phaseTimer < this.phaseDuration * 0.5 ? 0.95 : 0.7;

        if (distToPlayer < 120 && facingAlignment > 0.25) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }

      case 'lag_pursuit': {
        const playerFwd = target.getForward();
        this._lagPt.copy(target.position);
        this._lagPt.addScaledVector(playerFwd, -15); // tight on the tail
        this._lagPt.y += this.verticalBias * 0.5;

        const steer = steerToward(self, this._lagPt, 3.5, 0.55);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Thrust stepping: burst when on target's tail
        thrust = facingAlignment > 0.6 ? 1.0 : 0.75;

        // Prime firing position — fire aggressively
        if (distToPlayer < 100 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.45) fire = true;
        }
        break;
      }

      case 'high_yo_yo': {
        if (this.phaseTimer < this.phaseDuration * 0.5) {
          const steer = steerToward(self, this.yoYoApex, 3.5, 0.5);
          yaw = steer.yaw;
          pitch = steer.pitch;
          thrust = 0.5; // bleeding speed intentionally
        } else {
          leadIntercept(
            self.position, target.position, target.velocity,
            90, this._interceptPt,
          );
          const steer = steerToward(self, this._interceptPt, 3.5, 0.8);
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
        const steer = steerAway(self, target.position, 4.0, 0.6, this.breakDir * 0.8);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        pitch += (this.idx % 2 === 0 ? -0.4 : 0.4);
        pitch = Math.max(-1, Math.min(1, pitch));

        // Snap shots while breaking
        if (distToPlayer < 80 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 1.2) fire = true;
        }
        break;
      }
    }

    // ── Snap impulse on phase transitions ──
    if (this._snapImpulse !== 0) {
      yaw += this._snapImpulse;
      this._snapImpulse = 0;
    }

    // ── Jink overlay — scrappy, erratic ──
    const jink = jinkOverlay(this.timer, this.seed, 0.6);
    yaw = Math.max(-1, Math.min(1, yaw + jink.yaw));
    pitch = Math.max(-1, Math.min(1, pitch + jink.pitch));

    return { yaw, pitch, roll: 0, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;
    this._snapImpulse = 0.4 * this.breakDir;

    // Randomize duration per phase using chaos
    switch (phase) {
      case 'lead_turn':    this.phaseDuration = 1.2 + (chaos(this.timer, this.seed) + 1) * 0.6; break; // 1.2-2.4s
      case 'lag_pursuit':  this.phaseDuration = 3.0 + (chaos(this.timer, this.seed) + 1) * 1.5; break; // 3.0-6.0s
      case 'high_yo_yo':   this.phaseDuration = 0.9 + (chaos(this.timer, this.seed) + 1) * 0.3; break; // 0.9-1.5s
      case 'break_reversal': this.phaseDuration = 0.5 + (chaos(this.timer, this.seed) + 1) * 0.25; break; // 0.5-1.0s
      default:             this.phaseDuration = 5; break;
    }
  }

  private _setupYoYo(self: Ship3D, target: Ship3D): void {
    this.yoYoApex.addVectors(self.position, target.position).multiplyScalar(0.5);
    this.yoYoApex.y += 35 + (this.idx % 2) * 10;
  }
}
