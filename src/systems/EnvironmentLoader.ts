// ── Per-Level Environment Loader ─────────────────────────
// Spawns level-specific environment objects (asteroids, fog,
// black hole) into the scene. Returns an update function for
// per-frame effects and a cleanup function.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import type { BoltPool } from '../entities/Bolt3D';
import { ExplosionPool } from '../entities/Explosion3D';

export interface LevelEnvironment {
  /** Per-frame update for environment effects. */
  update(dt: number, now: number, player: Ship3D, enemies: Ship3D[], boltPool?: BoltPool, camera?: THREE.PerspectiveCamera, explosions?: ExplosionPool): void;
  /** Remove all environment objects from the scene. */
  cleanup(): void;
}

// ── Level 1: Asteroid Belt ──────────────────────────────

interface Asteroid {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVel: THREE.Vector3;
  radius: number;
  hp: number;
  alive: boolean;
}

export function createAsteroidBelt(scene: THREE.Scene): LevelEnvironment {
  const asteroids: Asteroid[] = [];
  const count = 12 + Math.floor(Math.random() * 6); // 12-17

  // Simple pseudo-noise for consistent rock displacement
  function hashNoise(x: number, y: number, z: number): number {
    let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
    n = n - Math.floor(n);
    return n * 2 - 1; // -1 to 1
  }

  for (let i = 0; i < count; i++) {
    // Random size: small (4-7), medium (10-16), large (18-30)
    const sizeRoll = Math.random();
    let radius: number;
    if (sizeRoll < 0.45) radius = 4 + Math.random() * 3;
    else if (sizeRoll < 0.8) radius = 10 + Math.random() * 6;
    else radius = 18 + Math.random() * 12;

    // Higher subdivision for more detailed rock surfaces
    const detail = radius > 14 ? 3 : radius > 7 ? 2 : 1;
    const geo = new THREE.IcosahedronGeometry(radius, detail);
    const posAttr = geo.attributes.position;

    // Multi-octave noise displacement for craggy, irregular rock shapes
    for (let v = 0; v < posAttr.count; v++) {
      const x = posAttr.getX(v);
      const y = posAttr.getY(v);
      const z = posAttr.getZ(v);
      const len = Math.sqrt(x * x + y * y + z * z);
      if (len < 0.001) continue;
      const nx = x / len, ny = y / len, nz = z / len;

      // Large-scale deformation (lumpy shape)
      const big = hashNoise(nx * 2 + i, ny * 2, nz * 2) * 0.25;
      // Medium crags
      const mid = hashNoise(nx * 5 + i * 3, ny * 5, nz * 5) * 0.12;
      // Fine surface roughness
      const fine = hashNoise(nx * 12 + i * 7, ny * 12, nz * 12) * 0.06;
      // Crater-like dimples (some vertices pushed inward)
      const crater = hashNoise(nx * 8 + i, ny * 8 + i, nz * 8) > 0.6 ? -0.15 : 0;

      const displacement = 1 + big + mid + fine + crater;
      posAttr.setXYZ(v, nx * radius * displacement, ny * radius * displacement, nz * radius * displacement);
    }
    geo.computeVertexNormals();

    // Per-asteroid material with color variation
    const colorVar = Math.random();
    let baseColor: number;
    if (colorVar < 0.3) baseColor = 0x3d2b1a;       // dark brown
    else if (colorVar < 0.6) baseColor = 0x554433;   // warm brown
    else if (colorVar < 0.8) baseColor = 0x444040;   // grey rock
    else baseColor = 0x2a2520;                         // near-black iron

    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.85 + Math.random() * 0.15,
      metalness: 0.05 + Math.random() * 0.15,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(geo, mat);

    // Scatter within a ring around the player spawn area (avoid center)
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 500; // 80-580 units from origin
    const elevation = (Math.random() - 0.5) * 120;
    mesh.position.set(
      Math.cos(angle) * dist,
      elevation,
      Math.sin(angle) * dist,
    );

    // Random rotation
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    scene.add(mesh);

    asteroids.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 3,
      ),
      angularVel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
      ),
      radius,
      hp: Math.round(radius * 4), // bigger asteroids take more hits
      alive: true,
    });
  }

  const _tmpDiff = new THREE.Vector3();

  function update(dt: number, _now: number, player: Ship3D, enemies: Ship3D[], boltPool?: BoltPool, camera?: THREE.PerspectiveCamera, explosions?: ExplosionPool): void {
    for (const ast of asteroids) {
      if (!ast.alive) continue;

      // Slow drift
      ast.mesh.position.addScaledVector(ast.velocity, dt);
      ast.mesh.rotation.x += ast.angularVel.x * dt;
      ast.mesh.rotation.y += ast.angularVel.y * dt;
      ast.mesh.rotation.z += ast.angularVel.z * dt;

      // Collision with player
      if (player.alive) {
        _tmpDiff.subVectors(player.position, ast.mesh.position);
        const dist = _tmpDiff.length();
        const minDist = ast.radius + 20;
        if (dist < minDist) {
          _tmpDiff.normalize();
          player.position.copy(ast.mesh.position).addScaledVector(_tmpDiff, minDist);
          const dot = player.velocity.dot(_tmpDiff);
          if (dot < 0) {
            player.velocity.addScaledVector(_tmpDiff, -dot * 1.5);
          }
          player.applyDamage(3, performance.now());
        }
      }

      // Collision with enemies
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        _tmpDiff.subVectors(enemy.position, ast.mesh.position);
        const dist = _tmpDiff.length();
        const minDist = ast.radius + 20;
        if (dist < minDist) {
          _tmpDiff.normalize();
          enemy.position.copy(ast.mesh.position).addScaledVector(_tmpDiff, minDist);
          enemy.applyDamage(3, performance.now());
        }
      }

      // Bolt-asteroid collisions — asteroids take damage from lasers
      if (boltPool) {
        for (const bolt of boltPool.getActive()) {
          _tmpDiff.subVectors(bolt.mesh.position, ast.mesh.position);
          const dist = _tmpDiff.length();
          if (dist < ast.radius) {
            ast.hp -= bolt.damage;
            boltPool.deactivate(bolt);

            if (ast.hp <= 0) {
              // Asteroid destroyed — boom!
              ast.alive = false;
              ast.mesh.visible = false;
              scene.remove(ast.mesh);

              if (explosions && camera) {
                explosions.spawnDeathWorld(ast.mesh.position, camera);
              }
            } else {
              // Visual feedback — briefly brighten on hit
              const mat = ast.mesh.material as THREE.MeshStandardMaterial;
              mat.emissive.setHex(0xff4400);
              mat.emissiveIntensity = 0.5;
              setTimeout(() => {
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
              }, 100);
            }
          }
        }
      }
    }
  }

  function cleanup(): void {
    for (const ast of asteroids) {
      scene.remove(ast.mesh);
      ast.mesh.geometry.dispose();
    }
  }

  return { update, cleanup };
}

