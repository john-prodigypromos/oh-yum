// ── Bolo Tie Boss AI (Level 1) ───────────────────────────
// Predator: prowls close, tightens the noose, charges at full
// afterburner. Cat-and-mouse with speed variation. Difficulty-
// driven aggression and jink evasion.

import * as THREE from 'three';
import { Ship3D } from '../../entities/Ship3D';
import type { AIBehavior3D, AIConfig } from '../AIBehavior3D';
import type { ShipInput } from '../../systems/PhysicsSystem3D';
import { steerToward, steerAway, leadIntercept, chaos, jinkOverlay } from '../Steering';

type Phase = 'prowl' | 'close_in' | 'charging' | 'recovery';

export class BoloTieBehavior3D implements AIBehavior3D {
  private fireRate: number;
  private phase: Phase = 'prowl';
  private phaseTimer = 0;
  private phaseDuration = 0;
  private timer = 0;
  private breakDir = 1;
  private seed = 3.71;
  private cfg: AIConfig;

  // Pre-allocated temp vectors (avoid per-frame GC)
  private _interceptPt = new THREE.Vector3();
  private _prowlPt = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _toPlayer = new THREE.Vector3();

  constructor(
    _aimAccuracy: number,
    fireRate: number,
    _chaseRange: number,
    cfg: AIConfig,
  ) {
    this.fireRate = fireRate;
    this.cfg = cfg;
    this._setPhase('prowl');
  }

  /** Whether a charge is active (for 3x collision damage in ArenaLoop). */
  isCharging = false;

  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean } {
    if (!self.alive || !target.alive) {
      this.isCharging = false;
      return { yaw: 0, pitch: 0, roll: 0, thrust: 0, fire: false };
    }

    this.timer += dt;
    this.phaseTimer += dt;
    this.isCharging = false;

    const { sensitivity, leashRange } = this.cfg;
    const distToPlayer = self.position.distanceTo(target.position);
    const forward = self.getForward();
    const toPlayer = this._toPlayer.subVectors(target.position, self.position).normalize();
    const facingAlignment = forward.dot(toPlayer);

    // ── Distance leash — always re-engage if too far ──
    if (distToPlayer > leashRange && this.phase !== 'close_in') {
      this._setPhase('close_in');
    }

    // ── Phase transitions ──
    switch (this.phase) {
      case 'prowl':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('close_in');
        }
        break;

      case 'close_in':
        if (distToPlayer < leashRange * 0.4 && facingAlignment > 0.5) {
          this._setPhase('charging');
        }
        if (this.phaseTimer > 3.0 && distToPlayer < leashRange * 0.75) {
          this._setPhase('charging');
        }
        break;

      case 'charging':
        if (this.phaseTimer > this.phaseDuration || (this.phaseTimer > 0.6 && facingAlignment < -0.3)) {
          this.breakDir *= -1;
          this._setPhase('recovery');
        }
        break;

      case 'recovery':
        if (this.phaseTimer > this.phaseDuration) {
          this._setPhase('prowl');
        }
        break;
    }

    // ── Steering per phase ──
    let yaw = 0;
    let pitch = 0;
    let thrust = 0.6;
    let fire = false;

    switch (this.phase) {
      case 'prowl': {
        // Tight orbit with predatory lunges — fire aggressively during orbit
        const orbitAngle = this.timer * 0.7 + chaos(this.timer, this.seed) * 0.8;
        const orbitRadius = 35 + (chaos(this.timer, this.seed * 1.3) + 1) * 15;
        this._prowlPt.set(
          target.position.x + Math.cos(orbitAngle) * orbitRadius,
          target.position.y + Math.sin(this.timer * 0.5) * 20 + 18,
          target.position.z + Math.sin(orbitAngle) * orbitRadius,
        );

        const steer = steerToward(self, this._prowlPt, sensitivity, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = this.phaseTimer % 0.6 < 0.25 ? 1.0 : 0.8;

        // Fire aggressively during prowl — predator doesn't wait
        if (distToPlayer < 120 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.7) fire = true;
        }
        break;
      }

      case 'close_in': {
        leadIntercept(self.position, target.position, target.velocity, 95, this._interceptPt);
        this._right.set(-toPlayer.z, 0, toPlayer.x);
        this._interceptPt.addScaledVector(this._right, chaos(this.timer, this.seed) * 30 * this.breakDir);
        this._interceptPt.y += 14;

        const steer = steerToward(self, this._interceptPt, sensitivity * 1.1, 0.7);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = facingAlignment > 0 ? 0.95 : 0.2;

        if (distToPlayer < 140 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.8) fire = true;
        }
        break;
      }

      case 'charging': {
        this.isCharging = true;
        const steer = steerToward(self, target.position, sensitivity * 0.6, 1.0);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = 1.0;

        // Boost velocity but respect speed cap
        const chargeFwd = self.getForward();
        self.velocity.addScaledVector(chargeFwd, 120 * dt);
        const spd = self.velocity.length();
        if (spd > 100 * self.speedMult) self.velocity.setLength(100 * self.speedMult);

        if (distToPlayer < 150 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate * 0.4) fire = true;
        }
        break;
      }

      case 'recovery': {
        const steer = steerAway(self, target.position, sensitivity, 0.75, this.breakDir * 0.9);
        yaw = steer.yaw;
        pitch = steer.pitch;
        thrust = Math.max(0.8, steer.thrust);
        pitch += this.breakDir * 0.3;
        pitch = Math.max(-1, Math.min(1, pitch));

        if (distToPlayer < 100 && facingAlignment > this.cfg.fireCone) {
          if (now - self.lastFireTime >= this.fireRate) fire = true;
        }
        break;
      }
    }

    // ── Jink evasion overlay — less during charge/close-in, more during prowl/recovery ──
    const isAttacking = this.phase === 'charging' || this.phase === 'close_in';
    const jinkScale = isAttacking ? 0.25 : 1.0;
    const jink = jinkOverlay(this.timer, this.seed, this.cfg.jinkIntensity * jinkScale);
    yaw += jink.yaw;
    pitch += jink.pitch;

    yaw = Math.max(-1, Math.min(1, yaw));
    pitch = Math.max(-1, Math.min(1, pitch));

    // ── Banking roll ──
    const roll = -yaw * 0.6;

    return { yaw, pitch, roll, thrust, fire };
  }

  private _setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTimer = 0;

    const aggrScale = 1 - this.cfg.aggression * 0.5;

    switch (phase) {
      case 'prowl':    this.phaseDuration = (0.6 + (chaos(this.timer, this.seed) + 1) * 0.5) * aggrScale; break;
      case 'charging': this.phaseDuration = (1.0 + (chaos(this.timer, this.seed) + 1) * 0.5) * aggrScale; break;
      case 'recovery': this.phaseDuration = (0.3 + (chaos(this.timer, this.seed) + 1) * 0.15) * aggrScale; break;
      default:         this.phaseDuration = 2 * aggrScale; break;
    }
  }
}
