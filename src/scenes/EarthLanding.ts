// ── Earth Landing Scene ───────────────────────────────────
// Playable re-entry and spaceport approach sequence.
// Player descends from orbit through the atmosphere, passes
// the cloud layer, follows guide rings down to the landing pad.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { CockpitCamera } from '../camera/CockpitCamera';
import { TouchControls3D } from '../ui/TouchControls3D';
import { MouseControls } from '../ui/MouseControls';
import { SoundSystem } from '../systems/SoundSystem';
import { HUD3D } from '../ui/HUD3D';
import { createSpaceportTerrain, type SpaceportTerrain } from '../terrain/SpaceportGeometry';
import { createPlayerShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, applyMaterials } from '../ships/ShipMaterials';
import { EARTH_ATMOSPHERE, getAtmosphereModifiers, getAtmosphereVisuals } from '../systems/AtmosphereSystem';
import { applyShipPhysics, type ShipInput } from '../systems/PhysicsSystem3D';
import { COLORS } from '../config';
import { currentCharacter } from '../state/Character';

// ── Constants ──────────────────────────────────────────────

const CLOUD_ALTITUDE = 1200;
const REENTRY_START = 2200;
const LAND_THRESHOLD = 5;

// ── Types ──────────────────────────────────────────────────

export interface EarthLandingState {
  player: Ship3D;
  cockpitCam: CockpitCamera;
  touchControls: TouchControls3D;
  mouseControls: MouseControls;
  sound: SoundSystem;
  hud: HUD3D;
  spaceport: SpaceportTerrain;
  camera: THREE.PerspectiveCamera;
  cloudLayer: THREE.Mesh;
  reentryOverlay: HTMLDivElement | null;
  altitude: number;
  phase: 'approach' | 'reentry' | 'belowClouds' | 'landing' | 'landed';
  landedTimer: number;
  missionText: HTMLDivElement | null;
}

// ── createEarthLanding ─────────────────────────────────────

