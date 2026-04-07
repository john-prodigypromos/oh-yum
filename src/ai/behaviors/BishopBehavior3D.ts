// ── Bishop Boss AI (Level 3) ─────────────────────────────
// Mastermind: multi-phase, deploys drones, uses black hole gravity.
// Phase 1 (100-50% HP): Enhanced dogfight
// Phase 2 (50-20% HP): Evasive + 2 drones
// Phase 3 (<20% HP): Desperate charges near black hole

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { BLACK_HOLE_POS } from '../../systems/EnvironmentLoader';

type BossPhase = 'phase1' | 'phase2' | 'phase3';
type SubPhase = 'dogfight' | 'breakaway' | 'evasive' | 'charge';

export class BishopBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private bossPhase: BossPhase = 'phase1';
  private subPhase: SubPhase = 'dogfight';
  private phaseTimer = 0;
  private timer = 0;
  private orbitAngle = 0;

  // Drone management — Bishop tells ArenaLoop to spawn drones
  dronesRequested = 0;
  droneRespawnTimer = 0;
  readonly DRONE_RESPAWN_DELAY = 15;

  // Black hole position — imported from EnvironmentLoader
  private readonly BH_POS = BLACK_HOLE_POS;

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
    this.orbitAngle += dt * (0.4 + (this.bossPhase === 'phase1' ? 0.2 : 0));

    const hpPct = self.hull / self.maxHull;
    const distToPlayer = self.position.distanceTo(target.position);
    const desiredPos = new THREE.Vector3();

    // ── Boss phase transitions based on HP ──
    if (hpPct <= 0.2 && this.bossPhase !== 'phase3') {
      this.bossPhase = 'phase3';
      this.subPhase = 'charge';
      this.phaseTimer = 0;
    } else if (hpPct <= 0.5 && this.bossPhase === 'phase1') {
      this.bossPhase = 'phase2';
      this.subPhase = 'evasive';
      this.phaseTimer = 0;
      this.dronesRequested = 2; // Signal to spawn 2 drones
    }

    // ── Drone respawn management (Phase 2 only) ──
    if (this.bossPhase === 'phase2') {
      this.droneRespawnTimer += dt;
    }

    // ── Sub-phase transitions ──
    switch (this.bossPhase) {
      case 'phase1': {
        // Enhanced standard dogfight — faster, tighter, higher fire rate
        if (this.subPhase === 'dogfight' && this.phaseTimer > 8) {
          this.subPhase = 'breakaway';
          this.phaseTimer = 0;
        } else if (this.subPhase === 'breakaway' && (distToPlayer > 200 || this.phaseTimer > 3)) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        }
        break;
      }
      case 'phase2': {
        // Evasive — longer breakaways, shorter dogfights
        if (this.subPhase === 'evasive' && this.phaseTimer > 6) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > 4) {
          this.subPhase = 'evasive';
          this.phaseTimer = 0;
        }
        break;
      }
      case 'phase3': {
        // Desperate — alternating charges and tight dogfight near black hole
        if (this.subPhase === 'charge' && this.phaseTimer > 2) {
          this.subPhase = 'dogfight';
          this.phaseTimer = 0;
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > 4) {
          this.subPhase = 'charge';
          this.phaseTimer = 0;
        }
        break;
      }
    }

    // ── Movement ──
    switch (this.subPhase) {
      case 'dogfight': {
        const playerFwd = target.getForward();
        const playerRight = new THREE.Vector3(-playerFwd.z, 0, playerFwd.x);
        const combatRadius = this.bossPhase === 'phase1'
          ? 50 + Math.sin(this.timer * 0.8) * 20  // tighter in phase 1
          : 35 + Math.sin(this.timer * 1.0) * 15;  // even tighter in phase 3

        const behindBias = playerFwd.clone().multiplyScalar(-35);
        const orbitOffset = Math.sin(this.orbitAngle * 1.5) * combatRadius;
        const verticalBias = Math.cos(this.timer * 0.7) * 20;

        desiredPos.set(
          target.position.x + behindBias.x + playerRight.x * orbitOffset,
          target.position.y + verticalBias,
          target.position.z + behindBias.z + playerRight.z * orbitOffset,
        );
        break;
      }

      case 'breakaway': {
        const awayDir = self.position.clone().sub(target.position);
        if (awayDir.length() < 0.1) awayDir.set(1, 0, 0);
        awayDir.normalize();
        const curveRight = new THREE.Vector3(-awayDir.z, 0, awayDir.x);

        desiredPos.copy(self.position);
        desiredPos.addScaledVector(awayDir, 120);
        desiredPos.addScaledVector(curveRight, Math.sin(this.timer * 2) * 50);
        desiredPos.y += Math.sin(this.timer * 1.5) * 20;
        break;
      }

      case 'evasive': {
        // Phase 2: Stay at medium range, dodge erratically, let drones do the work
        const playerFwd = target.getForward();
        const playerRight = new THREE.Vector3(-playerFwd.z, 0, playerFwd.x);
        const evasiveRadius = 120 + Math.sin(this.timer * 1.5) * 40;
        const lateralDodge = Math.sin(this.timer * 3) * 60;
        const verticalDodge = Math.cos(this.timer * 2.5) * 35;

        desiredPos.copy(target.position);
        desiredPos.addScaledVector(playerFwd, evasiveRadius * 0.5);
        desiredPos.addScaledVector(playerRight, lateralDodge);
        desiredPos.y += verticalDodge;
        break;
      }

      case 'charge': {
        // Phase 3: Aggressive charge toward player, pulling closer to black hole
        const toPlayer = target.position.clone().sub(self.position).normalize();

        // Bias slightly toward the black hole — high risk/reward
        const toBH = this.BH_POS.clone().sub(self.position).normalize();
        const chargeDir = toPlayer.clone().addScaledVector(toBH, 0.3).normalize();

        desiredPos.copy(self.position).addScaledVector(chargeDir, 140 * dt);

        // Direct position for charge feel
        self.position.addScaledVector(chargeDir, 100 * dt);

        // Face charge direction
        const lookMat = new THREE.Matrix4();
        const lookTarget = self.position.clone().add(chargeDir);
        lookMat.lookAt(self.position, lookTarget, new THREE.Vector3(0, 1, 0));
        const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
        self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 6));

        // Fire during charge
        const fire = distToPlayer < 250 && now - self.lastFireTime >= this.fireRate * 0.5;
        return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
      }
    }

    // Smooth movement
    const lerpRate = this.bossPhase === 'phase1'
      ? Math.min(1, dt * 2.8)
      : Math.min(1, dt * 2.2);
    self.position.x += (desiredPos.x - self.position.x) * lerpRate;
    self.position.y += (desiredPos.y - self.position.y) * lerpRate;
    self.position.z += (desiredPos.z - self.position.z) * lerpRate;

    // Face the player
    const lookMat = new THREE.Matrix4();
    lookMat.lookAt(self.position, target.position, new THREE.Vector3(0, 1, 0));
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
    self.group.quaternion.slerp(lookQuat, Math.min(1, dt * 4));

    // Fire — more aggressive in later phases
    let fire = false;
    const effectiveRate = this.bossPhase === 'phase3'
      ? this.fireRate * 0.5   // rapid fire in desperation
      : this.bossPhase === 'phase2'
        ? this.fireRate * 0.8 // moderate in evasive
        : this.fireRate * 0.7; // aggressive in phase 1
    if (distToPlayer < 250 && now - self.lastFireTime >= effectiveRate) {
      fire = true;
    }

    return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire };
  }
}
