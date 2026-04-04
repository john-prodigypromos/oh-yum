// ── Arena Game Loop ──────────────────────────────────────
// Main 3D combat loop. Wires physics, weapons, damage, AI,
// explosions, camera, HUD updates. Manages enemy spawning
// and win/lose conditions.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { BoltPool } from '../entities/Bolt3D';
import { ExplosionPool } from '../entities/Explosion3D';
import { CockpitCamera } from '../camera/CockpitCamera';
import { applyShipPhysics, checkShipCollision, resolveShipCollision, type ShipInput } from '../systems/PhysicsSystem3D';
import { tryFireWeapon } from '../systems/WeaponSystem3D';
import { processBoltDamage } from '../systems/DamageSystem3D';
import { RustyBehavior3D } from '../ai/behaviors/RustyBehavior3D';
import { createPlayerShipGeometry, createEnemyShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, createEnemyMaterials, applyMaterials } from '../ships/ShipMaterials';
import { TouchControls3D } from '../ui/TouchControls3D';
import { SoundSystem } from '../systems/SoundSystem';
import { SHIP, AI } from '../config';
import { getCurrentLevel, type LevelConfig } from '../state/LevelState';
import { DIFFICULTY, currentDifficulty } from '../state/Difficulty';

export interface ArenaState {
  player: Ship3D;
  enemies: Ship3D[];
  enemyAIs: RustyBehavior3D[];
  boltPool: BoltPool;
  explosions: ExplosionPool;
  cockpitCam: CockpitCamera;
  touchControls: TouchControls3D;
  sound: SoundSystem;
  score: number;
  levelConfig: LevelConfig;
  gameOver: boolean;
  victory: boolean;
}

export function createArenaState(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  level: number,
  previousScore: number,
  playerColor: number,
): ArenaState {
  // ── Player ──
  const playerGeo = createPlayerShipGeometry();
  applyMaterials(playerGeo, createPlayerMaterials(playerColor));
  playerGeo.position.set(0, 0, 0);
  scene.add(playerGeo);

  const diff = DIFFICULTY[currentDifficulty];
  const player = new Ship3D({
    group: playerGeo,
    maxHull: diff.playerHull,
    maxShield: diff.playerShield,
    speedMult: 1.0,
    rotationMult: 1.0,
    isPlayer: true,
  });
  player.score = previousScore;

  // Hide only the cockpit dome (camera sits inside it), keep rest visible
  playerGeo.traverse((child) => {
    if (child.name === 'cockpit') child.visible = false;
  });

  // ── Enemies ──
  const levelConfig = getCurrentLevel();
  const enemies: Ship3D[] = [];
  const enemyAIs: RustyBehavior3D[] = [];

  for (let i = 0; i < levelConfig.enemyCount; i++) {
    const enemyGeo = createEnemyShipGeometry();
    applyMaterials(enemyGeo, createEnemyMaterials());

    // Spawn very close in front of player — must be immediately visible
    const angle = (i / levelConfig.enemyCount) * Math.PI * 0.4 - Math.PI * 0.2;
    const dist = 25 + Math.random() * 15;
    enemyGeo.position.set(
      Math.sin(angle) * dist,
      (Math.random() - 0.5) * 5,
      Math.cos(angle) * dist, // +Z = forward (ship faces +Z)
    );
    scene.add(enemyGeo);

    const enemy = new Ship3D({
      group: enemyGeo,
      maxHull: Math.round(diff.enemyHull * levelConfig.enemySpeedBonus),
      maxShield: diff.enemyShield,
      speedMult: diff.enemySpeedMult * levelConfig.enemySpeedBonus,
      rotationMult: diff.enemyRotationMult * levelConfig.enemyRotationBonus,
      isPlayer: false,
    });
    enemies.push(enemy);

    const ai = new RustyBehavior3D(
      AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
      diff.enemyFireRate * levelConfig.enemyFireRateBonus,
      diff.enemyChaseRange,
    );
    enemyAIs.push(ai);
  }

  // ── Systems ──
  const boltPool = new BoltPool(scene);
  const explosions = new ExplosionPool(scene);
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const sound = new SoundSystem();
  sound.init();
  sound.startMusic();

  return {
    player, enemies, enemyAIs,
    boltPool, explosions, cockpitCam, touchControls, sound,
    score: previousScore,
    levelConfig,
    gameOver: false,
    victory: false,
  };
}

