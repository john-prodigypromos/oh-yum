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
import type { AIBehavior3D, AIConfig } from '../ai/AIBehavior3D';
import { createPlayerShipGeometry, createEnemyShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, createEnemyMaterials, applyMaterials } from '../ships/ShipMaterials';
import { TouchControls3D } from '../ui/TouchControls3D';
import { MouseControls } from '../ui/MouseControls';
import { SoundSystem } from '../systems/SoundSystem';
import { SHIP, AI, PHYSICS, WEAPONS } from '../config';
import { getCurrentLevel, type LevelConfig } from '../state/LevelState';
import { DIFFICULTY, currentDifficulty } from '../state/Difficulty';
import { ParticleSystem3D } from '../systems/ParticleSystem3D';
import { createLevelEnvironment, type LevelEnvironment } from '../systems/EnvironmentLoader';
import { getSpawnTaunt } from '../config/VillainTaunts';

// Pre-allocated vectors for hot-path calculations (avoid GC pressure)
const _projTmp = new THREE.Vector3();

// DOM overlay pool for damage effects — prevents DOM flooding
const MAX_OVERLAYS = 8;
const _overlayPool: HTMLDivElement[] = [];
let _overlayIdx = 0;
function getDamageOverlay(): HTMLDivElement {
  if (_overlayPool.length < MAX_OVERLAYS) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;display:none;';
    document.getElementById('ui-overlay')?.appendChild(el);
    _overlayPool.push(el);
  }
  // Round-robin reuse — oldest overlay gets recycled
  const el = _overlayPool[_overlayIdx % MAX_OVERLAYS];
  _overlayIdx++;
  el.style.display = 'block';
  el.style.opacity = '1';
  return el;
}
function releaseDamageOverlay(el: HTMLDivElement, delayMs: number): void {
  setTimeout(() => { el.style.display = 'none'; }, delayMs);
}

// ── Player-death visuals: fullscreen fire flash + screen-spread explosions ──
// Used when the player is killed by an enemy bolt OR crashes into a celestial body.
function spawnPlayerDeathFireFlash(overlay: HTMLElement): void {
  const fireFlash = document.createElement('div');
  fireFlash.className = 'death-fx';
  fireFlash.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'background:' +
    'radial-gradient(ellipse at 30% 35%, rgba(255,240,160,0.55) 0%, rgba(255,140,40,0) 42%),' +
    'radial-gradient(ellipse at 70% 60%, rgba(255,200,80,0.55) 0%, rgba(255,100,20,0) 45%),' +
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,210,0.95) 0%, rgba(255,210,70,0.92) 14%, rgba(255,140,40,0.88) 30%, rgba(255,70,20,0.78) 55%, rgba(160,30,10,0.65) 80%, rgba(40,8,0,0.5) 100%);' +
    'z-index:50;pointer-events:none;opacity:1;transition:opacity 2.5s ease-out;';
  overlay.appendChild(fireFlash);
  requestAnimationFrame(() => { fireFlash.style.opacity = '0'; });
  setTimeout(() => fireFlash.remove(), 2700);
}

