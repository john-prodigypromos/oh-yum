// ── Rusty AI Behavior (3D) ───────────────────────────────
// Enemy hovers in front of the player with unique sway patterns.
// Each enemy gets a different orbit offset so they spread out.
// Fires lasers back at the player.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';

let enemyIndex = 0; // unique ID per enemy instance

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private swayTimer: number;
  private swaySpeedX: number;
  private swaySpeedY: number;
  private orbitOffset: number;    // unique angle offset so enemies spread out
  private spreadRadius: number;   // how far from center this enemy orbits

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.swayTimer = Math.random() * Math.PI * 2;
    this.swaySpeedX = 1.5 + Math.random() * 1.0;
    this.swaySpeedY = 1.0 + Math.random() * 0.8;

    // Each enemy gets a unique spread position
    const idx = enemyIndex++;
    this.orbitOffset = (idx / 3) * Math.PI * 2; // evenly distributed around circle
    this.spreadRadius = 12 + idx * 6; // each further out
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.swayTimer += dt;

    // Base position: ahead of player
    const playerForward = target.getForward();
    const baseX = target.position.x + playerForward.x * 35;
    const baseY = target.position.y + playerForward.y * 35;
    const baseZ = target.position.z + playerForward.z * 35;

    // Unique offset per enemy — spread them apart using different orbit paths
    const swayX = Math.sin(this.swayTimer * this.swaySpeedX + this.orbitOffset) * this.spreadRadius;
    const swayY = Math.sin(this.swayTimer * this.swaySpeedY + this.orbitOffset * 1.5) * 6;
    const swayZ = Math.cos(this.swayTimer * this.swaySpeedX * 0.8 + this.orbitOffset) * this.spreadRadius * 0.5;

    const desiredX = baseX + swayX;
    const desiredY = baseY + swayY;
    const desiredZ = baseZ + swayZ;

    // Smooth move to position
    const lerpRate = Math.min(1, dt * 3);
    self.position.x += (desiredX - self.position.x) * lerpRate;
    self.position.y += (desiredY - self.position.y) * lerpRate;
    self.position.z += (desiredZ - self.position.z) * lerpRate;

    // Always face the player
    const lookMat = new THREE.Matrix4();
    lookMat.lookAt(self.position, target.position, new THREE.Vector3(0, 1, 0));
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
    self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 5));

    // Fire lasers at the player
    let fire = false;
    if (now - self.lastFireTime >= this.fireRate) {
      fire = true;
    }

    return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
  }
}
