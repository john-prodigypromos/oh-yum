// ── Bow Tie Boss AI (Level 2) ────────────────────────────
// Ghost: hit-and-run from the fog, fast, lower HP.
// Dives in from fog, fires a burst, retreats at speed.
// Uses physics-based steering — never stalls.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept } from '../Steering';

type Phase = 'hidden' | 'approach' | 'attack' | 'retreat';

export class BowTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'hidden';
  private phaseTimer = 0;
  private timer = 0;
  private breakDir = 1;

  // Fog visibility range — enemies beyond this are "hidden"
  private readonly FOG_RANGE = 180;

  private _interceptPt = new THREE.Vector3();
  private _retreatPt = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
    this.phaseTimer = 2; // Start hidden briefly then attack
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = new THREE.Vector3().subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Phase transitions ──
    switch (this.phase) {
      case 'hidden':
        if (this.phaseTimer > 3 + Math.random() * 2) {
          this.phase = 'approach';
          this.phaseTimer = 0;
          // Warp to fog edge from a random angle for the ambush
          const angle = Math.random() * Math.PI * 2;
          const approachDir = new THREE.Vector3(
            Math.cos(angle), (Math.random() - 0.5) * 0.3, Math.sin(angle),
          ).normalize();
          self.position.copy(target.position).addScaledVector(approachDir, this.FOG_RANGE + 50);
          // Set velocity toward player so we're already flying in
          self.velocity.copy(approachDir).negate().multiplyScalar(50);
          // Face toward the player
          self.group.lookAt(target.position);
          this.breakDir *= -1;
        }
        break;
      case 'approach':
        if (distToPlayer < 80 || this.phaseTimer > 3.5) {
          this.phase = 'attack';
          this.phaseTimer = 0;
        }
        break;
      case 'attack':
        if (this.phaseTimer > 2.5) {
          this.phase = 'retreat';
          this.phaseTimer = 0;
          // Set retreat point beyond fog
          const retreatAngle = Math.random() * Math.PI * 2;
          this._retreatPt.set(
            target.position.x + Math.cos(retreatAngle) * (this.FOG_RANGE + 100),
            target.position.y + (Math.random() - 0.5) * 60,
            target.position.z + Math.sin(retreatAngle) * (this.FOG_RANGE + 100),
          );
        }
        break;
      case 'retreat':
        if (distToPlayer > this.FOG_RANGE + 30 || this.phaseTimer > 3) {
          this.phase = 'hidden';
          this.phaseTimer = 0;
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.5;
    let fire = false;

    switch (this.phase) {
      case 'hidden': {
        // Circle beyond fog range — always moving, maintaining speed
        const angle = this.timer * 0.5;
        const orbitPt = new THREE.Vector3(
          target.position.x + Math.cos(angle) * (this.FOG_RANGE + 60),
          target.position.y + Math.sin(this.timer * 0.3) * 20,
          target.position.z + Math.sin(angle) * (this.FOG_RANGE + 60),
        );
        const steer = steerToward(self, orbitPt, 1.5, 0.4);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }

      case 'approach': {
        // Dive toward player at high speed — aggressive intercept
        leadIntercept(self.position, target.position, target.velocity, 70, this._interceptPt);
        const steer = steerToward(self, this._interceptPt, 3.0, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // full speed ambush dive
        break;
      }

      case 'attack': {
        // Close-range attack pass — tight pursuit, aggressive firing
        leadIntercept(self.position, target.position, target.velocity, 80, this._interceptPt);
        // Orbit slightly rather than fly straight through
        const right = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(right, Math.sin(this.timer * 2.5) * 30);

        const steer = steerToward(self, this._interceptPt, 2.5, 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        // Aggressive burst fire during attack
        if (distToPlayer < 150 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate * 0.6) fire = true;
        }
        break;
      }

      case 'retreat': {
        // Flee to retreat point at high speed
        const steer = steerToward(self, this._retreatPt, 2.5, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // full speed escape
        break;
      }
    }

    return { yaw, pitch, roll: 0, thrust, fire };
  }
}
