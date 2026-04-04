// ── 3D Physics System ────────────────────────────────────
// Fixed-timestep physics: rotation, thrust, drag, velocity cap,
// arena boundary sphere with bounce + damage.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { PHYSICS, ARENA } from '../config';

export interface ShipInput {
  yaw: number;    // -1 to 1
  pitch: number;  // -1 to 1
  roll: number;   // -1 to 1
  thrust: number; // -1 to 1
}

const _yawAxis = new THREE.Vector3(0, 1, 0);
const _pitchAxis = new THREE.Vector3(1, 0, 0);
const _rollAxis = new THREE.Vector3(0, 0, 1);
const _quat = new THREE.Quaternion();

export function applyShipPhysics(ship: Ship3D, input: ShipInput, dt: number, now: number): void {
  if (!ship.alive) return;

  const rotSpeed = PHYSICS.ROTATION_SPEED * ship.rotationMult;

  // ── Rotation (local-space axes) ──
  if (input.yaw !== 0) {
    _quat.setFromAxisAngle(_yawAxis, -input.yaw * rotSpeed * dt);
    ship.group.quaternion.multiply(_quat);
  }
  if (input.pitch !== 0) {
    _quat.setFromAxisAngle(_pitchAxis, input.pitch * rotSpeed * 0.7 * dt);
    ship.group.quaternion.multiply(_quat);
  }
  if (input.roll !== 0) {
    _quat.setFromAxisAngle(_rollAxis, input.roll * rotSpeed * 0.5 * dt);
    ship.group.quaternion.multiply(_quat);
  }

  ship.group.quaternion.normalize();

  // ── Thrust ──
  if (input.thrust !== 0) {
    const forward = ship.getForward();
    const thrustForce = PHYSICS.THRUST * ship.speedMult * input.thrust;
    ship.velocity.addScaledVector(forward, thrustForce * dt);
  }

  // ── Drag (exponential half-life decay) ──
  const dragFactor = Math.exp(-Math.log(2) / PHYSICS.DRAG_HALF_LIFE * dt);
  ship.velocity.multiplyScalar(dragFactor);

  // ── Velocity cap ──
  const speed = ship.velocity.length();
  if (speed > PHYSICS.MAX_VELOCITY * ship.speedMult) {
    ship.velocity.setLength(PHYSICS.MAX_VELOCITY * ship.speedMult);
  }

  // ── Move ──
  ship.position.addScaledVector(ship.velocity, dt);

  // ── Arena boundary (sphere bounce) ──
  const dist = ship.position.length();
  if (dist > ARENA.RADIUS) {
    // Push back to boundary
    ship.position.setLength(ARENA.RADIUS);

    // Reflect velocity off the sphere normal (inward)
    const normal = ship.position.clone().normalize().negate();
    const dot = ship.velocity.dot(normal);
    if (dot < 0) {
      // Only bounce if moving outward
      ship.velocity.addScaledVector(normal, -2 * dot * PHYSICS.WALL_BOUNCE_FACTOR);
    }

    // Wall damage
    ship.applyDamage(PHYSICS.WALL_DAMAGE, now);
  }

  // ── Shield regen ──
  ship.updateShieldRegen(dt);
}

/** Check sphere-sphere collision between two ships. Returns true if colliding. */
export function checkShipCollision(a: Ship3D, b: Ship3D, hitboxRadius: number): boolean {
  if (!a.alive || !b.alive) return false;
  const dist = a.position.distanceTo(b.position);
  return dist < hitboxRadius * 2;
}

/** Apply collision response — bounce both ships apart + damage. */
export function resolveShipCollision(a: Ship3D, b: Ship3D, hitboxRadius: number, now: number): void {
  const diff = new THREE.Vector3().subVectors(a.position, b.position);
  const dist = diff.length();
  if (dist < 0.01) diff.set(1, 0, 0); // prevent zero-length

  const normal = diff.normalize();
  const overlap = hitboxRadius * 2 - dist;

  // Separate ships
  if (overlap > 0) {
    a.position.addScaledVector(normal, overlap * 0.5);
    b.position.addScaledVector(normal, -overlap * 0.5);
  }

  // Bounce velocities
  const relVel = new THREE.Vector3().subVectors(a.velocity, b.velocity);
  const velAlongNormal = relVel.dot(normal);
  if (velAlongNormal > 0) return; // separating

  const impulse = normal.clone().multiplyScalar(-velAlongNormal * 0.8);
  a.velocity.add(impulse);
  b.velocity.sub(impulse);

  // Collision damage based on relative speed
  const impactSpeed = Math.abs(velAlongNormal);
  const damage = Math.max(1, Math.round(impactSpeed * PHYSICS.COLLISION_DAMAGE_MULTIPLIER));
  a.applyDamage(damage, now);
  b.applyDamage(damage, now);
}
