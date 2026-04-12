// ── Mars Landing Scene ────────────────────────────────────
// Final chapter: after beating 3 villains, player returns home
// to Mars. Guided descent through Mars atmosphere into the
// canyon, landing on the pad near the secret base.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { CockpitCamera } from '../camera/CockpitCamera';
import { TouchControls3D } from '../ui/TouchControls3D';
import { MouseControls } from '../ui/MouseControls';
import { SoundSystem } from '../systems/SoundSystem';
import { HUD3D } from '../ui/HUD3D';
import { NavBeacon } from '../ui/NavBeacon';
import { createCanyonTerrain, type CanyonTerrain } from '../terrain/CanyonGeometry';
import { createPlayerShipGeometry } from '../ships/ShipGeometry';
import { createPlayerMaterials, applyMaterials } from '../ships/ShipMaterials';
import { MARS_ATMOSPHERE, getAtmosphereModifiers, getAtmosphereVisuals } from '../systems/AtmosphereSystem';
import { applyShipPhysics, type ShipInput } from '../systems/PhysicsSystem3D';
import { COLORS } from '../config';
import { currentCharacter, CHARACTERS } from '../state/Character';
// Y-axis: up = nose up, always. No invert option.
import { GuidePath } from '../ui/GuidePath';

// ── Constants ──────────────────────────────────────────────

const PAD_POSITION = new THREE.Vector3(0, 0, -8000); // landing pad in the canyon
const LAND_THRESHOLD = 8;
const DUST_CEILING = 3000;

// ── Types ──────────────────────────────────────────────────

export interface MarsLandingState {
  player: Ship3D;
  cockpitCam: CockpitCamera;
  touchControls: TouchControls3D;
  mouseControls: MouseControls;
  sound: SoundSystem;
  hud: HUD3D;
  nav: NavBeacon;
  canyon: CanyonTerrain;
  camera: THREE.PerspectiveCamera;
  dustParticles: THREE.Points;
  altitude: number;
  phase: 'approach' | 'atmosphere' | 'canyon' | 'landing' | 'landed' | 'caveReveal';
  landedTimer: number;
  missionText: HTMLDivElement | null;
  caveRevealTimer: number;
  elapsedTime: number;
  guidePath: GuidePath;
}

// ── createMarsLanding ─────────────────────────────────────

