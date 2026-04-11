// ── Mars Launch Scene ─────────────────────────────────────
// Playable Mars canyon launch sequence.
// Player climbs from the landing pad through the canyon and
// into orbit. Atmosphere modifiers thin as altitude increases.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { CockpitCamera } from '../camera/CockpitCamera';
import { TouchControls3D } from '../ui/TouchControls3D';
import { MouseControls } from '../ui/MouseControls';
import { SoundSystem } from '../systems/SoundSystem';
import { HUD3D } from '../ui/HUD3D';
import { NavBeacon } from '../ui/NavBeacon';
import { createCanyonTerrain, type CanyonTerrain } from '../terrain/CanyonGeometry';
import {
  MARS_ATMOSPHERE,
  getAtmosphereModifiers,
  getAtmosphereVisuals,
} from '../systems/AtmosphereSystem';
import { applyShipPhysics, type ShipInput } from '../systems/PhysicsSystem3D';
import { createPlayerShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, applyMaterials } from '../ships/ShipMaterials';
import { currentCharacter, CHARACTERS } from '../state/Character';
import { DIFFICULTY, currentDifficulty } from '../state/Difficulty';
import { COLORS, SHIP } from '../config';
import { getInvertY } from '../state/Settings';

// ── State Interface ───────────────────────────────────────

export interface MarsLaunchState {
  player: Ship3D;
  cockpitCam: CockpitCamera;
  touchControls: TouchControls3D;
  mouseControls: MouseControls;
  sound: SoundSystem;
  hud: HUD3D;
  canyon: CanyonTerrain;
  nav: NavBeacon;
  camera: THREE.PerspectiveCamera;
  dustParticles: THREE.Points;
  altitude: number;
  phase: 'grounded' | 'climbing' | 'orbit';
  orbitReached: boolean;
  orbitTimer: number;
  promptEl: HTMLDivElement | null;
}

// ── createMarsLaunch ──────────────────────────────────────

