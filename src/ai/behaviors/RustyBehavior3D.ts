// ── Rusty AI Behavior (3D) ───────────────────────────────
// Modern jet-fighter AI: boom-and-zoom attack runs with
// banking turns, lead pursuit, and constant forward motion.
// Enemies never stall — they always fly at speed.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept } from '../Steering';

let enemyIndex = 0;

type Phase = 'intercept' | 'attack_run' | 'break_turn' | 'extend';

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private timer = 0;
  private phase: Phase = 'intercept';
  private phaseTimer = 0;
  private idx: number;

  // Break-turn direction: +1 = break right, -1 = break left
  private breakDir = 1;
  // Vertical offset per enemy so they don't stack
  private verticalBias: number;

  // Pre-allocated temp vectors
  private _interceptPt = new THREE.Vector3();
  private _waypoint = new THREE.Vector3();

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.idx = enemyIndex++;
    this.timer = this.idx * 4; // stagger timing so enemies don't sync
    this.phaseTimer = this.idx * 2; // stagger initial approach
    this.breakDir = this.idx % 2 === 0 ? 1 : -1;
    this.verticalBias = (this.idx % 3 - 1) * 30; // -30, 0, +30
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    // How well aligned we are with the player (1 = facing them, -1 = facing away)
    const toPlayer = new THREE.Vector3().subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Phase transitions ──
    switch (this.phase) {
      case 'intercept':
        // Transition to attack run when close and roughly facing the target
        if (distToPlayer < 160 && facingAlignment > 0.6) {
          this.phase = 'attack_run';
          this.phaseTimer = 0;
        }
        // Safety: if we somehow got past the player without attacking, reset
        if (this.phaseTimer > 12) {
          this.phase = 'attack_run';
          this.phaseTimer = 0;
        }
        break;

      case 'attack_run':
        // Break off after passing or after time limit
        if (this.phaseTimer > 2.5 || (this.phaseTimer > 0.8 && facingAlignment < -0.2)) {
          this.phase = 'break_turn';
          this.phaseTimer = 0;
          this.breakDir *= -1; // alternate break direction each pass
        }
        break;

      case 'break_turn':
        // Hard turn for 1.5-2s, then extend
        if (this.phaseTimer > 1.8) {
          this.phase = 'extend';
          this.phaseTimer = 0;
        }
        break;

      case 'extend':
        // Fly away until far enough, then loop back for another pass
        if (distToPlayer > 200 || this.phaseTimer > 3) {
          this.phase = 'intercept';
          this.phaseTimer = 0;
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.7;
    let fire = false;

    switch (this.phase) {
      case 'intercept': {
        // Lead-pursuit: aim where the player WILL be
        leadIntercept(
          self.position, target.position, target.velocity,
          60, // approximate closing speed
          this._interceptPt,
        );
        // Add vertical bias so enemies approach from different angles
        this._interceptPt.y += this.verticalBias;

        const steer = steerToward(self, this._interceptPt, 2.5, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        // Start firing when close and well-aligned
        if (distToPlayer < 200 && facingAlignment > 0.7) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }

      case 'attack_run': {
        // Fly through the target zone — slight lead corrections, full thrust
        leadIntercept(
          self.position, target.position, target.velocity,
          80,
          this._interceptPt,
        );
        const steer = steerToward(self, this._interceptPt, 1.5, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // full afterburner during attack pass

        // Fire aggressively during the pass
        if (distToPlayer < 250 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate * 0.7) fire = true;
        }
        break;
      }

      case 'break_turn': {
        // Hard banking turn away from the player
        const steer = steerAway(self, target.position, 3.5, 0.6, this.breakDir * 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        // Add some vertical pull during the break for a more dramatic maneuver
        pitch += (this.idx % 2 === 0 ? -0.3 : 0.3);
        pitch = Math.max(-1, Math.min(1, pitch));
        break;
      }

      case 'extend': {
        // Continue flying away — maintain heading, moderate thrust
        const steer = steerAway(self, target.position, 1.5, 0.5, this.breakDir * 0.3);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }
    }

    return { yaw, pitch, roll: 0, thrust, fire };
  }
}