export function createEarthLanding(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  previousScore: number,
): EarthLandingState {
  // ── Space background ──
  scene.background = new THREE.Color(0x010208);

  // ── Player ship ──
  const playerColor = currentCharacter === 'william' ? 0xccaa44 : COLORS.player;
  const shipGeo = createPlayerShipGeometry();
  applyMaterials(shipGeo, createPlayerMaterials(playerColor));
  shipGeo.scale.set(3, 3, 3);
  shipGeo.visible = false; // cockpit view — ship body hidden
  scene.add(shipGeo);

  const player = new Ship3D({
    group: shipGeo,
    maxHull: 100,
    maxShield: 50,
    speedMult: 1,
    rotationMult: 1,
    isPlayer: true,
  });

  // Start high above spaceport, approaching from orbit
  player.position.set(0, EARTH_ATMOSPHERE.maxAltitude, -300);

  // Pitch ship downward to point nose toward the ground
  const pitchDown = new THREE.Quaternion();
  pitchDown.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI * 0.35);
  player.group.quaternion.copy(pitchDown);

  // Initial descent velocity
  player.velocity.set(0, -8, 0);

  // ── Spaceport terrain ──
  const spaceport = createSpaceportTerrain(scene);

  // ── Cloud layer ──
  const cloudGeo = new THREE.PlaneGeometry(8000, 8000);
  cloudGeo.rotateX(-Math.PI / 2);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xffffff),
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cloudLayer = new THREE.Mesh(cloudGeo, cloudMat);
  cloudLayer.position.y = CLOUD_ALTITUDE;
  scene.add(cloudLayer);

  // ── Systems ──
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = new SoundSystem();
  sound.init();

  const hud = new HUD3D();
  hud.setMissionPhase('landing');

  // ── Mission text ──
  const missionText = document.createElement('div');
  missionText.textContent = 'MISSION COMPLETE — RETURN HOME';
  missionText.style.cssText = `
    position: fixed;
    top: 22%;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display, 'Rajdhani', sans-serif);
    font-size: clamp(18px, 3vw, 28px);
    font-weight: 700;
    color: #ffd700;
    letter-spacing: 4px;
    text-align: center;
    pointer-events: none;
    z-index: 30;
    text-shadow: 0 0 16px rgba(255, 215, 0, 0.6), 0 0 32px rgba(255, 180, 0, 0.3);
    animation: missionTextFadeIn 2s ease-out 0.5s both;
  `;

  // Inject the fadeIn keyframe if not already present
  if (!document.getElementById('earth-landing-styles')) {
    const style = document.createElement('style');
    style.id = 'earth-landing-styles';
    style.textContent = `
      @keyframes missionTextFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('ui-overlay')?.appendChild(missionText);

  // Auto-fade mission text after 4s (0.5s delay + 2s fade + 1.5s hold)
  setTimeout(() => {
    if (missionText.parentNode) {
      missionText.style.transition = 'opacity 1s ease-out';
      missionText.style.opacity = '0';
      setTimeout(() => missionText.remove(), 1000);
    }
  }, 4000);

  return {
    player,
    cockpitCam,
    touchControls,
    mouseControls,
    sound,
    hud,
    spaceport,
    camera,
    cloudLayer,
    reentryOverlay: null,
    altitude: EARTH_ATMOSPHERE.maxAltitude,
    phase: 'approach',
    landedTimer: 0,
    missionText,
  };
}

// ── updateEarthLanding ─────────────────────────────────────

export function updateEarthLanding(
  state: EarthLandingState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
  scene: THREE.Scene,
): void {
  // ── Landed — just count time ──
  if (state.phase === 'landed') {
    state.landedTimer += dt;
    return;
  }

  // ── Read input ──
  const touchInput = state.touchControls.getInput();
  const mouseInput = state.mouseControls.getInput();

  const input: ShipInput = {
    yaw:    touchInput.yaw    || mouseInput.yaw,
    pitch:  touchInput.pitch  || 0,
    roll:   0,
    thrust: touchInput.thrust ||
            (keys['KeyE'] ? 1 : 0) +
            (keys['KeyD'] ? -1 : 0),
  };

  // ── Altitude ──
  state.altitude = state.player.position.y;

  // ── Atmosphere physics ──
  const atmoMods = getAtmosphereModifiers(EARTH_ATMOSPHERE, state.altitude);
  applyShipPhysics(state.player, input, dt, now, atmoMods);

  // ── Phase transitions ──

  if (state.phase === 'approach' && state.altitude <= REENTRY_START) {
    state.phase = 'reentry';
    state.sound.reentryRoar();
    state.cockpitCam.shake(3.5);

    // Create orange re-entry glow overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 15;
      box-shadow: inset 0 0 200px 60px rgba(255, 100, 20, 0.55);
      transition: opacity 1.5s ease-out;
    `;
    document.getElementById('ui-overlay')?.appendChild(overlay);
    state.reentryOverlay = overlay;
  }

  if (state.phase === 'reentry' && state.altitude <= CLOUD_ALTITUDE) {
    state.phase = 'belowClouds';

    // Fade out re-entry overlay
    if (state.reentryOverlay) {
      state.reentryOverlay.style.opacity = '0';
      const overlayRef = state.reentryOverlay;
      setTimeout(() => overlayRef.remove(), 1500);
      state.reentryOverlay = null;
    }

    // Reveal guide path rings
    state.spaceport.guidePathGroup.visible = true;

    state.sound.startWindDrone();
  }

  if (state.phase === 'belowClouds' && state.altitude <= 200) {
    state.phase = 'landing';
  }

  // ── Gentle auto-correction toward pad below 300m ──
  if (state.altitude < 300) {
    const pos = state.player.position;
    const distXZ = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (distXZ > 5) {
      const correctionStrength = 0.4 * (1 - state.altitude / 300);
      state.player.velocity.x += (-pos.x / distXZ) * correctionStrength * dt * 30;
      state.player.velocity.z += (-pos.z / distXZ) * correctionStrength * dt * 30;
    }
  }

  // ── Auto-flare near ground ──
  if (state.altitude < 15 && state.player.velocity.y < -5) {
    state.player.velocity.y *= 0.8;
  }

  // ── Touchdown ──
  if (
    state.player.position.y <= LAND_THRESHOLD &&
    (state.phase === 'landing' || state.phase === 'belowClouds')
  ) {
    state.player.position.y = LAND_THRESHOLD;
    state.player.velocity.set(0, 0, 0);
    state.phase = 'landed';
    state.altitude = LAND_THRESHOLD;

    state.sound.touchdown();
    setTimeout(() => { state.sound.landingFanfare(); }, 1000);
  }

  // ── Sky color from atmosphere visuals ──
  const visuals = getAtmosphereVisuals(EARTH_ATMOSPHERE, state.altitude);
  if (scene.background instanceof THREE.Color) {
    (scene.background as THREE.Color).copy(visuals.skyColor);
  }

  // ── Wind intensity below clouds ──
  if (state.phase === 'belowClouds' || state.phase === 'landing') {
    const windT = Math.max(0, 1 - state.altitude / CLOUD_ALTITUDE);
    state.sound.setWindIntensity(windT);
  }

  // ── Pad ring pulse ──
  if (state.spaceport.padRing) {
    const ring = state.spaceport.padRing;
    if (ring.material instanceof THREE.MeshStandardMaterial) {
      ring.material.emissiveIntensity = 0.4 + Math.sin(now * 0.003) * 0.3;
    }
  }

  // ── Draw touch controls ──
  state.touchControls.draw();

  // ── Camera ──
  state.cockpitCam.update(state.player, dt, input.yaw);

  // ── HUD altitude ──
  state.hud.updateAltitude(state.altitude);
}

// ── isLandingComplete ──────────────────────────────────────

export function isLandingComplete(state: EarthLandingState): boolean {
  return state.phase === 'landed' && state.landedTimer > 4;
}

// ── cleanupEarthLanding ────────────────────────────────────

export function cleanupEarthLanding(
  state: EarthLandingState,
  scene: THREE.Scene,
): void {
  // Remove player ship from scene
  scene.remove(state.player.group);

  // Remove cloud layer
  scene.remove(state.cloudLayer);
  (state.cloudLayer.material as THREE.Material).dispose();
  state.cloudLayer.geometry.dispose();

  // Cleanup spaceport terrain
  state.spaceport.cleanup();

  // Destroy UI systems
  state.touchControls.destroy();
  state.hud.destroy();

  // Remove reentry overlay if still present
  if (state.reentryOverlay && state.reentryOverlay.parentNode) {
    state.reentryOverlay.remove();
    state.reentryOverlay = null;
  }

  // Remove mission text if still in DOM
  if (state.missionText && state.missionText.parentNode) {
    state.missionText.remove();
  }

  // Stop wind drone
  state.sound.stopWindDrone();
}
