// ── Rusty AI Behavior (3D) ───────────────────────────────
// Enemy hovers DIRECTLY in front of the player, swaying gently.
// Always visible. Like a target that shoots back.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private swayTimer: number;
  private swaySpeedX: number;
  private swaySpeedY: number;

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.swayTimer = Math.random() * Math.PI * 2;
    this.swaySpeedX = 0.7 + Math.random() * 0.4;
    this.swaySpeedY = 0.5 + Math.random() * 0.3;
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.swayTimer += dt;

    // Position: always 15 units ahead of where the player is looking
    const playerForward = target.getForward();
    const desiredX = target.position.x + playerForward.x * 15 + Math.sin(this.swayTimer * this.swaySpeedX) * 6;
    const desiredY = target.position.y + playerForward.y * 15 + Math.sin(this.swayTimer * this.swaySpeedY) * 3;
    const desiredZ = target.position.z + playerForward.z * 15 + Math.cos(this.swayTimer * this.swaySpeedX) * 6;

    // Snap to position
    const lerpRate = Math.min(1, dt * 4);
    self.position.x += (desiredX - self.position.x) * lerpRate;
    self.position.y += (desiredY - self.position.y) * lerpRate;
    self.position.z += (desiredZ - self.position.z) * lerpRate;

    // Always face the player
    const lookMat = new THREE.Matrix4();
    lookMat.lookAt(self.position, target.position, new THREE.Vector3(0, 1, 0));
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
    self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 5));

    // Fire periodically
    let fire = false;
    if (now - self.lastFireTime >= this.fireRate) {
      fire = true;
    }

    return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
  }
}