function spawnPlayerDeathScreenExplosions(explosions: ExplosionPool): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2, cy = h / 2;
  // Center mega-blast
  explosions.spawnAt(cx, cy, 1400, 'boom1', 6.0);
  // Spread fireballs across the whole screen — covers the entire view in flame
  explosions.spawnAt(w * 0.20, h * 0.30, 900, 'boom1', 4.5);
  explosions.spawnAt(w * 0.80, h * 0.30, 900, 'boom1', 4.5);
  explosions.spawnAt(w * 0.20, h * 0.70, 900, 'boom1', 4.5);
  explosions.spawnAt(w * 0.80, h * 0.70, 900, 'boom1', 4.5);
  explosions.spawnAt(w * 0.50, h * 0.18, 800, 'boom1', 4.0);
  explosions.spawnAt(w * 0.50, h * 0.82, 800, 'boom1', 4.0);
  explosions.spawnAt(w * 0.10, h * 0.50, 700, 'boom1', 3.8);
  explosions.spawnAt(w * 0.90, h * 0.50, 700, 'boom1', 3.8);
  // Staggered second wave so the fire sustains
  setTimeout(() => {
    explosions.spawnAt(w * 0.35, h * 0.40, 850, 'boom1', 4.0);
    explosions.spawnAt(w * 0.65, h * 0.60, 850, 'boom1', 4.0);
  }, 180);
  setTimeout(() => {
    explosions.spawnAt(cx, cy, 1100, 'boom1', 5.0);
  }, 380);
}

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
  // Grace period — enemies don't engage for the first few seconds
  roundStartTime: number;
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
  const aiCfg: AIConfig = {
    sensitivity: diff.aiSensitivity,
    aggression: diff.aiAggression,
    jinkIntensity: diff.aiJinkIntensity,
    leashRange: diff.aiLeashRange,
    fireCone: diff.aiFireCone,
  };
  const player = new Ship3D({
    group: playerGeo,
    maxHull: diff.playerHull,
    maxShield: diff.playerShield,
    // Player speed boost — lets the player run down enemies whose
    // speedMult ranges 1.0 (beginner) to 1.20 (expert).
    speedMult: 1.4,
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

    // Spawn within leash range — fight starts immediately
    const angle = Math.random() * Math.PI * 2;
    const baseDist = 80 + level * 20; // L1: 100, L2: 120, L3: 140
    const dist = baseDist + Math.random() * 30;
    const elevation = (Math.random() - 0.5) * 40 + i * 20;
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
    // Give enemies initial forward velocity so they're already flying
    const initFwd = enemy.getForward();
    enemy.velocity.copy(initFwd).multiplyScalar(40 * enemy.speedMult);
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
            aiCfg,
          );
          villainIds.push('bolo_tie');
          break;
        case 2:
          ai = new BowTieBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
            aiCfg,
          );
          villainIds.push('bow_tie');
          break;
        case 3:
          ai = new BishopBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
            aiCfg,
          );
          villainIds.push('bishop');
          break;
        default:
          ai = new RustyBehavior3D(
            AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
            diff.enemyFireRate * levelConfig.enemyFireRateBonus,
            diff.enemyChaseRange,
            aiCfg,
          );
          villainIds.push('');
      }
    } else {
      ai = new RustyBehavior3D(
        AI.RUSTY_AIM_ACCURACY * levelConfig.enemyRotationBonus,
        diff.enemyFireRate * levelConfig.enemyFireRateBonus,
        diff.enemyChaseRange,
        aiCfg,
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
  const explosions = new ExplosionPool(scene, camera);
  const particles = new ParticleSystem3D(scene);
  const cockpitCam = new CockpitCamera(camera);
  cockpitCam.snapTo(player);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = SoundSystem.getInstance();
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
    roundStartTime: performance.now(),
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
  // Desktop: Arrow keys + mouse move, Space fires, E=thrust, D=reverse
  // Mobile: touch joystick aims, fire/thrust/reverse buttons
  const touch = touchControls.getInput();
  const mouse = mouseControls.getInput();

  // Yaw: ArrowLeft / ArrowRight on desktop, touch joystick X, mouse X on mobile
  const keyYaw = (keys['ArrowRight'] ? 1 : 0) + (keys['ArrowLeft'] ? -1 : 0);

  // Pitch: Up = nose UP, Down = nose DOWN. Always.
  // Three.js: NEGATIVE rotation around local X = nose UP (right-hand rule).
  const keyPitch = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? 1 : 0);

  // Thrust: E=forward, D=reverse on desktop, touch buttons on mobile
  const keyThrust = (keys['KeyE'] ? 1 : 0) + (keys['KeyD'] ? -1 : 0);
  const combinedThrust = Math.max(-1, Math.min(1, keyThrust + touch.thrust));

  const input: ShipInput = {
    yaw: Math.max(-1, Math.min(1, keyYaw + touch.yaw + mouse.yaw)),
    pitch: Math.max(-1, Math.min(1, keyPitch + touch.pitch - mouse.verticalMove)),
    roll: 0,
    thrust: combinedThrust,
  };

  // ── Target lock — F key cycles through on-screen enemies within LOCK_RANGE ──
  const cam = state.camera;
  const visibleIndices: number[] = [];
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].alive) continue;
    if (enemies[i].position.distanceTo(player.position) > WEAPONS.LOCK_RANGE) continue;
    _projTmp.copy(enemies[i].position).project(cam);
    if (_projTmp.z < 1 && _projTmp.x > -1.2 && _projTmp.x < 1.2 && _projTmp.y > -1.2 && _projTmp.y < 1.2) {
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

  // ── Player weapons — fire at locked target only if in center 33% of screen ──
  if (keys['Space'] || touch.fire) {
    let fireTarget: Ship3D | undefined;
    let damageMod = 1;
    if (state.lockedTargetIndex >= 0) {
      const locked = enemies[state.lockedTargetIndex];
      if (locked && locked.alive) {
        const dist = locked.position.distanceTo(player.position);
        if (dist <= WEAPONS.LOCK_RANGE) {
          _projTmp.copy(locked.position).project(cam);
          // Only auto-aim if target is within center 45% of screen and within LOCK_RANGE
          if (Math.abs(_projTmp.x) < 0.45 && Math.abs(_projTmp.y) < 0.45 && _projTmp.z < 1) {
            fireTarget = locked;
            // Distance factor: 1.0 at ≤50m, ramps linearly to 0.4 at LOCK_RANGE
            const distFactor = dist <= 50
              ? 1
              : Math.max(0.4, 1 - ((dist - 50) / (WEAPONS.LOCK_RANGE - 50)) * 0.6);
            // Centering factor: 1.0 at dead center, ramps linearly to 0.6 at edge of 45% lock zone
            const centerDist = Math.max(Math.abs(_projTmp.x), Math.abs(_projTmp.y));
            const centerFactor = Math.max(0.6, 1 - (centerDist / 0.45) * 0.4);
            damageMod = distFactor * centerFactor;
          }
        }
      }
    }
    if (tryFireWeapon(player, boltPool, now, undefined, fireTarget, damageMod)) {
      state.sound.playerShoot();
    }
  }

  // Draw touch controls (only visible on touch devices)
  touchControls.draw();

  // ── Enemy AI + weapons + hard distance leash ──
  const LEASH_DIST = 350;   // max allowed distance from player
  const LEASH_FORCE = 300;  // pull strength when beyond leash
  const GRACE_PERIOD = 3500; // ms of peace before enemies engage
  const graceActive = (now - state.roundStartTime) < GRACE_PERIOD;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;

    const aiInput = enemyAIs[i].update(enemy, player, effectiveDt, now);
    // During grace period: no firing, cruise straight (no pursuit)
    if (graceActive) {
      aiInput.fire = false;
      aiInput.thrust = 0.3; // gentle cruise
      aiInput.yaw *= 0.2;   // minimal steering — lazy drift
      aiInput.pitch *= 0.2;
    }
    if (aiInput.fire) {
      if (tryFireWeapon(enemy, boltPool, now, undefined, player)) {
        state.sound.enemyShoot();
      }
    }
    // Apply physics so enemies fly with real velocity, drag, and momentum
    applyShipPhysics(enemy, aiInput, effectiveDt, now);

    // ── Hard proximity repulsion — push enemies away when too close ──
    _projTmp.subVectors(enemy.position, player.position);
    const dist = _projTmp.length();
    const MIN_DIST = 80; // hard minimum distance
    const SOFT_DIST = 120; // soft zone — gradually push away
    if (dist < MIN_DIST) {
      // Hard override — slam velocity directly away from player
      _projTmp.divideScalar(dist); // normalize away from player
      const pushSpeed = PHYSICS.MAX_VELOCITY * enemy.speedMult * 0.8;
      enemy.velocity.copy(_projTmp).multiplyScalar(pushSpeed);
    } else if (dist < SOFT_DIST) {
      // Soft push — blend away-velocity proportionally
      const blend = 1 - (dist - MIN_DIST) / (SOFT_DIST - MIN_DIST);
      _projTmp.divideScalar(dist);
      const pushSpeed = PHYSICS.MAX_VELOCITY * enemy.speedMult * 0.5 * blend;
      enemy.velocity.addScaledVector(_projTmp, pushSpeed);
    }

    // ── Hard physics leash — full velocity override when too far ──
    if (dist > LEASH_DIST) {
      _projTmp.subVectors(player.position, enemy.position);
      const d = _projTmp.length();
      _projTmp.divideScalar(d); // normalize toward player
      const returnSpeed = Math.min(d * 0.5, PHYSICS.MAX_VELOCITY * enemy.speedMult);
      enemy.velocity.copy(_projTmp).multiplyScalar(returnSpeed);
      enemy.group.lookAt(player.position);
    }
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
        cockpitCam.shake(isShield ? 2.5 : 5.0);
        if (isShield) state.sound.shieldHit();
        else state.sound.hullHit();

        // Full-screen damage flash — pooled overlay (reduced intensity)
        const flash = getDamageOverlay();
        const color = isShield
          ? 'rgba(0, 150, 255, 0.3)'
          : 'rgba(255, 160, 20, 0.35)';
        flash.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:${color};z-index:40;pointer-events:none;display:block;transition:opacity 0.7s ease-out;`;
        requestAnimationFrame(() => { flash.style.opacity = '0'; });
        releaseDamageOverlay(flash, 800);

        // Vignette or shimmer — single pooled overlay (reduced intensity)
        if (!isShield) {
          const vignette = getDamageOverlay();
          vignette.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:39;pointer-events:none;display:block;background:radial-gradient(ellipse at center, transparent 30%, rgba(255,140,0,0.25) 70%, rgba(200,60,0,0.35) 100%);transition:opacity 1.2s ease-out;`;
          requestAnimationFrame(() => { vignette.style.opacity = '0'; });
          releaseDamageOverlay(vignette, 1400);
        } else {
          const shimmer = getDamageOverlay();
          shimmer.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:39;pointer-events:none;display:block;border:6px solid rgba(0,180,255,0.4);box-shadow:inset 0 0 60px rgba(0,150,255,0.2), inset 0 0 100px rgba(0,100,255,0.1);transition:opacity 0.6s ease-out;`;
          requestAnimationFrame(() => { shimmer.style.opacity = '0'; });
          releaseDamageOverlay(shimmer, 700);
        }

        // Single directional hit streak — pooled (reduced opacity)
        const streak = getDamageOverlay();
        const sAngle = Math.random() * 360;
        const sColor = isShield ? 'rgba(0,200,255,0.4)' : 'rgba(255,80,0,0.45)';
        streak.style.cssText = `position:fixed;top:50%;left:50%;width:200vw;height:2px;display:block;transform:translate(-50%,-50%) rotate(${sAngle}deg);background:linear-gradient(90deg, transparent 20%, ${sColor} 50%, transparent 80%);z-index:41;pointer-events:none;transition:opacity 0.4s ease-out;`;
        requestAnimationFrame(() => { streak.style.opacity = '0'; });
        releaseDamageOverlay(streak, 500);

        // Critical damage warning — pooled (reduced)
        if (player.damagePct > 0.5) {
          const warning = getDamageOverlay();
          warning.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:38;pointer-events:none;display:block;background:radial-gradient(ellipse at center, transparent 30%, rgba(200,0,0,0.12) 100%);animation:critPulse 0.5s ease-in-out;`;
          releaseDamageOverlay(warning, 500);

          if (!document.getElementById('crit-pulse-css')) {
            const style = document.createElement('style');
            style.id = 'crit-pulse-css';
            style.textContent = `@keyframes critPulse { 0%,100%{opacity:0} 50%{opacity:1} }`;
            document.head.appendChild(style);
          }
        }
      }

      // Hit flash at the world-space impact point — sprite billboards itself
      if (!evt.target.isPlayer) {
        explosions.spawnHit(evt.target.position);
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

          // ── Enemy kill portrait flash + sustained explosion ──
          const killIdx = enemies.indexOf(evt.target);
          const killPortraitFiles = ['bolo-tie2.jpg', 'bow-tie2.jpg', 'bishop2.jpg'];
          const killFile = killPortraitFiles[killIdx];
          if (killFile) {
            const killOverlay = document.createElement('div');
            killOverlay.className = 'kill-overlay';
            killOverlay.style.cssText = `
              position:fixed;top:40px;left:50%;transform:translateX(-50%);
              width:min(450px,70vw);pointer-events:none;z-index:35;
              text-align:center;opacity:0.6;transition:opacity 3.5s ease-out;
            `;
            // Portrait image
            const killImg = document.createElement('img');
            killImg.src = `/portraits/${killFile}?v=3`;
            killImg.style.cssText = 'width:100%;height:auto;object-fit:cover;border-radius:50%;aspect-ratio:1;filter:grayscale(0.3) drop-shadow(0 0 40px rgba(255,0,0,0.4));border:3px solid rgba(255,50,0,0.3);';
            killOverlay.appendChild(killImg);

            // ELIMINATED text over portrait
            const killText = document.createElement('div');
            killText.textContent = 'ELIMINATED';
            killText.className = 'kill-overlay-text';
            killText.style.cssText = `
              position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
              font-family:var(--font-display);font-size:clamp(28px,6vw,48px);font-weight:900;
              letter-spacing:8px;color:#ff4444;
              text-shadow:0 0 20px rgba(255,0,0,0.8),0 0 60px rgba(255,0,0,0.4),0 2px 4px rgba(0,0,0,0.8);
              white-space:nowrap;
            `;
            killOverlay.appendChild(killText);
            document.getElementById('ui-overlay')?.appendChild(killOverlay);
            requestAnimationFrame(() => { killOverlay.style.opacity = '0'; });
            setTimeout(() => killOverlay.remove(), 4000);

            // Staggered explosions at the death position while portrait fades
            const dp = deathPos;
            const spawnDelayed = (delay: number) => {
              setTimeout(() => {
                explosions.spawnDeathWorld(dp, state.camera);
                state.sound.explosion();
              }, delay);
            };
            spawnDelayed(300);
            spawnDelayed(700);
            spawnDelayed(1200);
            spawnDelayed(1800);
          }
        }
        state.sound.explosion();

        // ── PLAYER DEATH — massive in-your-face fire explosion ──
        if (evt.target.isPlayer) {
          state.gameOver = true;
          state.gameOverTime = now;
          const overlay = document.getElementById('ui-overlay')!;
          cockpitCam.shake(7.0);
          setTimeout(() => state.sound.explosion(), 60);

          spawnPlayerDeathFireFlash(overlay);
          spawnPlayerDeathScreenExplosions(explosions);
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('Damage event error:', e);
    }
  }

  // ── Spawn taunt — only fires once at fight start ──
  if (tauntCallback && !state.spawnTauntFired) {
    state.spawnTauntFired = true;
    const bossIdx = enemies.length - 1;
    const vid = state.villainIds[bossIdx];
    if (vid) tauntCallback(vid, 'onSpawn');
  }

  // ── Ship-to-ship collisions (skip during grace period) ──
  for (let ci = 0; ci < enemies.length; ci++) {
    if (graceActive) break;
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
      cockpitCam.shake(isCharging ? 4.0 : 2.5);
      state.sound.shipCollision();
      state.sound.explosion();
      // In-your-face collision explosion
      const ccx = window.innerWidth / 2;
      const ccy = window.innerHeight / 2;
      explosions.spawnAt(ccx, ccy, 600, 'boom1', 4.0);
      explosions.spawnAt(ccx + (Math.random() - 0.5) * 200, ccy + (Math.random() - 0.5) * 150, 400, 'boom1', 3.0);
    }
  }

  // ── Level environment update ──
  if (state.environment) {
    state.environment.update(effectiveDt, now, player, enemies, boltPool, state.camera, explosions);
  }

  // ── Collision death — player killed by environment (asteroid/planet/black hole) ──
  if (!player.alive && !state.gameOver) {
    // Triple-layered explosion sound for massive impact
    state.sound.explosion();
    setTimeout(() => state.sound.explosion(), 80);
    setTimeout(() => state.sound.explosion(), 200);
    cockpitCam.shake(8.0);

    const overlay = document.getElementById('ui-overlay');
    if (overlay) {
      spawnPlayerDeathFireFlash(overlay);
      spawnPlayerDeathScreenExplosions(explosions);
    }

    state.gameOver = true;
    state.gameOverTime = now;
  }

  // ── Explosions ──
  explosions.update(effectiveDt);

  // ── Particles ──
  particles.update(effectiveDt);

  // ── Camera ──
  cockpitCam.update(player, dt, input.yaw); // camera uses real dt for smooth feel

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
    if (import.meta.env.DEV) console.error('Arena update error:', e);
  }
}

/** Remove all arena objects from the scene and release GPU resources.
 *  Disposes geometries + materials only — textures are intentionally kept
 *  (ShipMaterials caches normalMap/roughnessMap at module level). */
export function cleanupArena(state: ArenaState, scene: THREE.Scene): void {
  const disposeGroup = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose();
      }
    });
  };

  scene.remove(state.player.group);
  disposeGroup(state.player.group);
  for (const e of state.enemies) {
    scene.remove(e.group);
    disposeGroup(e.group);
  }
  for (const bolt of state.boltPool.bolts) {
    scene.remove(bolt.mesh);
    scene.remove(bolt.glow);
    disposeGroup(bolt.mesh);
    disposeGroup(bolt.glow);
  }
  state.particles.destroy();
  state.explosions.destroy();
  state.environment?.cleanup();
  // Safety: clear any fog left by nebula environment
  scene.fog = null;
}

