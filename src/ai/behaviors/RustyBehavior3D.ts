// ── Rusty AI Behavior (3D) ───────────────────────────────
// Chase → face → fire pattern in 3D space.
// Uses separate yaw and pitch to track target.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class RustyBehavior3D implements AIBehavior3D {
  private aimAccuracy: number;
  private fireRate: number;
  private chaseRange: number;

  constructor(
    aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.aimAccuracy = aimAccuracy;
    this.fireRate = fireRate;
    this.chaseRange = chaseRange;
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    // Direction to target
    _toTarget.subVectors(target.position, self.position);
    const distance = _toTarget.length();
    if (distance < 0.1) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }
    _toTarget.normalize();

    // Current forward direction
    _forward.set(0, 0, 1).applyQuaternion(self.group.quaternion);

    // Calculate angle difference using cross product components
    // Cross product gives us the axis to rotate around
    const cross = new THREE.Vector3().crossVectors(_forward, _toTarget);
    const dot = _forward.dot(_toTarget);
    const angleDiff = Math.acos(Math.min(1, Math.max(-1, dot)));

    // Decompose cross product into yaw (Y-axis) and pitch (X-axis) components
    // in local space
    const localCross = cross.clone().applyQuaternion(self.group.quaternion.clone().invert());

    let yaw = 0;
    let pitch = 0;
    let thrust = 0;

    // Steering — proportional control with accuracy noise
    const steerStrength = Math.min(1, angleDiff * 2); // stronger correction when far off
    const noise = (Math.random() - 0.5) * (1 - this.aimAccuracy) * 2;

    if (Math.abs(localCross.y) > 0.05) {
      yaw = Math.sign(localCross.y) * steerStrength + noise * 0.3;
      yaw = Math.max(-1, Math.min(1, yaw));
    }

    if (Math.abs(localCross.x) > 0.05) {
      pitch = -Math.sign(localCross.x) * steerStrength * 0.7 + noise * 0.2;
      pitch = Math.max(-1, Math.min(1, pitch));
    }

    // Thrust — aggressively close distance, stay in dogfight range
    if (distance > 15 && angleDiff < Math.PI * 0.7) {
      thrust = 1;
    } else if (distance < 8) {
      thrust = -0.3;
    } else {
      thrust = 0.5; // always creeping closer
    }

    // Fire — when roughly aimed at target and within chase range
    let fire = false;
    if (angleDiff < 0.3 * (1 + (1 - this.aimAccuracy)) && distance < this.chaseRange) {
      if (now - self.lastFireTime >= this.fireRate) {
        fire = true;
      }
    }

    return { yaw, pitch, roll: 0, thrust, fire };
  }
}
