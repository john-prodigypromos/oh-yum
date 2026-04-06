// ── 3D Weapon System ─────────────────────────────────────
// Player bolts auto-aim toward nearest enemy.
// Enemy bolts aim at the player.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { BoltPool } from '../entities/Bolt3D';
import { WEAPONS } from '../config';

const PLAYER_BOLT_OFFSETS = [
  new THREE.Vector3(-1.2, -0.5, 12),
  new THREE.Vector3(1.2, -0.5, 12),
];

const ENEMY_BOLT_OFFSET = new THREE.Vector3(0, 0, 3);

const _offset = new THREE.Vector3();
const _dir = new THREE.Vector3();

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

  // Enemy ships can only fire from the player's BLIND SPOTS — behind, above, or below.
  // This prevents unrealistic damage when enemies are in the player's forward field of view.
  if (!ship.isPlayer && target && target.alive) {
    // 1) Enemy must be facing the target (forward cone check)
    const toTarget = target.position.clone().sub(ship.position).normalize();
    const forward = ship.getForward();
    const dot = forward.dot(toTarget);
    if (dot < 0.3) return false; // target not in enemy's forward cone

    // 2) Enemy must be in the player's blind zone — NOT in front of the player
    const playerForward = target.getForward();
    const playerToEnemy = ship.position.clone().sub(target.position);
    const distToTarget = playerToEnemy.length();
    if (distToTarget < 0.1) return false;
    playerToEnemy.normalize();

    // Horizontal dot: >0 means enemy is in front of player, <0 means behind
    const facingDot = playerForward.dot(playerToEnemy);

    // Vertical offset: how far above/below the player the enemy is
    const verticalOffset = Math.abs(ship.position.y - target.position.y);
    const isAboveOrBelow = verticalOffset > 12; // must be well above or below — no shallow angles

    // Allow fire only if: enemy is behind the player OR significantly above/below
    const isBehindPlayer = facingDot < -0.35; // must be well behind the player — no flank shots
    if (!isBehindPlayer && !isAboveOrBelow) return false;
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
