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
import { BoloTieBehavior3D } from '../ai/behaviors/BoloTieBehavior3D';
import { BowTieBehavior3D } from '../ai/behaviors/BowTieBehavior3D';
import { BishopBehavior3D } from '../ai/behaviors/BishopBehavior3D';
import type { AIBehavior3D } from '../ai/AIBehavior3D';
import { createPlayerShipGeometry, createEnemyShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, createEnemyMaterials, applyMaterials } from '../ships/ShipMaterials';
import { TouchControls3D } from '../ui/TouchControls3D';
import { MouseControls } from '../ui/MouseControls';
import { SoundSystem } from '../systems/SoundSystem';
import { SHIP, AI, PHYSICS } from '../config';
import { getCurrentLevel, type LevelConfig } from '../state/LevelState';
import { DIFFICULTY, currentDifficulty } from '../state/Difficulty';
import { ParticleSystem3D } from '../systems/ParticleSystem3D';
import { createLevelEnvironment, type LevelEnvironment } from '../systems/EnvironmentLoader';
import { getSpawnTaunt } from '../config/VillainTaunts';

export interface ArenaState {
  player: Ship3D;
  enemies: Ship3D[];
  enemyAIs: AIBehavior3D[];
  boltPool: BoltPool;
  explosions: ExplosionPool;
  particles: ParticleSystem3D;
  environment: LevelEnvironment | null;
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
  // Slow-mo kill shot state
  slowMo: boolean;
  slowMoTimer: number;
  slowMoScale: number;
  // Villain taunt tracking
  villainIds: string[];
  spawnTauntFired: boolean;
  // Pause
  paused: boolean;
  // Whether slow-mo kill shot has already been triggered
  slowMoFired: boolean;
  // Target lock — index into enemies array, -1 = no lock
  lockedTargetIndex: number;
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
  playerGeo.visible = false;

  // ── Enemies — boss per level index, grunts for extras ──
  const levelConfig = getCurrentLevel();
  const enemies: Ship3D[] = [];
  const enemyAIs: AIBehavior3D[] = [];
  const villainIds: string[] = [];

  // Boss HP multipliers per level
  const BOSS_HP_MULT: Record<number, number> = { 1: 1.5, 2: 1.2, 3: 2.0 };

  for (let i = 0; i < levelConfig.enemyCount; i++) {
    const enemyGeo = createEnemyShipGeometry();
    const isBoss = (i === levelConfig.enemyCount - 1); // last enemy is the boss
    const bossScale = isBoss ? 3.5 : 3;
    enemyGeo.scale.set(bossScale, bossScale, bossScale);
    applyMaterials(enemyGeo, createEnemyMaterials());

    // Spawn at visible mid-range — close enough to see, far enough to chase
    const angle = Math.random() * Math.PI * 2;
    const baseDist = 600 + level * 200; // L1: 800, L2: 1000, L3: 1200
    const dist = baseDist + Math.random() * 400;
    const elevation = (Math.random() - 0.5) * 60 + i * 25;
    enemyGeo.position.set(
      Math.cos(angle) * dist,
      elevation,
      Math.sin(angle) * dist,
    );
    enemyGeo.lookAt(0, 0, 0);
    scene.add(enemyGeo);

    const hpMult = isBoss ? (BOSS_HP_MULT[level] ?? 1.5) : 1;
    const enemy = new Ship3D({
      group: enemyGeo,
      maxHull: Math.round(diff.enemyHull * levelConfig.enemySpeedBonus * hpMult),
      maxShield: diff.enemyShield * (isBoss ? 1.5 : 1),
      speedMult: diff.enemySpeedMult * levelConfig.enemySpeedBonus,
      rotationMult: diff.enemyRotationMult * levelConfig.enemyRotationBonus,
      isPlayer: false,
    });
    enemies.push(enemy);

    // Create the right AI — boss AI for the boss, Rusty for grunts
    let ai: AIBehavior3D;
    if (isBoss) {
      switch (level) {
        case 1:
          ai = new BoloTieBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
          );
          villainIds.push('bolo_tie');
          break;
        case 2:
          ai = new BowTieBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
          );
          villainIds.push('bow_tie');
          break;
        case 3:
          ai = new BishopBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
          );
          villainIds.push('bishop');
          break;
        default:
          ai = new RustyBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
          );
          villainIds.push('');
      }
    } else {
      ai = new RustyBehavior3D(
        AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
        diff.enemyFireRate * levelConfig.enemyFireRateBonus,
        diff.enemyChaseRange,
      );
      // Grunts use the villain id from earlier levels
      villainIds.push(i === 0 && level >= 2 ? 'bolo_tie' : i === 1 && level >= 3 ? 'bow_tie' : '');
    }
    enemyAIs.push(ai);
  }

  // ── Level Environment ──
  const environment = createLevelEnvironment(scene, level);

  // ── Systems ──
  const boltPool = new BoltPool(scene);
  const explosions = new ExplosionPool();
  const particles = new ParticleSystem3D(scene);
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = new SoundSystem();
  sound.init();
  // Music already playing from title screen — don't restart

  return {
    player, enemies, enemyAIs,
    boltPool, explosions, particles, environment,
    cockpitCam, touchControls, mouseControls, sound,
    camera,
    score: previousScore,
    levelConfig,
    gameOver: false,
    gameOverTime: 0,
    victory: false,
    victoryTime: 0,
    slowMo: false,
    slowMoTimer: 0,
    slowMoScale: 1,
    villainIds,
    spawnTauntFired: false,
    paused: false,
    slowMoFired: false,
    lockedTargetIndex: -1,
  };
}

