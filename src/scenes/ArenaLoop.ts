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
import { SHIP, AI, PHYSICS } from '../config';
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

  // Hide entire player ship — cockpit SVG overlay provides the visual framing
  playerGeo.traverse((child) => {
    if (child instanceof THREE.Mesh) child.visible = false;
  });

  // ── Enemies ──
  const levelConfig = getCurrentLevel();
  const enemies: Ship3D[] = [];
  const enemyAIs: RustyBehavior3D[] = [];

  for (let i = 0; i < levelConfig.enemyCount; i++) {
    const enemyGeo = createEnemyShipGeometry();
    enemyGeo.scale.set(3, 3, 3); // triple size for maximum visibility
    applyMaterials(enemyGeo, createEnemyMaterials());

    // Spawn far away — must hunt them down. Distance increases per level.
    const angle = Math.random() * Math.PI * 2;
    const baseDist = 43200 + level * 21600; // L1: 64800, L2: 86400, L3: 108000
    const dist = baseDist + Math.random() * 28800;
    const elevation = (Math.random() - 0.5) * 60 + i * 25; // spread vertically too
    enemyGeo.position.set(
      Math.cos(angle) * dist,
      elevation,
      Math.sin(angle) * dist,
    );
    // Face toward the player (origin) from spawn — head-on approach
    enemyGeo.lookAt(0, 0, 0);
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
  // Music already playing from title screen — don't restart

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

  // Thrust: ArrowUp / ArrowDown on desktop, touch buttons on mobile
  const keyThrust = (keys['ArrowUp'] ? 1 : 0) + (keys['ArrowDown'] ? -1 : 0);
  const combinedThrust = Math.max(-1, Math.min(1, keyThrust + touch.thrust));

  const input: ShipInput = {
    yaw: Math.max(-1, Math.min(1, mouse.yaw + touch.yaw)),
    pitch: 0, // pitch rotation disabled — vertical movement used instead
    roll: 0,
    thrust: combinedThrust,
  };

  // Vertical movement: mouse (desktop) + joystick Y (mobile)
  // Push up = ship goes up, push down = ship goes down
  // Uses same thrust force as forward movement so it feels proportional
  const touchVertical = Math.abs(touch.pitch) > 0 ? touch.pitch : 0; // joystick up = positive pitch = ship goes up
  const verticalInput = mouse.verticalMove + touchVertical;
  if (verticalInput !== 0) {
    const vertForce = PHYSICS.THRUST * player.speedMult * verticalInput;
    player.velocity.y += vertForce * dt;
  }

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

      // Sound + camera shake + intense visual feedback on player hit
      if (evt.target === player) {
        const isShield = evt.shieldHit;
        cockpitCam.shake(isShield ? 5.0 : 10.0);
        if (isShield) state.sound.shieldHit();
        else state.sound.hullHit();

        const overlay = document.getElementById('ui-overlay')!;

        // Full-screen damage flash — amber for hull, blue for shield
        const flash = document.createElement('div');
        const color = isShield
          ? 'rgba(0, 150, 255, 0.6)'          // bright blue for shield
          : 'rgba(255, 160, 20, 0.75)';        // intense amber for hull
        flash.style.cssText = `
          position:fixed;top:0;left:0;width:100%;height:100%;
          background:${color};z-index:40;pointer-events:none;
          transition:opacity 1.0s ease-out;
        `;
        overlay.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0'; });
        setTimeout(() => flash.remove(), 1100);

        // Amber vignette — heavy glowing edges that persist on hull hits
        if (!isShield) {
          const vignette = document.createElement('div');
          vignette.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:39;pointer-events:none;
            background:radial-gradient(ellipse at center, transparent 20%, rgba(255,140,0,0.55) 70%, rgba(200,60,0,0.7) 100%);
            transition:opacity 1.8s ease-out;
          `;
          overlay.appendChild(vignette);
          requestAnimationFrame(() => { vignette.style.opacity = '0'; });
          setTimeout(() => vignette.remove(), 2000);
        }

        // Shield shimmer effect — thick blue border + strong glow
        if (isShield) {
          const shimmer = document.createElement('div');
          shimmer.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:39;pointer-events:none;
            border:12px solid rgba(0,180,255,0.8);
            box-shadow:inset 0 0 120px rgba(0,150,255,0.4), inset 0 0 200px rgba(0,100,255,0.2);
            transition:opacity 0.6s ease-out;
          `;
          overlay.appendChild(shimmer);
          requestAnimationFrame(() => { shimmer.style.opacity = '0'; });
          setTimeout(() => shimmer.remove(), 700);
        }

        // Multiple directional hit streaks — 2-3 bright lines across screen
        const streakCount = isShield ? 1 : 2 + Math.floor(Math.random() * 2);
        for (let s = 0; s < streakCount; s++) {
          const streak = document.createElement('div');
          const sAngle = Math.random() * 360;
          const thickness = 2 + Math.random() * 4;
          streak.style.cssText = `
            position:fixed;top:50%;left:50%;width:200vw;height:${thickness}px;
            transform:translate(-50%,-50%) rotate(${sAngle}deg);
            background:linear-gradient(90deg, transparent 20%, ${isShield ? 'rgba(0,200,255,0.8)' : 'rgba(255,80,0,0.9)'} 50%, transparent 80%);
            z-index:41;pointer-events:none;
            transition:opacity 0.5s ease-out;
          `;
          overlay.appendChild(streak);
          setTimeout(() => { streak.style.opacity = '0'; }, s * 50);
          setTimeout(() => streak.remove(), 600 + s * 50);
        }

        // Critical damage warning — persistent red pulse when hull is low
        if (player.damagePct > 0.5) {
          const warning = document.createElement('div');
          warning.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:38;pointer-events:none;
            background:radial-gradient(ellipse at center, transparent 20%, rgba(200,0,0,0.25) 100%);
            animation:critPulse 0.5s ease-in-out;
          `;
          overlay.appendChild(warning);
          setTimeout(() => warning.remove(), 500);

          // Inject animation if not already present
          if (!document.getElementById('crit-pulse-css')) {
            const style = document.createElement('style');
            style.id = 'crit-pulse-css';
            style.textContent = `@keyframes critPulse { 0%,100%{opacity:0} 50%{opacity:1} }`;
            document.head.appendChild(style);
          }
        }
      }

      // Project enemy position to screen for hit flashes
      if (!evt.target.isPlayer) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const proj = evt.target.position.clone().project(state.camera);
        if (proj.z < 1) {
          const ex = (proj.x * 0.5 + 0.5) * w;
          const ey = (-proj.y * 0.5 + 0.5) * h;
          explosions.spawnHit(ex, ey);
        }
      }

      // DEATH — world-anchored explosion locked to exact death position
      if (!evt.target.alive) {
        if (!evt.target.isPlayer) {
          const deathPos = evt.target.position.clone();
          explosions.spawnDeathWorld(deathPos, state.camera);
          state.score += 500;
          evt.target.group.visible = false;
        }
        state.sound.explosion();

        // ── PLAYER DEATH — massive full-screen explosion sequence ──
        if (evt.target.isPlayer) {
          const overlay = document.getElementById('ui-overlay')!;
          cockpitCam.shake(5.0); // extreme shake

          // Blinding white flash
          const whiteFlash = document.createElement('div');
          whiteFlash.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:white;z-index:50;pointer-events:none;
            opacity:0.9;transition:opacity 1.5s ease-out;
          `;
          overlay.appendChild(whiteFlash);
          requestAnimationFrame(() => { whiteFlash.style.opacity = '0'; });
          setTimeout(() => whiteFlash.remove(), 1600);

          // Multiple screen-center explosions — staggered
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              explosions.spawnDeath(
                cx + (Math.random() - 0.5) * 300,
                cy + (Math.random() - 0.5) * 200,
              );
            }, i * 200);
          }

          // Massive center fireball
          explosions.spawnAt(cx, cy, 500, 'boom1', 3.0);

          // Red damage vignette that lingers
          const deathVignette = document.createElement('div');
          deathVignette.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:45;pointer-events:none;
            background:radial-gradient(ellipse at center, transparent 20%, rgba(200,0,0,0.5) 80%, rgba(100,0,0,0.8) 100%);
            transition:opacity 2.0s ease-out;
          `;
          overlay.appendChild(deathVignette);
          setTimeout(() => {
            deathVignette.style.opacity = '0';
            setTimeout(() => deathVignette.remove(), 2100);
          }, 1500);

          // Screen crack overlay effect
          const cracks = document.createElement('div');
          cracks.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:46;pointer-events:none;
            background:
              linear-gradient(${35 + Math.random()*20}deg, transparent 48%, rgba(255,255,255,0.15) 49%, rgba(255,255,255,0.15) 51%, transparent 52%),
              linear-gradient(${140 + Math.random()*30}deg, transparent 48%, rgba(255,255,255,0.1) 49%, rgba(255,255,255,0.1) 51%, transparent 52%),
              linear-gradient(${80 + Math.random()*20}deg, transparent 47%, rgba(255,255,255,0.12) 49%, rgba(255,255,255,0.12) 51%, transparent 53%),
              linear-gradient(${200 + Math.random()*30}deg, transparent 48%, rgba(255,255,255,0.08) 49.5%, rgba(255,255,255,0.08) 50.5%, transparent 52%);
            transition:opacity 3.0s ease-out;
          `;
          overlay.appendChild(cracks);
          setTimeout(() => {
            cracks.style.opacity = '0';
            setTimeout(() => cracks.remove(), 3100);
          }, 2000);
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
    // Music keeps playing through game over screen
  }

  const allEnemiesDead = enemies.every(e => !e.alive);
  if (allEnemiesDead && !state.victory) {
    state.victory = true;
    state.victoryTime = now;
    state.sound.levelComplete();
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