export function createMarsLaunch(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): MarsLaunchState {
  // ── Background ──
  scene.background = new THREE.Color(0xcc2200); // vivid Mars red sky

  // ── Player ship (hidden — cockpit view) ──
  const diff = DIFFICULTY[currentDifficulty];
  const charColor = CHARACTERS[currentCharacter]?.color ?? COLORS.player;
  const playerGeo = createPlayerShipGeometry();
  applyMaterials(playerGeo, createPlayerMaterials(charColor));
  playerGeo.position.set(0, 15, -8000); // on the pad, deep inside the canyon
  playerGeo.visible = false;
  scene.add(playerGeo);

  const player = new Ship3D({
    group: playerGeo,
    maxHull: diff.playerHull,
    maxShield: diff.playerShield,
    speedMult: 100.0,  // rocket launch — 100x thrust
    rotationMult: 1.0,
    isPlayer: true,
  });

  // ── Canyon terrain ──
  const canyon = createCanyonTerrain(scene);
  scene.add(canyon.group);

  // (test cube removed — monolith is in CanyonGeometry)

  // ── Dust particles — soft circular texture ──
  const dustTexCanvas = document.createElement('canvas');
  dustTexCanvas.width = 32; dustTexCanvas.height = 32;
  const dCtx = dustTexCanvas.getContext('2d')!;
  const grad = dCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(180,100,60,0.5)');
  grad.addColorStop(0.5, 'rgba(180,100,60,0.15)');
  grad.addColorStop(1, 'rgba(180,100,60,0)');
  dCtx.fillStyle = grad;
  dCtx.fillRect(0, 0, 32, 32);
  const dustTex = new THREE.CanvasTexture(dustTexCanvas);

  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 300;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3]     = (Math.random() - 0.5) * 160;
    dustPositions[i * 3 + 1] = Math.random() * 80;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    map: dustTex,
    size: 2.5,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(dustParticles);

  // ── Systems ──
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = SoundSystem.getInstance();
  sound.init();
  sound.startWindDrone();

  // ── HUD ──
  const hud = new HUD3D();
  hud.setMissionPhase('launch');

  // ── Nav beacon — points to orbit (straight up from pad) ──
  const nav = new NavBeacon('ORBIT');
  nav.setTarget(new THREE.Vector3(0, MARS_ATMOSPHERE.maxAltitude, -8000));

  // ── Launch prompt DOM element ──
  const promptEl = document.createElement('div');
  promptEl.textContent = 'HOLD THRUST TO LAUNCH';
  promptEl.style.cssText = `
    position: fixed;
    bottom: 30%;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display, 'Rajdhani', sans-serif);
    font-size: 22px;
    font-weight: 700;
    color: #00ffff;
    letter-spacing: 4px;
    text-align: center;
    pointer-events: none;
    z-index: 20;
    text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
    animation: marsPromptFadeIn 0.8s ease-out forwards;
  `;

  // Inject keyframes if not already present
  if (!document.getElementById('mars-launch-styles')) {
    const style = document.createElement('style');
    style.id = 'mars-launch-styles';
    style.textContent = `
      @keyframes marsPromptFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
      }
      @keyframes marsPromptFadeOut {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const uiOverlay = document.getElementById('ui-overlay') ?? document.body;
  uiOverlay.appendChild(promptEl);

  return {
    player,
    cockpitCam,
    touchControls,
    mouseControls,
    sound,
    hud,
    nav,
    canyon,
    camera,
    dustParticles,
    altitude: 0,
    phase: 'grounded',
    orbitReached: false,
    orbitTimer: 0,
    promptEl,
  };
}

// ── updateMarsLaunch ──────────────────────────────────────

export function updateMarsLaunch(
  state: MarsLaunchState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
  scene: THREE.Scene,
): void {
  if (state.orbitReached) return;

  const { player, cockpitCam, touchControls, mouseControls, sound, hud } = state;

  // ── Input (mirrors ArenaLoop pattern) ──
  const touch = touchControls.getInput();

  const keyYaw   = (keys['ArrowRight'] ? 1 : 0) + (keys['ArrowLeft']  ? -1 : 0);
  const rawKeyPitch = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? 1 : 0);
  const keyPitch = getInvertY() ? -rawKeyPitch : rawKeyPitch;
  const keyThrust = (keys['KeyE'] ? 1 : 0) + (keys['KeyD'] ? -1 : 0);

  const combinedThrust = Math.max(-1, Math.min(1, keyThrust + touch.thrust));

  const input: ShipInput = {
    yaw:    Math.max(-1, Math.min(1, keyYaw   + touch.yaw)),
    pitch:  Math.max(-1, Math.min(1, keyPitch + touch.pitch)),
    roll:   0,
    thrust: combinedThrust,
  };

  // ── First thrust → transition grounded → climbing, fade prompt, ignite engine ──
  if (state.phase === 'grounded' && combinedThrust > 0) {
    state.phase = 'climbing';
    sound.startLaunchEngine();
    if (state.promptEl) {
      state.promptEl.style.animation = 'marsPromptFadeOut 0.6s ease-out forwards';
      setTimeout(() => {
        if (state.promptEl && state.promptEl.parentNode) {
          state.promptEl.remove();
          state.promptEl = null;
        }
      }, 650);
    }
  }

  // ── Altitude ──
  state.altitude = player.position.y;

  // ── Atmosphere modifiers ──
  const atmosMods = getAtmosphereModifiers(MARS_ATMOSPHERE, state.altitude);

  // ── Physics ──
  applyShipPhysics(player, input, dt, now, atmosMods);

  // ── Floor/surface collision — hitting Mars at speed = death ──
  if (player.position.y < 0) {
    const impactSpeed = Math.abs(player.velocity.y);
    player.position.y = 0;
    player.velocity.y = 0;
    if (impactSpeed > 40) {
      player.applyDamage(9999, now);
      cockpitCam.shake(5.0);
      sound.explosion();
    }
  }

  // ── Canyon wall collision — high speed = death ──
  const wallHalfWidth = 35 + state.altitude * 0.1;
  if (player.position.x < -wallHalfWidth) {
    const wallSpeed = Math.abs(player.velocity.x);
    player.position.x = -wallHalfWidth;
    if (player.velocity.x < 0) player.velocity.x = Math.abs(player.velocity.x) * 0.5;
    if (wallSpeed > 40) {
      player.applyDamage(9999, now);
      cockpitCam.shake(5.0);
      sound.explosion();
    } else {
      player.applyDamage(2, now);
      cockpitCam.shake(0.8);
    }
  } else if (player.position.x > wallHalfWidth) {
    const wallSpeed = Math.abs(player.velocity.x);
    player.position.x = wallHalfWidth;
    if (player.velocity.x > 0) player.velocity.x = -Math.abs(player.velocity.x) * 0.5;
    if (wallSpeed > 40) {
      player.applyDamage(9999, now);
      cockpitCam.shake(5.0);
      sound.explosion();
    } else {
      player.applyDamage(2, now);
      cockpitCam.shake(0.8);
    }
  }

  // ── Sky color from atmosphere visuals ──
  const visuals = getAtmosphereVisuals(MARS_ATMOSPHERE, state.altitude);
  if (scene.background instanceof THREE.Color) {
    scene.background.copy(visuals.skyColor);
  } else {
    scene.background = visuals.skyColor.clone();
  }

  // ── Dust particles ──
  const dustMat = state.dustParticles.material as THREE.PointsMaterial;
  dustMat.opacity = visuals.particleDensity * 0.4;

  // Move dust cloud with the player (offset so player is inside it)
  state.dustParticles.position.copy(player.position);

  // ── Wind intensity ──
  const windT = state.altitude / MARS_ATMOSPHERE.maxAltitude;
  sound.setWindIntensity(Math.min(1, windT));

  // ── Launch engine intensity — ramps with altitude ──
  if (state.phase === 'climbing') {
    sound.setLaunchEngineIntensity(Math.min(1, windT * 1.5));
  }

  // ── Nav beacon ──
  state.nav.update(state.camera, player.position);

  // ── Touch controls ──
  touchControls.draw();

  // ── Camera ──
  cockpitCam.update(player, dt, input.yaw);

  // ── HUD ──
  hud.updateAltitude(state.altitude);

  // ── Orbit check ──
  if (state.altitude >= MARS_ATMOSPHERE.maxAltitude) {
    state.orbitReached = true;
    state.orbitTimer = now;
    state.phase = 'orbit';
    sound.stopWindDrone();
    sound.stopLaunchEngine();
  }
}

// ── cleanupMarsLaunch ─────────────────────────────────────

export function cleanupMarsLaunch(
  state: MarsLaunchState,
  scene: THREE.Scene,
): void {
  // Remove player and dust from scene
  scene.remove(state.player.group);
  scene.remove(state.dustParticles);

  // Dispose dust geometry + material
  state.dustParticles.geometry.dispose();
  (state.dustParticles.material as THREE.PointsMaterial).dispose();

  // Canyon cleanup (removes lights + disposes geometry/materials)
  state.canyon.cleanup();
  scene.remove(state.canyon.group);

  // UI cleanup
  state.touchControls.destroy();
  state.hud.destroy();
  state.nav.destroy();

  // Remove prompt if still in DOM
  if (state.promptEl && state.promptEl.parentNode) {
    state.promptEl.remove();
    state.promptEl = null;
  }

  // Stop wind drone and launch engine
  state.sound.stopWindDrone();
  state.sound.stopLaunchEngine();
}
