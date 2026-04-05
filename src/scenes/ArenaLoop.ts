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
import { MouseControls } from '../ui/MouseControls';
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
  mouseControls: MouseControls;
  sound: SoundSystem;
  score: number;
  levelConfig: LevelConfig;
  camera: THREE.PerspectiveCamera;
  gameOver: boolean;
  gameOverTime: number;
  victory: boolean;
  victoryTime: number;
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
    enemyGeo.scale.set(3, 3, 3); // triple size for maximum visibility
    applyMaterials(enemyGeo, createEnemyMaterials());

    // Spawn at random positions around the player — must hunt for them
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 30;
    const elevation = (Math.random() - 0.5) * 20;
    enemyGeo.position.set(
      Math.cos(angle) * dist,
      elevation,
      Math.sin(angle) * dist,
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
  const explosions = new ExplosionPool();
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = new SoundSystem();
  sound.init();
  sound.startMusic();

  return {
    player, enemies, enemyAIs,
    boltPool, explosions, cockpitCam, touchControls, mouseControls, sound,
    camera,
    score: previousScore,
    levelConfig,
    gameOver: false,
    gameOverTime: 0,
    victory: false,
    victoryTime: 0,
  };
}

export function updateArena(
  state: ArenaState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
): void {
  try {
  if (state.gameOver || state.victory) return;

  const { player, enemies, enemyAIs, boltPool, explosions, cockpitCam, touchControls, mouseControls } = state;

  // ── Player input ──
  // Desktop: mouse/trackpad aims, space fires
  // Mobile: touch joystick aims, fire button fires
  const mouse = mouseControls.getInput();
  const touch = touchControls.getInput();

  const input: ShipInput = {
    yaw: Math.max(-1, Math.min(1, mouse.yaw + touch.yaw)),
    pitch: touch.pitch, // touch only for pitch (mobile)
    roll: 0,
    thrust: 0,
  };

  // Trackpad up/down moves ship vertically (not pitch rotation)
  const vertSpeed = 60;
  player.position.y += mouse.verticalMove * vertSpeed * dt;

  // ── Player weapons — auto-aim at nearest alive enemy ──
  if (keys['Space'] || touch.fire) {
    const nearestEnemy = enemies
      .filter(e => e.alive)
      .sort((a, b) => a.position.distanceTo(player.position) - b.position.distanceTo(player.position))[0];
    if (tryFireWeapon(player, boltPool, now, undefined, nearestEnemy)) {
      state.sound.playerShoot();
    }
  }

  // Draw touch controls (only visible on touch devices)
  touchControls.draw();

  // ── Enemy AI + weapons ──
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    const aiInput = enemyAIs[i].update(enemy, player, dt, now);
    if (aiInput.fire) {
      if (tryFireWeapon(enemy, boltPool, now, undefined, player)) {
        state.sound.enemyShoot();
      }
    }
    // Force-fire every 300ms as backup
    if (now - enemy.lastFireTime > 300) {
      tryFireWeapon(enemy, boltPool, now, undefined, player);
    }
    // AI directly controls enemy position — skip physics
  }

  // ── Player physics ──
  applyShipPhysics(player, input, dt, now);

  // ── Bolts ──
  boltPool.update(dt);

  // ── Damage ──
  const allShips = [player, ...enemies];
  const damageEvents = processBoltDamage(boltPool, allShips, now);

  for (const evt of damageEvents) {
    try {
      // Score for player hitting enemies
      if (evt.bolt.isPlayer && !evt.target.isPlayer) {
        state.score += evt.damage * 10;
      }

      // Sound + camera shake + screen flash on player hit
      if (evt.target === player) {
        cockpitCam.shake(evt.shieldHit ? 0.8 : 1.5);
        if (evt.shieldHit) state.sound.shieldHit();
        else state.sound.hullHit();

        // Full-screen damage flash
        const flash = document.createElement('div');
        const color = evt.shieldHit
          ? 'rgba(0, 150, 255, 0.25)'   // blue for shield
          : 'rgba(255, 100, 0, 0.3)';    // orange for hull
        flash.style.cssText = `
          position:fixed;top:0;left:0;width:100%;height:100%;
          background:${color};z-index:40;pointer-events:none;
          transition:opacity 0.4s ease-out;
        `;
        document.getElementById('ui-overlay')!.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0'; });
        setTimeout(() => flash.remove(), 500);
      }

      // Project enemy position to screen for explosions
      const w = window.innerWidth;
      const h = window.innerHeight;
      let ex = w / 2;
      let ey = h / 2;

      if (!evt.target.isPlayer) {
        const proj = evt.target.position.clone().project(state.camera);
        if (proj.z < 1) {
          ex = (proj.x * 0.5 + 0.5) * w;
          ey = (-proj.y * 0.5 + 0.5) * h;
        }
      }

      // Impact flash at enemy position
      if (!evt.target.isPlayer) {
        explosions.spawnHit(ex, ey);
      }

      // DEATH — explosion at enemy position
      if (!evt.target.alive) {
        explosions.spawnDeath(ex, ey);
        state.sound.explosion();
        if (!evt.target.isPlayer) {
          state.score += 500;
          evt.target.group.visible = false;
        }
      }
    } catch (e) {
      console.error('Damage event error:', e);
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

  // ── Win/Lose conditions (with delay for explosions to play) ──
  if (!player.alive && !state.gameOver) {
    state.gameOver = true;
    state.gameOverTime = now;
    state.sound.stopMusic();
    state.sound.defeat();
  }

  const allEnemiesDead = enemies.every(e => !e.alive);
  if (allEnemiesDead && !state.victory) {
    state.victory = true;
    state.victoryTime = now;
    state.sound.stopMusic();
    state.sound.victory();
  }
  } catch (e) {
    console.error('Arena update error:', e);
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
