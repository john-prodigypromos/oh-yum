// ── 3D AI Behavior Interface ─────────────────────────────

import { Ship3D } from '../entities/Ship3D';
import type { ShipInput } from '../systems/PhysicsSystem3D';

/** Difficulty-driven AI tuning passed to every behavior constructor. */
export interface AIConfig {
  sensitivity: number;     // steering sharpness (2.0-5.0)
  aggression: number;      // 0.0-1.0 — pursuit relentlessness
  jinkIntensity: number;   // 0.0-1.0 — evasive weaving
  leashRange: number;      // max distance before forced re-engage
  fireCone: number;        // dot threshold for firing
}

export interface AIBehavior3D {
  update(self: Ship3D, target: Ship3D, dt: number, now: number): ShipInput & { fire: boolean };
}
