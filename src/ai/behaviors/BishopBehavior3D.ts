// ── Bishop Boss AI (Level 3) ─────────────────────────────
// Mastermind: multi-phase, deploys drones, uses black hole gravity.
// Phase 1 (100-50% HP): Enhanced dogfight
// Phase 2 (50-20% HP): Evasive + 2 drones
// Phase 3 (<20% HP): Desperate charges near black hole
// Uses physics-based steering — never stalls.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { BLACK_HOLE_POS } from '../../systems/EnvironmentLoader';
import { steerToward, steerAway, leadIntercept } from '../Steering';

type BossPhase = 'phase1' | 'phase2' | 'phase3';
type SubPhase = 'dogfight' | 'breakaway' | 'evasive' | 'charge';

export class BishopBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private bossPhase: BossPhase = 'phase1';
  private subPhase: SubPhase = 'dogfight';
  private phaseTimer = 0;
  private timer = 0;
  private breakDir = 1;

  // Drone management — Bishop tells ArenaLoop to spawn drones
  dronesRequested = 0;
  droneRespawnTimer = 0;
  readonly DRONE_RESPAWN_DELAY = 15;

  // Black hole position — imported from EnvironmentLoader
  private readonly BH_POS = BLACK_HOLE_POS;

  private _interceptPt = new THREE.Vector3();
  private _chargePt = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const hpPct = self.hull / self.maxHull;
    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = new THREE.Vector3().subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Boss phase transitions based on HP ──
    if (hpPct <= 0.2 && this.bossPhase !== 'phase3') {
      this.bossPhase = 'phase3';
      this.subPhase = 'charge';
      this.phaseTimer = 0;
    } else if (hpPct <= 0.5 && this.bossPhase === 'phase1') {
      this.bossPhase = 'phase2';
      this.subPhase = 'evasive';
      this.phaseTimer = 0;
      this.dronesRequested = 2;
    }

    // ── Drone respawn management (Phase 2 only) ──
    if (this.bossPhase === 'phase2') {
      this.droneRespawnTimer += dt;
    }

    // ── Sub-phase transitions ──
    switch (this.bossPhase) {
      case 'phase1':
        if (this.subPhase === 'dogfight' && this.phaseTimer > 8) {
          this.subPhase = 'breakaway';
          this.phaseTimer = 0;
          this.breakDir *= -1;
        } else if (this.subPhase === 'breakaway' && (distToPlayer > 200 || this.phaseTimer > 3)) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        }
        break;
      case 'phase2':
        if (this.subPhase === 'evasive' && this.phaseTimer > 6) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > 4) {
          this.subPhase = 'evasive';
          this.phaseTimer = 0;
          this.breakDir *= -1;
        }
        break;
      case 'phase3':
        if (this.subPhase === 'charge' && this.phaseTimer > 2.5) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > 4) {
          this.subPhase = 'charge';
          this.phaseTimer = 0;
        }
        break;
    }

    // ── Steering per sub-phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.subPhase) {
      case 'dogfight': {
        // Aggressive pursuit with orbit weaving
        leadIntercept(self.position, target.position, target.velocity, 55, this._interceptPt);
        // Weave around the intercept point for dynamic movement
        const right = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
        const orbitOffset = Math.sin(this.timer * 0.8) * 50;
        this._interceptPt.addScaledVector(right, orbitOffset);
        this._interceptPt.y += Math.cos(this.timer * 0.6) * 20;

        const sensitivity = this.bossPhase === 'phase1' ? 2.5 : 3.0;
        const steer = steerToward(self, this._interceptPt, sensitivity, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        // Fire when aligned
        const effectiveRate = this.bossPhase === 'phase3'
          ? this.fireRate * 0.5
          : this.bossPhase === 'phase2'
            ? this.fireRate * 0.8
            : this.fireRate * 0.7;
        if (distToPlayer < 250 && facingAlignment > 0.4) {
          if (now - self.lastFireTime >= effectiveRate) fire = true;
        }
        break;
      }

      case 'breakaway': {
        // Hard break turn away from player
        const steer = steerAway(self, target.position, 2.5, 0.6, this.breakDir * 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }

      case 'evasive': {
        // Phase 2: High-speed evasive flight — let drones do the work
        // Fly in wide arcing patterns at medium range
        const evadeAngle = this.timer * 1.2;
        const evadeRadius = 140 + Math.sin(this.timer * 0.7) * 40;
        const evadePt = new THREE.Vector3(
          target.position.x + Math.cos(evadeAngle) * evadeRadius,
          target.position.y + Math.sin(this.timer * 0.9) * 35,
          target.position.z + Math.sin(evadeAngle) * evadeRadius,
        );
        const steer = steerToward(self, evadePt, 2.0, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        // Occasional snap shots
        if (distToPlayer < 200 && facingAlignment > 0.6) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'charge': {
        // Phase 3: Desperate charge toward player, biased toward black hole
        // Compute charge target: between player and black hole
        this._chargePt.copy(target.position);
        const toBH = new THREE.Vector3().subVectors(this.BH_POS, self.position).normalize();
        this._chargePt.addScaledVector(toBH, 40); // bias toward black hole

        const steer = steerToward(self, this._chargePt, 2.0, 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0; // max thrust during charge

        // Add velocity boost for charge impact
        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 150 * dt);

        // Fire during charge
        if (distToPlayer < 250 && facingAlignment > 0.3) {
          if (now - self.lastFireTime >= this.fireRate * 0.5) fire = true;
        }
        break;
      }
    }

    return { yaw, pitch, roll: 0, thrust, fire };
  }
}