export function createMarsLanding(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): MarsLandingState {
  // ── Background — space black initially ──
  scene.background = new THREE.Color(0x010208);

  // ── Player ship ──
  const charColor = CHARACTERS[currentCharacter]?.color ?? COLORS.player;
  const shipGeo = createPlayerShipGeometry();
  applyMaterials(shipGeo, createPlayerMaterials(charColor));
  shipGeo.visible = false; // cockpit view
  scene.add(shipGeo);

  const player = new Ship3D({
    group: shipGeo,
    maxHull: 100,
    maxShield: 50,
    speedMult: 50, // fast descent
    rotationMult: 1,
    isPlayer: true,
  });

  // Start high above the canyon, slight offset so player navigates into it
  player.position.set(150, MARS_ATMOSPHERE.maxAltitude, -6500);
  player.velocity.set(-3, -15, -5); // initial descent with drift toward pad

  // Orient nose toward the landing pad (down and toward target)
  const lookMat = new THREE.Matrix4().lookAt(
    player.position, PAD_POSITION, new THREE.Vector3(0, 1, 0),
  );
  player.group.quaternion.setFromRotationMatrix(lookMat);

  // ── Canyon terrain ──
  const canyon = createCanyonTerrain(scene);
  scene.add(canyon.group);

  // ── Dust particles ──
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
  const dustCount = 400;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3]     = (Math.random() - 0.5) * 200;
    dustPositions[i * 3 + 1] = Math.random() * 100;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    map: dustTex, size: 2.5, transparent: true, opacity: 0,
    depthWrite: false, sizeAttenuation: true,
  });
  const dustParticles = new THREE.Points(dustGeo, dustMat);
  scene.add(dustParticles);

  // ── Systems ──
  const cockpitCam = new CockpitCamera(camera);
  const touchControls = new TouchControls3D();
  const mouseControls = new MouseControls();
  const sound = SoundSystem.getInstance();
  sound.init();

  const hud = new HUD3D();
  hud.setMissionPhase('landing');

  // ── Nav beacon pointing to landing pad ──
  const nav = new NavBeacon('HOME BASE');
  nav.setTarget(PAD_POSITION);

  // ── Holographic guide corridor — cyan rings tracing descent path ──
  const guidePath = new GuidePath(scene, player.position.clone(), PAD_POSITION);

  // ── Mission text ──
  const missionText = document.createElement('div');
  missionText.textContent = 'RETURN TO MARS — FOLLOW NAV BEACON';
  missionText.style.cssText = `
    position:fixed;top:20%;left:50%;transform:translateX(-50%);
    font-family:var(--font-display,'Rajdhani',sans-serif);
    font-size:clamp(16px,3vw,26px);font-weight:700;
    color:#ffd700;letter-spacing:4px;text-align:center;
    pointer-events:none;z-index:30;
    text-shadow:0 0 16px rgba(255,215,0,0.6),0 0 32px rgba(255,180,0,0.3);
    animation:marsLandFadeIn 2s ease-out 0.5s both;
  `;

  if (!document.getElementById('mars-landing-styles')) {
    const style = document.createElement('style');
    style.id = 'mars-landing-styles';
    style.textContent = `
      @keyframes marsLandFadeIn {
        from { opacity:0; transform:translateX(-50%) translateY(-10px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('ui-overlay')?.appendChild(missionText);

  setTimeout(() => {
    if (missionText.parentNode) {
      missionText.style.transition = 'opacity 1s ease-out';
      missionText.style.opacity = '0';
      setTimeout(() => missionText.remove(), 1000);
    }
  }, 5000);

  return {
    player, cockpitCam, touchControls, mouseControls,
    sound, hud, nav, canyon, camera,
    dustParticles, altitude: MARS_ATMOSPHERE.maxAltitude,
    phase: 'approach', landedTimer: 0, missionText,
    caveRevealTimer: 0, elapsedTime: 0, guidePath,
  };
}

// ── Phase callout helper ──────────────────────────────────

function showPhaseCallout(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed;top:25%;left:50%;transform:translateX(-50%);
    font-family:var(--font-display,'Rajdhani',sans-serif);
    font-size:clamp(14px,3vw,22px);font-weight:700;
    color:#ffd700;letter-spacing:4px;text-align:center;
    pointer-events:none;z-index:30;
    text-shadow:0 0 12px rgba(255,215,0,0.6),0 0 24px rgba(255,180,0,0.3);
    opacity:0;animation:marsLandFadeIn 1.5s ease-out 0.2s forwards;
  `;
  const overlay = document.getElementById('ui-overlay');
  if (overlay) {
    overlay.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 1s ease-out';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 1000);
    }, 3000);
  }
}

// ── updateMarsLanding ─────────────────────────────────────

