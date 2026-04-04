// ── 3D Weapon System ─────────────────────────────────────
// Handles bolt firing with fire rate, twin bolt offset, spread.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { BoltPool } from '../entities/Bolt3D';
import { WEAPONS } from '../config';

// Offsets for twin bolts (left and right of ship nose)
const PLAYER_BOLT_OFFSETS = [
  new THREE.Vector3(-1.2, -0.1, 4),  // left gun
  new THREE.Vector3(1.2, -0.1, 4),   // right gun
];

const ENEMY_BOLT_OFFSET = new THREE.Vector3(0, 0, 3); // single nose gun

const _offset = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _spread = new THREE.Vector3();

export function tryFireWeapon(
  ship: Ship3D,
  pool: BoltPool,
  now: number,
  fireRate?: number,
): boolean {
  const rate = fireRate ?? WEAPONS.BLASTER_FIRE_RATE;
  if (now - ship.lastFireTime < rate) return false;
  ship.lastFireTime = now;

  const forward = ship.getForward();
  const offsets = ship.isPlayer ? PLAYER_BOLT_OFFSETS : [ENEMY_BOLT_OFFSET];

  for (const localOffset of offsets) {
    // Transform offset to world space
    _offset.copy(localOffset).applyQuaternion(ship.group.quaternion);
    const spawnPos = ship.position.clone().add(_offset);

    // Add spread
    _dir.copy(forward);
    const spreadRad = (WEAPONS.BLASTER_SPREAD * Math.PI) / 180;
    _spread.set(
      (Math.random() - 0.5) * spreadRad,
      (Math.random() - 0.5) * spreadRad,
      0,
    );
    _dir.applyEuler(new THREE.Euler(_spread.x, _spread.y, 0));

    pool.fire(spawnPos, _dir, ship.isPlayer);
  }

  return true;
}
