// ── AI Steering Utilities ────────────────────────────────
// Converts "I want to be THERE" into yaw/pitch/thrust commands
// so enemies fly like jets — continuous forward motion, banking
// turns, no hovering or teleporting.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';

// Pre-allocated scratch vectors (avoid per-frame GC)
const _toTarget = new THREE.Vector3();
const _fwdFlat = new THREE.Vector3();
const _targetFlat = new THREE.Vector3();
const _awayRight = new THREE.Vector3();
const _awayPoint = new THREE.Vector3();

export interface SteeringOutput {
  yaw: number;    // -1..1  (positive = turn right)
  pitch: number;  // -1..1  (positive = nose down)
  thrust: number; // -1..1
}

/**
 * Compute yaw/pitch/thrust to steer a ship toward a world-space target.
 *
 * @param sensitivity  Turn aggressiveness — 2.0 normal, 4.0 sharp, 1.0 lazy
 * @param minThrust    Floor thrust even when turning hard (0.3 = 30 %)
 */
export function steerToward(
  self: Ship3D,
  target: THREE.Vector3,
  sensitivity = 2.0,
  minThrust = 0.3,
): SteeringOutput {
  const forward = self.getForward();

  _toTarget.subVectors(target, self.position);
  const dist = _toTarget.length();
  if (dist < 0.1) return { yaw: 0, pitch: 0, thrust: minThrust };
  _toTarget.divideScalar(dist); // normalise

  // ── Yaw: horizontal angle from forward to target ──
  _fwdFlat.set(forward.x, 0, forward.z);
  const fLen = _fwdFlat.length();
  if (fLen > 0.001) _fwdFlat.divideScalar(fLen);

  _targetFlat.set(_toTarget.x, 0, _toTarget.z);
  const tLen = _targetFlat.length();
  if (tLen > 0.001) _targetFlat.divideScalar(tLen);

  // Signed cross-product Y component: positive = target is to the LEFT
  const crossY = _fwdFlat.x * _targetFlat.z - _fwdFlat.z * _targetFlat.x;
  const dotY = _fwdFlat.dot(_targetFlat);
  const yawAngle = Math.atan2(crossY, dotY);

  // Physics: positive yaw input = turn RIGHT, but crossY positive = target LEFT
  // Negate so we turn TOWARD the target.
  const yaw = clamp(-yawAngle * sensitivity);

  // ── Pitch: vertical angle difference ──
  const targetElev = Math.asin(clamp(_toTarget.y));
  const fwdElev = Math.asin(clamp(forward.y));
  const pitchAngle = targetElev - fwdElev;
  // Physics: positive pitch = nose DOWN.  If target is ABOVE (pitchAngle > 0)
  // we need nose UP = negative pitch.
  const pitch = clamp(-pitchAngle * sensitivity);

  // ── Thrust: full when aligned, reduced when turning hard ──
  const alignment = Math.max(0, forward.dot(_toTarget));
  const thrust = minThrust + alignment * (1 - minThrust);

  return { yaw, pitch, thrust };
}

/**
 * Steer AWAY from a target — for break turns and evasion.
 * Same as steerToward but toward the antipodal point relative to self.
 */
export function steerAway(
  self: Ship3D,
  target: THREE.Vector3,
  sensitivity = 2.0,
  minThrust = 0.5,
  lateralBias = 0,
): SteeringOutput {
  // Point directly opposite the target, offset laterally for curving breaks
  _toTarget.subVectors(self.position, target);
  const dist = _toTarget.length();
  if (dist < 0.1) return { yaw: 0, pitch: 0, thrust: 1 };
  _toTarget.divideScalar(dist);

  // Add lateral curve so the break isn't a straight reversal
  if (lateralBias !== 0) {
    _awayRight.set(-_toTarget.z, 0, _toTarget.x);
    _toTarget.addScaledVector(_awayRight, lateralBias).normalize();
  }

  // Compute a temporary world-space waypoint in the "away" direction
  _awayPoint.copy(self.position).addScaledVector(_toTarget, 200);
  return steerToward(self, _awayPoint, sensitivity, minThrust);
}

/**
 * Lead-pursuit intercept: aim where the target WILL be, not where it IS.
 * Returns the intercept point (written to `out`).
 */
export function leadIntercept(
  selfPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  targetVel: THREE.Vector3,
  closingSpeed: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const dist = selfPos.distanceTo(targetPos);
  const rawT = closingSpeed > 1 ? dist / closingSpeed : 1;
  // At close range, clamp prediction tighter to prevent oscillation
  const maxT = dist < 30 ? 0.3 : 3;
  const damping = dist < 50 ? 0.3 : 0.6;
  out.copy(targetPos).addScaledVector(targetVel, Math.min(rawT, maxT) * damping);
  return out;
}

// ── Organic feel utilities ──────────────────────────────

/**
 * Pseudo-chaotic oscillation using product-of-sines.
 * Two incommensurate frequencies beat against each other,
 * producing a signal that looks random over short windows
 * but is fully deterministic. Zero allocation.
 */
export function chaos(t: number, seed: number): number {
  return Math.sin(t * 7.3 + seed) * Math.sin(t * 3.1 + seed * 1.7);
}

/**
 * Evasive maneuver overlay — hard lateral and vertical dodging.
 * Three incommensurate frequencies create complex, unpredictable
 * weaving that looks like active evasion.
 *
 * @param intensity  0.0-1.0 — personality-dependent jink strength
 */
export function jinkOverlay(
  timer: number,
  seed: number,
  intensity: number,
): { yaw: number; pitch: number } {
  // Three frequencies beating against each other for complex evasion
  const jY = Math.sin(timer * 11.3 + seed) * Math.sin(timer * 4.7 + seed * 2.3)
           + Math.sin(timer * 7.9 + seed * 0.8) * 0.5;
  const jP = Math.cos(timer * 9.1 + seed * 1.3) * Math.sin(timer * 5.9 + seed * 0.7)
           + Math.cos(timer * 6.3 + seed * 1.9) * 0.5;
  return {
    yaw: jY * intensity * 0.55,   // strong lateral dodging
    pitch: jP * intensity * 0.45,  // strong vertical dodging
  };
}

function clamp(v: number, lo = -1, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}
