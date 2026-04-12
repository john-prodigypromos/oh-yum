// ── Bishop Boss AI (Level 3) ─────────────────────────────
// Mastermind: multi-phase, deploys drones, uses black hole gravity.
// Phase 1 (100-50% HP): Precise surgical dogfight (low jink)
// Phase 2 (50-20% HP): Evasive + 2 drones (medium jink)
// Phase 3 (<20% HP): Desperate wild charges (high jink)
// Distance leash: 200u — never drifts into passive territory.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { BLACK_HOLE_POS } from '../../systems/EnvironmentLoader';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type BossPhase = 'phase1' | 'phase2' | 'phase3';
type SubPhase = 'dogfight' | 'breakaway' | 'evasive' | 'charge';

export class BishopBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private bossPhase: BossPhase = 'phase1';
  private subPhase: SubPhase = 'dogfight';
  private phaseTimer = 0;
  private phaseDuration = 10;
  private timer = 0;
  private breakDir = 1;
  private seed = 7.19;
  private _snapImpulse = 0;

  // Drone management — Bishop tells ArenaLoop to spawn drones
  dronesRequested = 0;
  droneRespawnTimer = 0;
  readonly DRONE_RESPAWN_DELAY = 15;

  // Black hole position — imported from EnvironmentLoader
  private readonly BH_POS = BLACK_HOLE_POS;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _chargePt = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _evadePt = new THREE.Vector3();
  private _toBH = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
  ) {
    this.fireRate = fireRate;
    this._setSubPhase('dogfight');
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
    const toPlayer = this._toPlayer.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Boss phase transitions based on HP ──
    if (hpPct <= 0.2 && this.bossPhase !== 'phase3') {
      this.bossPhase = 'phase3';
      this._setSubPhase('charge');
    } else if (hpPct <= 0.5 && this.bossPhase === 'phase1') {
      this.bossPhase = 'phase2';
      this._setSubPhase('evasive');
      this.dronesRequested = 2;
    }

    // ── Drone respawn management (Phase 2 only) ──
    if (this.bossPhase === 'phase2') {
      this.droneRespawnTimer += dt;
    }

    // ── Distance leash — never drift beyond 200 units ──
    if (distToPlayer > 200 && this.subPhase !== 'dogfight') {
      this._setSubPhase('dogfight');
    }

    // ── Sub-phase transitions ──
    switch (this.bossPhase) {
      case 'phase1':
        if (this.subPhase === 'dogfight' && this.phaseTimer > this.phaseDuration) {
          this._setSubPhase('breakaway');
          this.breakDir *= -1;
        } else if (this.subPhase === 'breakaway' && (distToPlayer > 120 || this.phaseTimer > this.phaseDuration)) {
          this._setSubPhase('dogfight');
        }
        break;
      case 'phase2':
        if (this.subPhase === 'evasive' && this.phaseTimer > this.phaseDuration) {
          this._setSubPhase('dogfight');
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > this.phaseDuration) {
          this._setSubPhase('evasive');
          this.breakDir *= -1;
        }
        break;
      case 'phase3':
        if (this.subPhase === 'charge' && this.phaseTimer > 2.5) {
          this._setSubPhase('dogfight');
        } else if (this.subPhase === 'dogfight' && this.phaseTimer > this.phaseDuration) {
          this._setSubPhase('charge');
        }
        break;
    }

    // ── Jink intensity escalates with desperation ──
    const jinkIntensity = this.bossPhase === 'phase3' ? 0.7
      : this.bossPhase === 'phase2' ? 0.45
      : 0.25;

    // ── Steering per sub-phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.subPhase) {
      case 'dogfight': {
        // Aggressive pursuit with chaotic orbit weaving
        leadIntercept(self.position, target.position, target.velocity, 85, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        const orbitOffset = chaos(this.timer, this.seed) * 60;
        this._interceptPt.addScaledVector(this._right, orbitOffset);
        this._interceptPt.y += chaos(this.timer, this.seed * 1.5) * 20 + 15;

        const sensitivity = this.bossPhase === 'phase1' ? 2.5 : 3.0;
        const steer = steerToward(self, this._interceptPt, sensitivity, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        const effectiveRate = this.bossPhase === 'phase3'
          ? this.fireRate * 0.35
          : this.bossPhase === 'phase2'
            ? this.fireRate * 0.6
            : this.fireRate * 0.7;
        if (distToPlayer < 150 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= effectiveRate) fire = true;
        }
        break;
      }

      case 'breakaway': {
        // Short hard break turn away from player
        const steer = steerAway(self, target.position, 2.5, 0.6, this.breakDir * 0.6);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }

      case 'evasive': {
        // Phase 2: High-speed evasive flight in tighter arcs — let drones do the work
        const evadeAngle = this.timer * 1.2 + chaos(this.timer, this.seed) * 0.6;
        const evadeRadius = 60 + (chaos(this.timer, this.seed * 2) + 1) * 20; // 60-100u
        this._evadePt.set(
          target.position.x + Math.cos(evadeAngle) * evadeRadius,
          target.position.y + Math.sin(this.timer * 0.9) * 35 + 20,
          target.position.z + Math.sin(evadeAngle) * evadeRadius,
        );
        const steer = steerToward(self, this._evadePt, 2.0, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        // Sudden dodge bursts
        thrust = distToPlayer < 100 ? 1.0 : 0.8;

        // Occasional snap shots
        if (distToPlayer < 120 && facingAlignment > 0.35) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'charge': {
        // Phase 3: Desperate charge toward player, biased toward black hole
        this._chargePt.copy(target.position);
        this._toBH.subVectors(this.BH_POS, self.position).normalize();
        this._chargePt.addScaledVector(this._toBH, 40);

        const steer = steerToward(self, this._chargePt, 2.0, 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;

        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 150 * dt);

        if (distToPlayer < 150 && facingAlignment > 0.2) {
          if (now - self.lastFireTime >= this.fireRate * 0.35) fire = true;
        }
        break;
      }
    }

    // ── Snap impulse on phase transitions ──
    if (this._snapImpulse !== 0) {
      yaw += this._snapImpulse;
      this._snapImpulse = 0;
    }

    // ── Jink overlay — escalating with desperation ──
    const jink = jinkOverlay(this.timer, this.seed, jinkIntensity);
    yaw = Math.max(-1, Math.min(1, yaw + jink.yaw));
    pitch = Math.max(-1, Math.min(1, pitch + jink.pitch));

    return { yaw, pitch, roll: 0, thrust, fire };
  }

  private _setSubPhase(subPhase: SubPhase): void {
    this.subPhase = subPhase;
    this.phaseTimer = 0;
    this._snapImpulse = 0.4 * this.breakDir;

    switch (subPhase) {
      case 'dogfight':
        this.phaseDuration = this.bossPhase === 'phase1'
          ? 7 + (chaos(this.timer, this.seed) + 1) * 2   // 7-11s
          : 3 + (chaos(this.timer, this.seed) + 1) * 1;   // 3-5s
        break;
      case 'breakaway':
        this.phaseDuration = 1.0 + (chaos(this.timer, this.seed) + 1) * 0.4; // 1.0-1.8s
        break;
      case 'evasive':
        this.phaseDuration = 4 + (chaos(this.timer, this.seed) + 1) * 1.5; // 4-7s
        break;
      default:
        this.phaseDuration = 3;
        break;
    }
  }
}
