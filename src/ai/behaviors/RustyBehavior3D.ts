// ── Rusty AI Behavior (3D) ───────────────────────────────
// Enemy orbits in front of the player at close range.
// Simple, predictable, always visible.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';

const _toPlayer = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private orbitAngle: number;
  private orbitSpeed: number;
  private orbitDist = 15; // very close orbit — always in your face

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitSpeed = 0.08 + Math.random() * 0.07; // very slow orbit — easy to track
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    // Orbit around the player
    this.orbitAngle += this.orbitSpeed * dt;

    // Desired position: orbit around player in the XZ plane
    const desiredX = target.position.x + Math.cos(this.orbitAngle) * this.orbitDist;
    const desiredY = target.position.y + Math.sin(this.orbitAngle * 0.5) * 5;
    const desiredZ = target.position.z + Math.sin(this.orbitAngle) * this.orbitDist;

    // Move toward desired position directly (override physics for reliability)
    // Snap toward orbit position — fast lerp keeps them locked in view
    const lerpRate = Math.min(1, dt * 3);
    self.position.x += (desiredX - self.position.x) * lerpRate;
    self.position.y += (desiredY - self.position.y) * lerpRate;
    self.position.z += (desiredZ - self.position.z) * lerpRate;

    // Always face the player
    _toPlayer.subVectors(target.position, self.position).normalize();
    if (_toPlayer.length() > 0.01) {
      const lookQuat = new THREE.Quaternion();
      const lookMat = new THREE.Matrix4();
      lookMat.lookAt(self.position, target.position, new THREE.Vector3(0, 1, 0));
      lookQuat.setFromRotationMatrix(lookMat);
      self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 5));
    }

    // Fire periodically when alive
    let fire = false;
    if (now - self.lastFireTime >= this.fireRate) {
      fire = true;
    }

    // Return zero input — we moved the ship directly above
    return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
  }
}
