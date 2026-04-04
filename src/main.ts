// ── OH-YUM BLASTER 3D — Main Entry Point ────────────────
// Three.js renderer, scene management, animation loop.

import * as THREE from 'three';
import { createRenderer, handleRendererResize, type RendererBundle } from './renderer/SetupRenderer';
import { createSpaceEnvironment, type SpaceEnvironment } from './renderer/Environment';
import { createPlayerShipGeometry, createEnemyShipGeometry } from './ships/ShipGeometry';
import { createPlayerMaterials, createEnemyMaterials, applyMaterials } from './ships/ShipMaterials';
import { Ship3D } from './entities/Ship3D';
import { CockpitCamera } from './camera/CockpitCamera';
import { applyShipPhysics, checkShipCollision, resolveShipCollision, type ShipInput } from './systems/PhysicsSystem3D';
import { BoltPool } from './entities/Bolt3D';
import { tryFireWeapon } from './systems/WeaponSystem3D';
import { SHIP } from './config';

// ── Globals ──
let bundle: RendererBundle;
let env: SpaceEnvironment;
let clock: THREE.Clock;
let player: Ship3D;
let enemy: Ship3D;
let cockpitCam: CockpitCamera;
let boltPool: BoltPool;

// Input state
const keys: Record<string, boolean> = {};

function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Missing #game-canvas element');

  bundle = createRenderer(canvas);
  env = createSpaceEnvironment(bundle.scene, bundle.renderer, bundle.camera);

  // ── Player ship ──
  const playerGeo = createPlayerShipGeometry();
  applyMaterials(playerGeo, createPlayerMaterials(0x88aacc));
  bundle.scene.add(playerGeo);

  player = new Ship3D({
    group: playerGeo,
    maxHull: SHIP.PLAYER_HULL,
    maxShield: SHIP.PLAYER_SHIELD,
    speedMult: 1.0,
    rotationMult: 1.0,
    isPlayer: true,
  });

  // ── Enemy ship ──
  const enemyGeo = createEnemyShipGeometry();
  applyMaterials(enemyGeo, createEnemyMaterials());
  enemyGeo.position.set(0, 0, 80);
  bundle.scene.add(enemyGeo);

  enemy = new Ship3D({
    group: enemyGeo,
    maxHull: 60,
    maxShield: 0,
    speedMult: 0.5,
    rotationMult: 0.5,
    isPlayer: false,
  });

  // ── Camera ──
  cockpitCam = new CockpitCamera(bundle.camera);
  const crosshair = document.getElementById('crosshair');
  if (crosshair) crosshair.style.display = 'block';

  // ── Bolt pool ──
  boltPool = new BoltPool(bundle.scene);

  // ── Input ──
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  clock = new THREE.Clock();

  const onResize = () => handleRendererResize(bundle);
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  // ── Input ──
  const input: ShipInput = {
    yaw: (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0),
    pitch: (keys['KeyQ'] ? 1 : 0) + (keys['KeyE'] ? -1 : 0),
    roll: 0,
    thrust: (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0) + (keys['ArrowDown'] || keys['KeyS'] ? -1 : 0),
  };

  // ── Physics ──
  applyShipPhysics(player, input, dt, now);
  applyShipPhysics(enemy, { yaw: 0, pitch: 0, roll: 0, thrust: 0 }, dt, now);

  // ── Weapons ──
  if (keys['Space']) {
    tryFireWeapon(player, boltPool, now);
  }
  boltPool.update(dt);

  // ── Ship-to-ship collision ──
  if (checkShipCollision(player, enemy, SHIP.HITBOX_RADIUS)) {
    resolveShipCollision(player, enemy, SHIP.HITBOX_RADIUS, now);
    cockpitCam.shake(0.5);
  }

  // ── Camera ──
  cockpitCam.update(player, dt, input.yaw);

  // ── Render ──
  bundle.composer.render();
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}

export { bundle, env };
