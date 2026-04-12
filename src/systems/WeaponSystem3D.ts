// ── 3D Weapon System ─────────────────────────────────────
// Player bolts auto-aim toward nearest enemy.
// Enemy bolts aim at the player.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { BoltPool } from '../entities/Bolt3D';
import { WEAPONS } from '../config';

const PLAYER_BOLT_OFFSETS = [
  new THREE.Vector3(0, -0.3, 12),
];

const ENEMY_BOLT_OFFSET = new THREE.Vector3(0, 0, 3);

const _offset = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

export function tryFireWeapon(
  ship: Ship3D,
  pool: BoltPool,
  now: number,
  fireRate?: number,
  target?: Ship3D,
): boolean {
  const rate = fireRate ?? WEAPONS.BLASTER_FIRE_RATE;
  if (now - ship.lastFireTime < rate) return false;
  ship.lastFireTime = now;

  // Enemy ships must be facing the target to fire (forward cone check)
  if (!ship.isPlayer && target && target.alive) {
    _toTarget.subVectors(target.position, ship.position).normalize();
    const forward = ship.getForward();
    const dot = forward.dot(_toTarget);
    if (dot < 0.15) return false; // target not in enemy's forward cone
  }

  const offsets = ship.isPlayer ? PLAYER_BOLT_OFFSETS : [ENEMY_BOLT_OFFSET];

  for (const localOffset of offsets) {
    _offset.copy(localOffset).applyQuaternion(ship.group.quaternion);
    const spawnPos = ship.position.clone().add(_offset);

    // Aim at target if provided, otherwise fire forward
    if (target && target.alive) {
      _dir.subVectors(target.position, spawnPos).normalize();
    } else {
      _dir.copy(ship.getForward());
    }

    // Small spread
    const spreadRad = (WEAPONS.BLASTER_SPREAD * Math.PI) / 180;
    _dir.x += (Math.random() - 0.5) * spreadRad;
    _dir.y += (Math.random() - 0.5) * spreadRad;
    _dir.normalize();

    pool.fire(spawnPos, _dir, ship.isPlayer);
  }

  return true;
}