// ── Level 2: Nebula Fog ─────────────────────────────────

export function createNebulaFog(scene: THREE.Scene): LevelEnvironment {
  // Dense fog sphere
  const fogGeo = new THREE.SphereGeometry(800, 32, 24);
  const fogMat = new THREE.MeshBasicMaterial({
    color: 0x1a3344,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const fogSphere = new THREE.Mesh(fogGeo, fogMat);
  scene.add(fogSphere);

  // Inner fog layers for depth
  const innerFogGeo = new THREE.SphereGeometry(400, 24, 16);
  const innerFogMat = new THREE.MeshBasicMaterial({
    color: 0x2a4455,
    transparent: true,
    opacity: 0.03,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const innerFog = new THREE.Mesh(innerFogGeo, innerFogMat);
  scene.add(innerFog);

  // No scene.fog — it kills the starfield and skybox. Use visual-only atmosphere instead.

  // Reduced ambient
  const dimLight = new THREE.AmbientLight(0x112233, 0.3);
  scene.add(dimLight);

  // Lightning flash light (off by default)
  const lightningLight = new THREE.DirectionalLight(0xffffff, 0);
  lightningLight.position.set(0, 200, 0);
  scene.add(lightningLight);

  let nextLightning = 8 + Math.random() * 7; // 8-15 seconds
  let lightningTimer = 0;
  let flashTimer = 0;
  let flashing = false;

  function update(dt: number): void {
    lightningTimer += dt;

    if (!flashing && lightningTimer >= nextLightning) {
      // Trigger lightning
      flashing = true;
      flashTimer = 0;
      lightningLight.intensity = 5;
      lightningTimer = 0;
      nextLightning = 8 + Math.random() * 7;
    }

    if (flashing) {
      flashTimer += dt;
      // Quick flash then fade
      if (flashTimer < 0.05) {
        lightningLight.intensity = 5;
      } else if (flashTimer < 0.15) {
        lightningLight.intensity = 2;
      } else if (flashTimer < 0.2) {
        lightningLight.intensity = 4; // secondary flash
      } else {
        lightningLight.intensity = Math.max(0, lightningLight.intensity - dt * 15);
        if (lightningLight.intensity <= 0) {
          flashing = false;
        }
      }
    }

    // Slowly drift fog center to follow player loosely
    fogSphere.position.lerp(new THREE.Vector3(0, 0, 0), dt * 0.1);
    innerFog.position.copy(fogSphere.position);
  }

  function cleanup(): void {
    scene.remove(fogSphere);
    scene.remove(innerFog);
    scene.remove(dimLight);
    scene.remove(lightningLight);
    fogGeo.dispose();
    innerFogGeo.dispose();
    fogMat.dispose();
    innerFogMat.dispose();
  }

  return { update, cleanup };
}

// ── Level 3: Black Hole ─────────────────────────────────
// Cinematic backdrop with real gravity. Flat ring accretion
// disk + glow sprite instead of thick torus geometry.

/** Black hole world position — exported so AI behaviors can reference it. */
export const BLACK_HOLE_POS = new THREE.Vector3(600, -80, -400);

export function createBlackHole(scene: THREE.Scene): LevelEnvironment {
  const group = new THREE.Group();
  group.position.copy(BLACK_HOLE_POS);

  // ── Glow halo (canvas-generated sprite) ──
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const ctx = glowCanvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 140, 50, 0.35)');
  grad.addColorStop(0.25, 'rgba(255, 80, 20, 0.18)');
  grad.addColorStop(0.55, 'rgba(160, 40, 10, 0.06)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSprite = new THREE.Sprite(glowMat);
  glowSprite.scale.set(500, 500, 1);
  group.add(glowSprite);

  // ── Singularity sphere ──
  const holeGeo = new THREE.SphereGeometry(50, 32, 32);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  group.add(new THREE.Mesh(holeGeo, holeMat));

  // ── Accretion disk — flat ring, tilted ──
  const DISK_TILT = Math.PI * 0.42;
  const diskGeo = new THREE.RingGeometry(60, 200, 64);
  const diskMat = new THREE.MeshBasicMaterial({
    color: 0xff7700,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = DISK_TILT;
  group.add(disk);

  // ── Inner bright edge ──
  const edgeGeo = new THREE.RingGeometry(52, 68, 64);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.rotation.x = DISK_TILT;
  group.add(edge);

  // ── Warm point light ──
  const bhLight = new THREE.PointLight(0xff6600, 2, 800);
  group.add(bhLight);

  scene.add(group);

  // ── Gravity — pulls ships that fly close ──
  const GRAVITY_STRENGTH = 600;
  const EVENT_HORIZON = 55;
  const MAX_EFFECT_DIST = 600;
  const _toHole = new THREE.Vector3();

  function applyGravity(entity: Ship3D, dt: number): void {
    if (!entity.alive) return;
    _toHole.subVectors(BLACK_HOLE_POS, entity.position);
    const dist = _toHole.length();
    if (dist < EVENT_HORIZON) {
      entity.applyDamage(9999, performance.now());
      return;
    }
    if (dist < MAX_EFFECT_DIST) {
      const force = GRAVITY_STRENGTH / (dist * dist) * dt;
      _toHole.normalize();
      entity.velocity.addScaledVector(_toHole, force * 60);
    }
  }

  function update(dt: number, _now: number, player: Ship3D, enemies: Ship3D[]): void {
    // Very slow rotation — ominous, not distracting
    disk.rotation.z += dt * 0.04;
    edge.rotation.z += dt * 0.06;

    applyGravity(player, dt);
    for (const enemy of enemies) {
      applyGravity(enemy, dt);
    }
  }

  function cleanup(): void {
    scene.remove(group);
    holeGeo.dispose();
    diskGeo.dispose();
    edgeGeo.dispose();
    holeMat.dispose();
    diskMat.dispose();
    edgeMat.dispose();
    glowTex.dispose();
    glowMat.dispose();
  }

  return { update, cleanup };
}

// ── Factory — create environment based on level number ──

export function createLevelEnvironment(scene: THREE.Scene, level: number): LevelEnvironment | null {
  switch (level) {
    case 1: return createAsteroidBelt(scene);
    case 2: return createNebulaFog(scene);
    case 3: return createBlackHole(scene);
    default: return null;
  }
}