export function updateArena(
  state: ArenaState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
  tauntCallback?: (villainId: string, event: string) => void,
): void {
  try {
  if (state.paused || state.gameOver || state.victory) return;

  // ── Slow-mo time scaling ──
  if (state.slowMo) {
    state.slowMoTimer -= dt;
    if (state.slowMoTimer <= 0) {
      state.slowMo = false;
      state.slowMoScale = 1;
      state.sound.restoreMusic();
    } else {
      state.slowMoScale = 0.3; // 30% speed
    }
  }
  const effectiveDt = dt * state.slowMoScale;

  const { player, enemies, enemyAIs, boltPool, explosions, particles, cockpitCam, touchControls, mouseControls } = state;

  // ── Player input ──
  // Desktop: Arrow keys move, Space fires, E=thrust, D=reverse
  // Mobile: touch joystick aims, fire/thrust/reverse buttons
  const touch = touchControls.getInput();

  // Yaw: ArrowLeft / ArrowRight on desktop, touch joystick X on mobile
  const keyYaw = (keys['ArrowRight'] ? 1 : 0) + (keys['ArrowLeft'] ? -1 : 0);

  // Pitch: ArrowUp = nose DOWN, ArrowDown = nose UP (inverted Y-axis, flight-sim style)
  const keyPitch = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? 1 : 0);
  const touchPitch = Math.abs(touch.pitch) > 0 ? -touch.pitch : 0;

  // Thrust: E=forward, D=reverse on desktop, touch buttons on mobile
  const keyThrust = (keys['KeyE'] ? 1 : 0) + (keys['KeyD'] ? -1 : 0);
  const combinedThrust = Math.max(-1, Math.min(1, keyThrust + touch.thrust));

  const input: ShipInput = {
    yaw: Math.max(-1, Math.min(1, keyYaw + touch.yaw)),
    pitch: Math.max(-1, Math.min(1, keyPitch + touchPitch)),
    roll: 0,
    thrust: combinedThrust,
  };

  // ── Target lock — F key cycles through on-screen enemies ──
  const cam = state.camera;
  const visibleIndices: number[] = [];
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].alive) continue;
    const proj = enemies[i].position.clone().project(cam);
    if (proj.z < 1 && proj.x > -1.2 && proj.x < 1.2 && proj.y > -1.2 && proj.y < 1.2) {
      visibleIndices.push(i);
    }
  }

  if (keys['KeyF']) {
    keys['KeyF'] = false; // consume the press so it doesn't repeat
    if (visibleIndices.length > 0) {
      const curPos = visibleIndices.indexOf(state.lockedTargetIndex);
      state.lockedTargetIndex = visibleIndices[(curPos + 1) % visibleIndices.length];
    }
  }

  // Clear lock if target is dead or no longer on screen
  if (state.lockedTargetIndex >= 0) {
    const locked = enemies[state.lockedTargetIndex];
    if (!locked || !locked.alive || !visibleIndices.includes(state.lockedTargetIndex)) {
      state.lockedTargetIndex = -1;
    }
  }

  // Auto-lock first visible enemy if no lock set
  if (state.lockedTargetIndex < 0 && visibleIndices.length > 0) {
    state.lockedTargetIndex = visibleIndices[0];
  }

  // ── Player weapons — fire at locked target ──
  if (keys['Space'] || touch.fire) {
    const target = state.lockedTargetIndex >= 0 ? enemies[state.lockedTargetIndex] : undefined;
    if (tryFireWeapon(player, boltPool, now, undefined, target)) {
      state.sound.playerShoot();
    }
  }

  // Draw touch controls (only visible on touch devices)
  touchControls.draw();

  // ── Enemy AI + weapons ──
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    const aiInput = enemyAIs[i].update(enemy, player, effectiveDt, now);
    if (aiInput.fire) {
      if (tryFireWeapon(enemy, boltPool, now, undefined, player)) {
        state.sound.enemyShoot();
      }
    }
    // AI directly controls enemy position — skip physics
  }

  // ── Player physics ──
  applyShipPhysics(player, input, effectiveDt, now);

  // ── Bolts ──
  boltPool.update(effectiveDt);

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

      // DEATH — world-anchored explosion + destruction chunks + shockwave
      if (!evt.target.alive) {
        if (!evt.target.isPlayer) {
          const deathPos = evt.target.position.clone();
          explosions.spawnDeathWorld(deathPos, state.camera);
          particles.spawnDestruction(deathPos, 0x1a1a22); // enemy hull color
          particles.spawnShockwave(deathPos);
          state.score += 500;
          evt.target.group.visible = false;
        }
        state.sound.explosion();

        // ── PLAYER DEATH — massive full-screen explosion sequence ──
        // All effects use a CSS class so clearOverlay can bulk-remove them
        if (evt.target.isPlayer) {
          const overlay = document.getElementById('ui-overlay')!;
          cockpitCam.shake(5.0); // extreme shake

          // Blinding white flash
          const whiteFlash = document.createElement('div');
          whiteFlash.className = 'death-fx';
          whiteFlash.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:white;z-index:50;pointer-events:none;
            opacity:0.9;transition:opacity 1.5s ease-out;
          `;
          overlay.appendChild(whiteFlash);
          requestAnimationFrame(() => { whiteFlash.style.opacity = '0'; });
          setTimeout(() => { if (whiteFlash.parentNode) whiteFlash.remove(); }, 1600);

          // Multiple screen-center explosions — staggered (guard against stale overlay)
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              if (state.gameOver) { // only spawn if still in gameOver state
                explosions.spawnDeath(
                  cx + (Math.random() - 0.5) * 300,
                  cy + (Math.random() - 0.5) * 200,
                );
              }
            }, i * 200);
          }

          // Massive center fireball
          explosions.spawnAt(cx, cy, 500, 'boom1', 3.0);

          // Red damage vignette that lingers
          const deathVignette = document.createElement('div');
          deathVignette.className = 'death-fx';
          deathVignette.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            z-index:45;pointer-events:none;
            background:radial-gradient(ellipse at center, transparent 20%, rgba(200,0,0,0.5) 80%, rgba(100,0,0,0.8) 100%);
            transition:opacity 2.0s ease-out;
          `;
          overlay.appendChild(deathVignette);
          setTimeout(() => {
            if (deathVignette.parentNode) {
              deathVignette.style.opacity = '0';
              setTimeout(() => { if (deathVignette.parentNode) deathVignette.remove(); }, 2100);
            }
          }, 1500);

          // Screen crack overlay effect
          const cracks = document.createElement('div');
          cracks.className = 'death-fx';
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
            if (cracks.parentNode) {
              cracks.style.opacity = '0';
              setTimeout(() => { if (cracks.parentNode) cracks.remove(); }, 3100);
            }
          }, 2000);
        }
      }
    } catch (e) {
      console.error('Damage event error:', e);
    }
  }

  // ── Spawn taunt — only fires once at fight start ──
  if (tauntCallback && !state.spawnTauntFired) {
    state.spawnTauntFired = true;
    const bossIdx = enemies.length - 1;
    const vid = state.villainIds[bossIdx];
    if (vid) tauntCallback(vid, 'onSpawn');
  }

  // ── Ship-to-ship collisions ──
  for (let ci = 0; ci < enemies.length; ci++) {
    const enemy = enemies[ci];
    if (!enemy.alive) continue;
    if (checkShipCollision(player, enemy, SHIP.HITBOX_RADIUS)) {
      // Bolo Tie charge = 3x collision damage
      const ai = enemyAIs[ci];
      const isCharging = ai instanceof BoloTieBehavior3D && ai.isCharging;
      if (isCharging) {
        player.applyDamage(15, now); // extra charge damage
      }
      resolveShipCollision(player, enemy, SHIP.HITBOX_RADIUS, now);
      cockpitCam.shake(isCharging ? 2.0 : 0.5);
      state.sound.shipCollision();
    }
  }

  // ── Level environment update ──
  if (state.environment) {
    state.environment.update(effectiveDt, now, player, enemies, boltPool, state.camera, explosions);
  }

  // ── Explosions ──
  explosions.update(effectiveDt);

  // ── Particles ──
  particles.update(effectiveDt);

  // ── Camera ──
  cockpitCam.update(player, dt, input.yaw); // camera uses real dt for smooth feel

  // ── Win/Lose conditions (with delay for explosions to play) ──
  if (!player.alive && !state.gameOver) {
    state.gameOver = true;
    state.gameOverTime = now;
    // Music keeps playing through game over screen
  }

  const allEnemiesDead = enemies.every(e => !e.alive);
  if (allEnemiesDead && !state.victory) {
    if (!state.slowMoFired) {
      // First frame all dead — trigger slow-mo kill shot
      state.slowMoFired = true;
      state.slowMo = true;
      state.slowMoTimer = 1.5;
      state.slowMoScale = 0.3;
      state.sound.dropToHum();
    } else if (!state.slowMo) {
      // Slow-mo finished — trigger victory
      state.victory = true;
      state.victoryTime = now;
      state.slowMoScale = 1;
      state.sound.levelComplete();
    }
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
  state.particles.destroy();
  state.environment?.cleanup();
  // Safety: clear any fog left by nebula environment
  scene.fog = null;
}

