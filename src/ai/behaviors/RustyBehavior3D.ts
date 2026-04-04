// ── Rusty AI Behavior (3D) ───────────────────────────────
// Enemy aggressively chases the player, swooping in close
// for attack runs then pulling away briefly before diving again.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import { AI } from '../../config';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';

let enemyIndex = 0;

type AIPhase = 'attack' | 'strafe' | 'dive';

export class RustyBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private timer = 0;
  private phase: AIPhase = 'attack';
  private phaseTimer = 0;
  private idx: number;
  private strafeDir = 1;

  constructor(
    _aimAccuracy: number = AI.RUSTY_AIM_ACCURACY,
    fireRate: number = AI.RUSTY_FIRE_RATE,
    _chaseRange: number = AI.RUSTY_CHASE_RANGE,
  ) {
    this.fireRate = fireRate;
    this.idx = enemyIndex++;
    this.timer = this.idx * 2; // offset each enemy's timing
    this.strafeDir = this.idx % 2 === 0 ? 1 : -1;
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    // Phase transitions — cycle through attack patterns
    if (this.phase === 'attack' && this.phaseTimer > 3) {
      this.phase = 'strafe';
      this.phaseTimer = 0;
      this.strafeDir *= -1;
    } else if (this.phase === 'strafe' && this.phaseTimer > 2) {
      this.phase = 'dive';
      this.phaseTimer = 0;
    } else if (this.phase === 'dive' && this.phaseTimer > 2) {
      this.phase = 'attack';
      this.phaseTimer = 0;
    }

    const playerForward = target.getForward();
    let desiredX = 0, desiredY = 0, desiredZ = 0;

    // Unique offset per enemy so they don't overlap
    const spread = (this.idx - 1) * 15;

    if (this.phase === 'attack') {
      // Fly directly at the player from in front, closing distance
      const dist = 30 - this.phaseTimer * 5; // gets closer over time
      desiredX = target.position.x + playerForward.x * Math.max(12, dist) + spread;
      desiredY = target.position.y + playerForward.y * Math.max(12, dist) + Math.sin(this.timer * 2) * 3;
      desiredZ = target.position.z + playerForward.z * Math.max(12, dist);
    } else if (this.phase === 'strafe') {
      // Fast side-to-side strafing at medium range
      const strafeAmount = Math.sin(this.timer * 3) * 20 * this.strafeDir;
      desiredX = target.position.x + playerForward.x * 25 + strafeAmount + spread;
      desiredY = target.position.y + playerForward.y * 25 + Math.cos(this.timer * 2) * 5;
      desiredZ = target.position.z + playerForward.z * 25;
    } else {
      // Dive: sweep across the player's view diagonally
      const t = this.phaseTimer / 2;
      const sweepX = (t - 0.5) * 40 * this.strafeDir;
      const sweepY = Math.sin(t * Math.PI) * 10;
      desiredX = target.position.x + playerForward.x * 20 + sweepX + spread;
      desiredY = target.position.y + playerForward.y * 20 + sweepY;
      desiredZ = target.position.z + playerForward.z * 20;
    }

    // Move toward desired position aggressively
    const lerpRate = Math.min(1, dt * 5);
    self.position.x += (desiredX - self.position.x) * lerpRate;
    self.position.y += (desiredY - self.position.y) * lerpRate;
    self.position.z += (desiredZ - self.position.z) * lerpRate;

    // Always face the player
    const lookMat = new THREE.Matrix4();
    lookMat.lookAt(self.position, target.position, new THREE.Vector3(0, 1, 0));
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
    self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 8));

    // Fire constantly
    let fire = false;
    if (now - self.lastFireTime >= this.fireRate) {
      fire = true;
    }

    return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
  }
}
