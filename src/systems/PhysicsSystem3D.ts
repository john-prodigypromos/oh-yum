// ── 3D Physics System ────────────────────────────────────
// Fixed-timestep physics: rotation, thrust, drag, velocity cap,
// arena boundary sphere with bounce + damage.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { PHYSICS, ARENA } from '../config';
import type { AtmosphereModifiers } from './AtmosphereSystem';

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
// Pre-allocated scratch vectors for collision resolution (avoid per-frame GC)
const _collNormal = new THREE.Vector3();
const _collDiff = new THREE.Vector3();
const _collRelVel = new THREE.Vector3();
const _collImpulse = new THREE.Vector3();
const _wallNormal = new THREE.Vector3();

export function applyShipPhysics(ship: Ship3D, input: ShipInput, dt: number, now: number, atmosphere?: AtmosphereModifiers): void {
  if (!ship.alive) return;

  const rotSpeed = PHYSICS.ROTATION_SPEED * ship.rotationMult;

  // ── Rotation ──
  // Yaw around WORLD Y-axis (prevents roll accumulation)
  if (input.yaw !== 0) {
    _quat.setFromAxisAngle(_yawAxis, -input.yaw * rotSpeed * dt);
    ship.group.quaternion.premultiply(_quat); // premultiply = world space
  }
  // Pitch around LOCAL X-axis
  if (input.pitch !== 0) {
    _quat.setFromAxisAngle(_pitchAxis, input.pitch * rotSpeed * 0.9 * dt);
    ship.group.quaternion.multiply(_quat); // multiply = local space
  }
  // Roll around LOCAL Z-axis (visual banking for enemy ships)
  if (input.roll !== 0) {
    _quat.setFromAxisAngle(_rollAxis, input.roll * rotSpeed * 0.5 * dt);
    ship.group.quaternion.multiply(_quat);
  }

  ship.group.quaternion.normalize();

  // ── Atmosphere effects ──
  if (atmosphere) {
    if (atmosphere.gravity > 0) {
      ship.velocity.y -= atmosphere.gravity * dt;
    }
    if (atmosphere.drag > 0) {
      const atmoDrag = Math.exp(-atmosphere.drag * dt);
      ship.velocity.multiplyScalar(atmoDrag);
    }
  }

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

  // ── Atmosphere speed cap override ──
  if (atmosphere && atmosphere.speedCap < PHYSICS.MAX_VELOCITY * ship.speedMult) {
    const maxSpeed = atmosphere.speedCap * ship.speedMult;
    const speed2 = ship.velocity.length();
    if (speed2 > maxSpeed) {
      ship.velocity.setLength(maxSpeed);
    }
  }

  // ── Move ──
  ship.position.addScaledVector(ship.velocity, dt);

  // ── Arena boundary (sphere bounce) ──
  const dist = ship.position.length();
  if (dist > ARENA.RADIUS) {
    // Push back to boundary
    ship.position.setLength(ARENA.RADIUS);

    // Reflect velocity off the sphere normal (inward)
    _wallNormal.copy(ship.position).normalize().negate();
    const dot = ship.velocity.dot(_wallNormal);
    if (dot < 0) {
      // Only bounce if moving outward
      ship.velocity.addScaledVector(_wallNormal, -2 * dot * PHYSICS.WALL_BOUNCE_FACTOR);
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
  _collDiff.subVectors(a.position, b.position);
  const dist = _collDiff.length();
  if (dist < 0.01) _collDiff.set(1, 0, 0); // prevent zero-length

  _collNormal.copy(_collDiff).normalize();
  const overlap = hitboxRadius * 2 - dist;

  // Separate ships
  if (overlap > 0) {
    a.position.addScaledVector(_collNormal, overlap * 0.5);
    b.position.addScaledVector(_collNormal, -overlap * 0.5);
  }

  // Bounce velocities
  _collRelVel.subVectors(a.velocity, b.velocity);
  const velAlongNormal = _collRelVel.dot(_collNormal);
  if (velAlongNormal > 0) return; // separating

  _collImpulse.copy(_collNormal).multiplyScalar(-velAlongNormal * 0.8);
  a.velocity.add(_collImpulse);
  b.velocity.sub(_collImpulse);

  // Collision damage based on relative speed
  const impactSpeed = Math.abs(velAlongNormal);
  const damage = Math.max(1, Math.round(impactSpeed * PHYSICS.COLLISION_DAMAGE_MULTIPLIER));
  a.applyDamage(damage, now);
  b.applyDamage(damage, now);
}