export function updateArena(
  state: ArenaState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
): void {
  if (state.gameOver || state.victory) return;

  const { player, enemies, enemyAIs, boltPool, explosions, cockpitCam, touchControls } = state;

  // ── Player input (keyboard + touch merged) ──
  const touch = touchControls.getInput();
  const kbYaw = (keys['ArrowLeft'] ? -1 : 0) + (keys['ArrowRight'] ? 1 : 0);
  const kbPitch = (keys['ArrowUp'] ? 1 : 0) + (keys['ArrowDown'] ? -1 : 0);
  const kbThrust = 1; // always thrust forward

  const input: ShipInput = {
    yaw: Math.max(-1, Math.min(1, kbYaw + touch.yaw)),
    pitch: Math.max(-1, Math.min(1, kbPitch + touch.pitch)),
    roll: 0,
    thrust: Math.max(-1, Math.min(1, kbThrust + touch.thrust)),
  };

  // ── Player weapons ──
  if (keys['Space'] || touch.fire) {
    if (tryFireWeapon(player, boltPool, now)) {
      state.sound.playerShoot();
    }
  }

  // Draw touch controls
  touchControls.draw();

  // ── Enemy AI + weapons ──
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    const aiInput = enemyAIs[i].update(enemy, player, dt, now);
    if (aiInput.fire) {
      if (tryFireWeapon(enemy, boltPool, now)) {
        state.sound.enemyShoot();
      }
    }
    applyShipPhysics(enemy, aiInput, dt, now);
  }

  // ── Player physics ──
  applyShipPhysics(player, input, dt, now);

  // ── Bolts ──
  boltPool.update(dt);

  // ── Damage ──
  const allShips = [player, ...enemies];
  const damageEvents = processBoltDamage(boltPool, allShips, now);

  for (const evt of damageEvents) {
    // Score for player hitting enemies
    if (evt.bolt.isPlayer && !evt.target.isPlayer) {
      state.score += evt.damage * 10;
    }

    // Sound + camera shake on player hit
    if (evt.target === player) {
      cockpitCam.shake(evt.shieldHit ? 0.3 : 0.6);
      if (evt.shieldHit) state.sound.shieldHit();
      else state.sound.hullHit();
    }

    // Small explosion at impact
    explosions.spawn(evt.bolt.mesh.position.clone());

    // Big explosion on death
    if (!evt.target.alive) {
      explosions.spawn(evt.target.position.clone());
      state.sound.explosion();
      if (!evt.target.isPlayer) {
        state.score += 500; // kill bonus
        evt.target.group.visible = false;
      }
    }
  }

  // ── Ship-to-ship collisions ──
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (checkShipCollision(player, enemy, SHIP.HITBOX_RADIUS)) {
      resolveShipCollision(player, enemy, SHIP.HITBOX_RADIUS, now);
      cockpitCam.shake(0.5);
      state.sound.shipCollision();
    }
  }

  // ── Explosions ──
  explosions.update(dt);

  // ── Camera ──
  cockpitCam.update(player, dt, input.yaw);

  // ── Win/Lose conditions ──
  if (!player.alive && !state.gameOver) {
    state.gameOver = true;
    state.sound.stopMusic();
    state.sound.defeat();
  }

  const allEnemiesDead = enemies.every(e => !e.alive);
  if (allEnemiesDead && !state.victory) {
    state.victory = true;
    state.sound.stopMusic();
    state.sound.victory();
  }
}

/** Remove all arena objects from the scene. */
export function cleanupArena(state: ArenaState, scene: THREE.Scene): void {
  scene.remove(state.player.group);
  for (const e of state.enemies) {
    scene.remove(e.group);
  }
  // Bolts and explosions are managed internally
  for (const bolt of state.boltPool.bolts) {
    scene.remove(bolt.mesh);
    scene.remove(bolt.glow);
  }
}
