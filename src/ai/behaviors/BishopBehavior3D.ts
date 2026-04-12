// ── Bishop Boss AI (Level 3) ─────────────────────────────
// Mastermind: multi-phase, deploys drones, uses black hole gravity.
// Phase 1 (100-50% HP): Precise surgical dogfight
// Phase 2 (50-20% HP): Evasive + 2 drones
// Phase 3 (<20% HP): Desperate wild charges
// Difficulty-driven aggression and jink evasion.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
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
  private cfg: AIConfig;

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
    cfg: AIConfig,
  ) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this._setSubPhase('dogfight');
  }

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;

    const { sensitivity, leashRange } = this.cfg;
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

    // ── Distance leash — never drift beyond leash range ──
    if (distToPlayer > leashRange && this.subPhase !== 'dogfight') {
      this._setSubPhase('dogfight');
    }

    // ── Sub-phase transitions ──
    switch (this.bossPhase) {
      case 'phase1':
        if (this.subPhase === 'dogfight' && this.phaseTimer > this.phaseDuration) {
          this._setSubPhase('breakaway');
          this.breakDir *= -1;
        } else if (this.subPhase === 'breakaway' && (distToPlayer > leashRange * 0.6 || this.phaseTimer > this.phaseDuration)) {
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

        const sens = this.bossPhase === 'phase1' ? sensitivity * 0.8 : sensitivity;
        const steer = steerToward(self, this._interceptPt, sens, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;

        const effectiveRate = this.bossPhase === 'phase3'
          ? this.fireRate * 0.35
          : this.bossPhase === 'phase2'
            ? this.fireRate * 0.6
            : this.fireRate * 0.7;
        if (distToPlayer < 150 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= effectiveRate) fire = true;
        }
        break;
      }

      case 'breakaway': {
        const steer = steerAway(self, target.position, sensitivity, 0.75, this.breakDir * 0.8);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = steer.thrust;
        break;
      }

      case 'evasive': {
        // Phase 2: High-speed evasive flight in tighter arcs
        const evadeAngle = this.timer * 1.2 + chaos(this.timer, this.seed) * 0.6;
        const evadeRadius = 60 + (chaos(this.timer, this.seed * 2) + 1) * 20;
        this._evadePt.set(
          target.position.x + Math.cos(evadeAngle) * evadeRadius,
          target.position.y + Math.sin(this.timer * 0.9) * 35 + 20,
          target.position.z + Math.sin(evadeAngle) * evadeRadius,
        );
        const steer = steerToward(self, this._evadePt, sensitivity * 0.5, 0.5);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = distToPlayer < 100 ? 1.0 : 0.8;

        // Snap shots while evading
        if (distToPlayer < 120 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'charge': {
        // Phase 3: Desperate charge toward player, biased toward black hole
        this._chargePt.copy(target.position);
        this._toBH.subVectors(this.BH_POS, self.position).normalize();
        this._chargePt.addScaledVector(this._toBH, 40);

        const steer = steerToward(self, this._chargePt, sensitivity * 0.5, 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;

        // Boost velocity but respect speed cap
        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 100 * dt);
        const spd = self.velocity.length();
        if (spd > 100 * self.speedMult) self.velocity.setLength(100 * self.speedMult);

        if (distToPlayer < 150 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.35) fire = true;
        }
        break;
      }
    }

    // ── Jink intensity escalates with desperation ──
    const baseJink = this.bossPhase === 'phase3' ? 1.0
      : this.bossPhase === 'phase2' ? 0.8
      : 0.6;
    const isAttacking = this.subPhase === 'dogfight' || this.subPhase === 'charge';
    const jinkScale = isAttacking ? 0.3 : 1.0;
    const jink = jinkOverlay(this.timer, this.seed, this.cfg.jinkIntensity * baseJink * jinkScale);
    yaw += jink.yaw;
    pitch += jink.pitch;

    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));

    // ── Banking roll ──
    const roll = -yaw * 0.6;

    return { yaw, pitch, roll, thrust, fire };
  }

  private _setSubPhase(subPhase: SubPhase): void {
    this.subPhase = subPhase;
    this.phaseTimer = 0;

    const aggrScale = 1 - this.cfg.aggression * 0.5;

    switch (subPhase) {
      case 'dogfight':
        this.phaseDuration = this.bossPhase === 'phase1'
          ? (3 + (chaos(this.timer, this.seed) + 1) * 1.5) * aggrScale
          : (1.5 + (chaos(this.timer, this.seed) + 1) * 1) * aggrScale;
        break;
      case 'breakaway':
        this.phaseDuration = (0.5 + (chaos(this.timer, this.seed) + 1) * 0.3) * aggrScale;
        break;
      case 'evasive':
        this.phaseDuration = (2 + (chaos(this.timer, this.seed) + 1) * 1.0) * aggrScale;
        break;
      default:
        this.phaseDuration = 3 * aggrScale;
        break;
    }
  }
}
