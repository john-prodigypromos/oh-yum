// ── Rusty AI (Grunt Dogfighter) ──────────────────────────
// Top Gun dogfighter: actively tries to get behind the player,
// stays on their six and fires, breaks when spotted, repositions.
// Maneuvers are for REPOSITIONING, not just random evasion.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos } from '../Steering';

let enemyIndex = 0;

type Phase = 'chase' | 'evade' | 'flank' | 'tail';
type Maneuver = 'break_turn' | 'dive_pull' | 'climb_roll' | 'split_s' | 'scissors' | 'throttle_cut';

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private cfg: AIConfig;
  private phase: Phase = 'chase';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private idx: number;
  private seed: number;

  private maneuver: Maneuver = 'break_turn';
  private maneuverDir = 1;

  private prevYaw = 0;
  private prevPitch = 0;

  private _interceptPt = new THREE.Vector3();
  private _tmpVec = new THREE.Vector3();
  private _sixPos = new THREE.Vector3();
  private _rightVec = new THREE.Vector3();

  constructor(_aimAccuracy: number, fireRate: number, _chaseRange: number, cfg: AIConfig) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this.idx = enemyIndex++;
    this.seed = this.idx * 2.17;
    this.timer = this.idx * 2.5;
    this.phaseTimer = this.idx * 0.8;
    this.maneuverDir = this.idx % 2 === 0 ? 1 : -1;
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
    const facing = forward.dot(toPlayer); // >0 = pointing at player
    const engageRange = leashRange * 0.7;

    // ── Positional awareness — is the enemy behind the player? ──
    const playerFwd = target.getForward();
    // Positive = enemy in front of player (visible), negative = behind (on six)
    const enemyAhead = -(playerFwd.dot(toPlayer));

    // Force chase if too far
    if (dist > leashRange && this.phase !== 'chase') this._setPhase('chase');

    // ── Phase transitions ──
    switch (this.phase) {
      case 'chase':
        if (dist < engageRange) {
          if (enemyAhead < -0.3) {
            // Already behind the player — go for the kill
            this._setPhase('tail');
          } else {
            // Close enough — flank to get behind
            this._setPhase('flank');
          }
        }
        break;

      case 'flank':
        if (enemyAhead < -0.25 && dist < 80) {
          // Got behind the player — attack!
          this._setPhase('tail');
        } else if (this.phaseTimer > this.phaseDuration) {
          // Flanking took too long, evade and retry
          this._setPhase('evade');
        }
        break;

      case 'tail':
        if (enemyAhead > 0.5) {
          // Player turned to face us solidly — break!
          this._setPhase('evade');
        } else if (this.phaseTimer > this.phaseDuration) {
          // Break off before becoming predictable
          this._setPhase('evade');
        }
        break;

      case 'evade':
        if (this.phaseTimer > this.phaseDuration) {
          if (enemyAhead < -0.1) {
            // Ended up behind player after evading — capitalize
            this._setPhase('tail');
          } else {
            // Reposition to get behind
            this._setPhase('flank');
          }
        }
        break;
    }

    // ── Phase behaviors ──
    let yaw = 0, pitch = 0, thrust = 0.7, fire = false;
    let smooth = true;

    switch (this.phase) {
      case 'chase': {
        leadIntercept(self.position, target.position, target.velocity, 100, this._interceptPt);
        this._interceptPt.y += (this.idx % 3 - 1) * 15;
        const steer = steerToward(self, this._interceptPt, sensitivity * 1.2, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = facing > 0.3 ? 1.0 : 0.5;
        // Opportunistic fire while closing
        if (dist < engageRange * 1.3 && facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'flank': {
        // Circle around to get behind the player
        // Target: a point behind and to the side of the player
        this._sixPos.copy(target.position).addScaledVector(playerFwd, -65);
        // Lateral offset — approach from the side, not straight behind
        this._rightVec.set(-playerFwd.z, 0, playerFwd.x).normalize();
        this._sixPos.addScaledVector(this._rightVec, this.maneuverDir * 35);
        // Altitude variation based on personality
        this._sixPos.y += (this.idx % 3 - 1) * 20;

        const steer = steerToward(self, this._sixPos, sensitivity * 1.3, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // full speed to reposition

        // Aggressive snap-fire during the flank — fire whenever briefly aligned
        if (facing > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.7) fire = true;
        }
        break;
      }

      case 'tail': {
        // Stay on the player's six — follow behind and fire
        // Target: a point directly behind the player at combat distance
        const followDist = 70 + (this.idx % 3) * 15; // 70-100 units behind
        this._sixPos.copy(target.position).addScaledVector(playerFwd, -followDist);
        // Small lateral jink so we're harder to predict
        const jink = chaos(this.timer, this.seed) * 12;
        this._rightVec.set(-playerFwd.z, 0, playerFwd.x).normalize();
        this._sixPos.addScaledVector(this._rightVec, jink);
        // Match player's altitude with slight offset
        this._sixPos.y += chaos(this.timer * 0.7, this.seed + 3) * 8;

        const steer = steerToward(self, this._sixPos, sensitivity * 1.0, 0.4);
        yaw = steer.yaw;
        pitch = steer.pitch;

        // Throttle management — close gap or maintain distance
        thrust = dist > 100 ? 1.0 : dist < 50 ? 0.15 : 0.5;

        // Aggressive firing when on the six — wider cone, faster rate
        if (facing > this.cfg.fireCone * 0.6) {
          if (now - self.lastFireTime >= this.fireRate * 0.3) fire = true;
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
            yaw = d * I;
            pitch = -0.3 * I;
            thrust = 1.0;
            break;

          case 'dive_pull':
            if (t < this.phaseDuration * 0.45) {
              yaw = d * 0.2;
              pitch = 0.9 * I;
              thrust = 1.0;
            } else {
              yaw = d * 0.5;
              pitch = -0.9 * I;
              thrust = 0.8;
            }
            break;

          case 'climb_roll':
            // Immelmann — climb then break hard to reposition
            if (t < this.phaseDuration * 0.4) {
              yaw = d * 0.15;
              pitch = -I;
              thrust = 1.0;
            } else {
              yaw = d * I;
              pitch = 0.2;
              thrust = 0.9;
            }
            break;

          case 'split_s':
            if (t < this.phaseDuration * 0.3) {
              yaw = 0;
              pitch = 0.8 * I;
              thrust = 0.6;
            } else {
              yaw = d * 0.4;
              pitch = -0.7 * I;
              thrust = 1.0;
            }
            break;

          case 'scissors':
            const scissorPeriod = 1.6;
            const scissorPhase = Math.floor(t / scissorPeriod) % 2;
            yaw = scissorPhase === 0 ? d * I : -d * I;
            pitch = (scissorPhase === 0 ? -0.3 : 0.3) * I;
            thrust = 0.7;
            break;

          case 'throttle_cut':
            if (t < this.phaseDuration * 0.35) {
              yaw = d * 0.3;
              pitch = 0;
              thrust = 0;
            } else {
              yaw = d * I;
              pitch = -0.4 * I;
              thrust = 1.0;
            }
            break;
        }

        // Opportunistic fire during evasion — fire at normal rate when aligned
        if (facing > this.cfg.fireCone + 0.1) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }
    }

    // ── Smoothing (prevents jerky transitions) ──
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
    const r = (chaos(this.timer, this.seed) + 1) * 0.5;

    switch (phase) {
      case 'chase':     this.phaseDuration = 2; break;              // brief chase
      case 'flank':     this.phaseDuration = 4 + r * 2; break;     // 4-6s flanking at distance
      case 'tail':      this.phaseDuration = 4 + r * 3; break;     // 4-7s on the six — committed pursuit
      case 'evade': {
        this.phaseDuration = 3.0 + r * 2.0; // 3-5s short evasion — get back on the offense fast
        this.maneuverDir *= -1;

        // Pick maneuver — weighted toward repositioning moves
        const maneuvers: Maneuver[] = [
          'break_turn',               // 1x — reduced
          'dive_pull', 'dive_pull',   // 2x — altitude change repositioning
          'climb_roll', 'climb_roll', // 2x — Immelmann repositioning
          'split_s', 'split_s',       // 2x — reverse direction
          'scissors',                 // 1x — close-range
          'throttle_cut',             // 1x — speed trap
        ];
        const pick = Math.floor((chaos(this.timer * 5, this.seed) + 1) * 0.5 * maneuvers.length) % maneuvers.length;
        this.maneuver = maneuvers[pick];

        this.prevYaw = 0;
        this.prevPitch = 0;
        break;
      }
    }
  }
}