export function updateMarsLanding(
  state: MarsLandingState,
  keys: Record<string, boolean>,
  dt: number,
  now: number,
  scene: THREE.Scene,
): void {
  // ── Cave reveal phase — cinematic pan ──
  if (state.phase === 'caveReveal') {
    state.caveRevealTimer += dt;
    // Slowly pan camera toward cave entrance (back of canyon at z=-10000)
    const t = Math.min(1, state.caveRevealTimer / 4);
    const ease = t * t * (3 - 2 * t); // smoothstep
    const camPos = state.camera.position;
    camPos.x = THREE.MathUtils.lerp(state.player.position.x, 0, ease);
    camPos.y = THREE.MathUtils.lerp(state.player.position.y + 20, 60, ease);
    camPos.z = THREE.MathUtils.lerp(state.player.position.z - 30, -9500, ease);
    state.camera.lookAt(0, 50, -10000);
    return;
  }

  // ── Landed — count time then trigger cave reveal ──
  if (state.phase === 'landed') {
    state.landedTimer += dt;
    if (state.landedTimer > 3) {
      state.phase = 'caveReveal';
      state.nav.hide();
      state.touchControls.hide();
      state.hud.destroy();

      // Show "WELCOME HOME" text
      const welcomeText = document.createElement('div');
      welcomeText.textContent = 'WELCOME HOME, PILOT';
      welcomeText.style.cssText = `
        position:fixed;top:35%;left:50%;transform:translateX(-50%);
        font-family:var(--font-display,'Rajdhani',sans-serif);
        font-size:clamp(24px,5vw,48px);font-weight:900;
        color:#00ffff;letter-spacing:6px;text-align:center;
        pointer-events:none;z-index:30;
        text-shadow:0 0 20px rgba(0,255,255,0.8),0 0 40px rgba(0,255,255,0.4);
        opacity:0;animation:marsLandFadeIn 2s ease-out 0.5s forwards;
      `;
      document.getElementById('ui-overlay')?.appendChild(welcomeText);
      state.missionText = welcomeText;
    }
    return;
  }

  // ── Read input ──
  const touch = state.touchControls.getInput();
  const mouse = state.mouseControls.getInput();

  const keyYaw = (keys['ArrowRight'] ? 1 : 0) + (keys['ArrowLeft'] ? -1 : 0);
  const keyPitch = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? 1 : 0);
  const keyThrust = (keys['KeyE'] ? 1 : 0) + (keys['KeyD'] ? -1 : 0);

  const input: ShipInput = {
    yaw:    Math.max(-1, Math.min(1, keyYaw + touch.yaw + mouse.yaw)),
    pitch:  Math.max(-1, Math.min(1, keyPitch + touch.pitch + mouse.verticalMove)),
    roll:   0,
    thrust: Math.max(-1, Math.min(1, keyThrust + touch.thrust)),
  };

  // ── Auto-orient toward pad during first 2 seconds ──
  state.elapsedTime += dt;
  if (state.elapsedTime < 2.0) {
    const orientMat = new THREE.Matrix4().lookAt(
      state.player.position, PAD_POSITION, new THREE.Vector3(0, 1, 0),
    );
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(orientMat);
    state.player.group.quaternion.slerp(targetQuat, dt * 0.8);
  }

  // ── Altitude ──
  state.altitude = state.player.position.y;

  // ── Atmosphere physics ──
  const atmoMods = getAtmosphereModifiers(MARS_ATMOSPHERE, state.altitude);
  applyShipPhysics(state.player, input, dt, now, atmoMods);

  // ── Floor clamp ──
  if (state.player.position.y < 0) {
    state.player.position.y = 0;
    if (state.player.velocity.y < 0) state.player.velocity.y = 0;
  }

  // ── Phase transitions with milestone callouts ──
  if (state.phase === 'approach' && state.altitude < MARS_ATMOSPHERE.maxAltitude * 0.8) {
    state.phase = 'atmosphere';
    state.sound.startWindDrone();
    state.cockpitCam.shake(2.0);
    showPhaseCallout('ENTERING MARS ATMOSPHERE');
  }

  if (state.phase === 'atmosphere' && state.altitude < 2000) {
    state.phase = 'canyon';
    showPhaseCallout('CANYON APPROACH — REDUCE SPEED');
  }

  if (state.phase === 'canyon' && state.altitude < 200) {
    state.phase = 'landing';
    showPhaseCallout('FINAL APPROACH');
  }

  // ── Guided approach toward pad — continuous from max altitude ──
  const dx = PAD_POSITION.x - state.player.position.x;
  const dz = PAD_POSITION.z - state.player.position.z;
  const padDist = Math.sqrt(dx * dx + dz * dz) || 1;

  // Continuous gentle pull from max altitude: 5% at top → 25% near ground
  const altFrac = Math.max(0, 1 - state.altitude / MARS_ATMOSPHERE.maxAltitude);
  const guidanceStrength = 0.05 + 0.20 * altFrac;
  state.player.velocity.x += (dx / padDist) * guidanceStrength * dt * 30;
  state.player.velocity.z += (dz / padDist) * guidanceStrength * dt * 30;

  // Stronger correction below 800m and within 600m of pad
  if (state.altitude < 800 && padDist < 600) {
    const correctionStrength = 0.6 * (1 - state.altitude / 800);
    state.player.velocity.x += (dx / padDist) * correctionStrength * dt * 30;
    state.player.velocity.z += (dz / padDist) * correctionStrength * dt * 30;
  }

  // ── Auto-brake — progressive from 500m, crash-proof below 20m ──
  if (state.altitude < 500 && state.player.velocity.y < -8) {
    const brakePower = 1 - state.altitude / 500; // 0 at 500m, 1 at ground
    const targetSpeed = -3 - (1 - brakePower) * 12; // -15 at 500m, -3 at ground
    if (state.player.velocity.y < targetSpeed) {
      state.player.velocity.y = THREE.MathUtils.lerp(
        state.player.velocity.y, targetSpeed, brakePower * 0.1,
      );
    }
  }

  // Dampen lateral velocity below 200m to prevent overshooting the pad
  if (state.altitude < 200) {
    const latBrake = 0.95 + 0.04 * (state.altitude / 200);
    state.player.velocity.x *= latBrake;
    state.player.velocity.z *= latBrake;
  }

  // Hard-clamp descent below 20m — truly crash-proof per spec
  if (state.altitude < 20 && state.player.velocity.y < -2) {
    state.player.velocity.y = -2;
  }

  // ── Touchdown — wider landing zone ──
  if (state.player.position.y <= LAND_THRESHOLD && padDist < 150 &&
      (state.phase === 'landing' || state.phase === 'canyon')) {
    state.player.position.y = LAND_THRESHOLD;
    state.player.velocity.set(0, 0, 0);
    state.phase = 'landed';
    state.altitude = LAND_THRESHOLD;
    state.sound.touchdown();
    setTimeout(() => state.sound.landingFanfare(), 1000);
  }

  // ── Sky color ──
  const visuals = getAtmosphereVisuals(MARS_ATMOSPHERE, state.altitude);
  if (scene.background instanceof THREE.Color) {
    (scene.background as THREE.Color).copy(visuals.skyColor);
  }

  // ── Dust ──
  const dustMat = state.dustParticles.material as THREE.PointsMaterial;
  dustMat.opacity = state.altitude < DUST_CEILING ? visuals.particleDensity * 0.4 : 0;
  state.dustParticles.position.copy(state.player.position);

  // ── Wind ──
  if (state.phase !== 'approach') {
    const windT = Math.min(1, state.altitude / MARS_ATMOSPHERE.maxAltitude);
    state.sound.setWindIntensity(windT);
  }

  // ── Nav beacon ──
  state.nav.update(state.camera, state.player.position);

  // ── Guide corridor rings ──
  state.guidePath.update(state.player.position, now);

  // ── Touch controls ──
  state.touchControls.draw();

  // ── Camera ──
  state.cockpitCam.update(state.player, dt, input.yaw);

  // ── HUD ──
  state.hud.updateAltitude(state.altitude);
  state.hud.updateDescentRate(state.player.velocity.y);
  state.hud.updateLandingStatus(state.altitude, state.player.velocity.y, padDist, state.phase);
  state.hud.updateLandingStatusTimer(dt);
}

// ── isMarsLandingComplete ─────────────────────────────────

export function isMarsLandingComplete(state: MarsLandingState): boolean {
  return state.phase === 'caveReveal' && state.caveRevealTimer > 7;
}

// ── cleanupMarsLanding ────────────────────────────────────

export function cleanupMarsLanding(
  state: MarsLandingState,
  scene: THREE.Scene,
): void {
  scene.remove(state.player.group);
  scene.remove(state.dustParticles);
  state.dustParticles.geometry.dispose();
  (state.dustParticles.material as THREE.PointsMaterial).dispose();
  state.canyon.cleanup();
  scene.remove(state.canyon.group);
  state.touchControls.destroy();
  state.hud.destroy();
  state.nav.destroy();
  state.guidePath.destroy(scene);
  state.sound.stopWindDrone();
  if (state.missionText?.parentNode) state.missionText.remove();
}
