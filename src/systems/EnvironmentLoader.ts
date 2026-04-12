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

// ── Smooth 3D value noise for organic rock shapes ──
function _hash3(x: number, y: number, z: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function _lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function _fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
export function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = _fade(x - ix), fy = _fade(y - iy), fz = _fade(z - iz);
  const n000 = _hash3(ix, iy, iz), n100 = _hash3(ix + 1, iy, iz);
  const n010 = _hash3(ix, iy + 1, iz), n110 = _hash3(ix + 1, iy + 1, iz);
  const n001 = _hash3(ix, iy, iz + 1), n101 = _hash3(ix + 1, iy, iz + 1);
  const n011 = _hash3(ix, iy + 1, iz + 1), n111 = _hash3(ix + 1, iy + 1, iz + 1);
  return _lerp(
    _lerp(_lerp(n000, n100, fx), _lerp(n010, n110, fx), fy),
    _lerp(_lerp(n001, n101, fx), _lerp(n011, n111, fx), fy),
    fz,
  ) * 2 - 1; // remap to -1..1
}

/** FBM (fractal brownian motion) — stacks noise octaves for organic detail. */
export function fbm3D(x: number, y: number, z: number, octaves: number, lacunarity = 2.0, gain = 0.5): number {
  let value = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    value += amp * valueNoise3D(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return value / norm;
}

/** Ridged noise — creates sharp crags and ridgelines. */
export function ridgedNoise3D(x: number, y: number, z: number, octaves: number): number {
  let value = 0, amp = 1, freq = 1, norm = 0, prev = 1;
  for (let o = 0; o < octaves; o++) {
    let n = Math.abs(valueNoise3D(x * freq, y * freq, z * freq));
    n = 1 - n; // invert for ridges
    n = n * n;  // sharpen
    n *= prev;  // reduce amplitude near valleys
    prev = n;
    value += amp * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return value / norm * 2 - 1;
}

/** Domain-warped FBM — feeds noise through another noise layer for truly organic, swirly shapes. */
export function warpedFbm3D(x: number, y: number, z: number, octaves: number, warpStrength = 0.8): number {
  const wx = x + warpStrength * fbm3D(x + 0.0, y + 3.2, z + 1.3, 3);
  const wy = y + warpStrength * fbm3D(x + 5.2, y + 1.3, z + 2.8, 3);
  const wz = z + warpStrength * fbm3D(x + 2.1, y + 7.8, z + 4.1, 3);
  return fbm3D(wx, wy, wz, octaves);
}

/** Double domain warp — two passes of coordinate distortion for maximum organic chaos. */
export function doubleWarpedFbm3D(x: number, y: number, z: number, octaves: number): number {
  // First warp
  const w1x = x + 0.7 * fbm3D(x + 0.0, y + 3.2, z + 1.3, 3);
  const w1y = y + 0.7 * fbm3D(x + 5.2, y + 1.3, z + 2.8, 3);
  const w1z = z + 0.7 * fbm3D(x + 2.1, y + 7.8, z + 4.1, 3);
  // Second warp on warped coords
  const w2x = w1x + 0.5 * fbm3D(w1x + 1.7, w1y + 9.2, w1z + 3.4, 3);
  const w2y = w1y + 0.5 * fbm3D(w1x + 8.3, w1y + 2.8, w1z + 5.1, 3);
  const w2z = w1z + 0.5 * fbm3D(w1x + 4.6, w1y + 6.1, w1z + 0.9, 3);
  return fbm3D(w2x, w2y, w2z, octaves);
}

/** Generates a procedural normal map on canvas — micro craters, grain, and pitting. */
function createAsteroidNormalMap(size: number, seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const u = x / size, v = y / size;

      // Micro-crater pitting
      const pit1 = valueNoise3D(u * 40 + seed, v * 40, seed * 0.3);
      const pit2 = valueNoise3D(u * 80 + seed * 2, v * 80, seed * 0.7);
      const pit = pit1 * 0.6 + pit2 * 0.4;

      // Grain texture
      const grain = valueNoise3D(u * 120 + seed, v * 120 + seed, 0) * 0.3;

      // Compute normal from height (central difference)
      const eps = 1.0 / size;
      const hL = valueNoise3D((u - eps) * 40 + seed, v * 40, seed * 0.3);
      const hR = valueNoise3D((u + eps) * 40 + seed, v * 40, seed * 0.3);
      const hD = valueNoise3D(u * 40 + seed, (v - eps) * 40, seed * 0.3);
      const hU = valueNoise3D(u * 40 + seed, (v + eps) * 40, seed * 0.3);

      let nx = (hL - hR) * 3.0;
      let ny = (hD - hU) * 3.0;
      let nz = 1.0;
      // Add grain perturbation
      nx += grain * 0.15;
      ny += grain * 0.15;

      // Normalize
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

      // Encode as RGB (tangent space: 0.5 = zero)
      d[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Create a single asteroid mesh — reusable for both arena and viewer.
 *  Returns a Group containing the main body + surface boulders. */
export function createAsteroidMesh(radius: number, seed: number): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; group?: THREE.Group } {
  const detail = radius > 14 ? 4 : radius > 7 ? 3 : 2;
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const posAttr = geo.attributes.position;

  const rng = () => { seed = (seed * 16807 + 7) % 2147483647; return (seed - 1) / 2147483646; };

  // ── Contact binary / multi-lobe implicit field ──
  // Like Itokawa and Arrokoth — 1-3 fused lobes create peanut/snowman shapes
  const lobeCenterCount = 1 + Math.floor(rng() * 2.5); // 1-3 major lobes
  const lobeCenters: Array<{ pos: THREE.Vector3; r: number; weight: number }> = [];
  // Primary lobe at origin
  lobeCenters.push({ pos: new THREE.Vector3(0, 0, 0), r: 1.0, weight: 1.0 });
  for (let l = 1; l < lobeCenterCount; l++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const dist = 0.5 + rng() * 0.6; // offset from center
    const lobeR = 0.5 + rng() * 0.5; // sub-lobe size relative to main
    lobeCenters.push({
      pos: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * dist,
        Math.sin(phi) * Math.sin(theta) * dist,
        Math.cos(phi) * dist,
      ),
      r: lobeR,
      weight: 0.6 + rng() * 0.4,
    });
  }

  // Axis stretch
  const stretchX = 0.55 + rng() * 0.9;
  const stretchY = 0.55 + rng() * 0.9;
  const stretchZ = 0.55 + rng() * 0.9;
  const ox = rng() * 100, oy = rng() * 100, oz = rng() * 100;

  // Flat plateau regions — 1-3 random planes that clamp displacement
  const plateauCount = Math.floor(rng() * 3);
  const plateaus: Array<{ normal: THREE.Vector3; threshold: number }> = [];
  for (let p = 0; p < plateauCount; p++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    plateaus.push({
      normal: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      ),
      threshold: 0.75 + rng() * 0.2, // how deep the flat cut goes
    });
  }

  const vertCount = posAttr.count;
  const colors = new Float32Array(vertCount * 3);
  // Store displacement values for AO pass
  const displacements = new Float32Array(vertCount);

  // Base color palette
  const colorType = rng();
  let baseR: number, baseG: number, baseB: number;
  if (colorType < 0.2) { baseR = 0.24; baseG = 0.17; baseB = 0.10; }
  else if (colorType < 0.4) { baseR = 0.33; baseG = 0.27; baseB = 0.20; }
  else if (colorType < 0.6) { baseR = 0.27; baseG = 0.25; baseB = 0.25; }
  else if (colorType < 0.8) { baseR = 0.17; baseG = 0.15; baseB = 0.13; }
  else { baseR = 0.30; baseG = 0.22; baseB = 0.16; } // rusty iron

  for (let v = 0; v < vertCount; v++) {
    const x = posAttr.getX(v);
    const y = posAttr.getY(v);
    const z = posAttr.getZ(v);
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len < 0.001) continue;
    const nx = x / len, ny = y / len, nz = z / len;

    const sx = nx + ox, sy = ny + oy, sz = nz + oz;

    // ── Multi-lobe implicit field — smooth union of spheres ──
    let lobeField = 0;
    for (const lc of lobeCenters) {
      const dx = nx - lc.pos.x, dy = ny - lc.pos.y, dz = nz - lc.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Smooth metaball falloff
      const t = Math.max(0, 1 - d / (lc.r * 1.5));
      lobeField += lc.weight * t * t * (3 - 2 * t); // smoothstep
    }
    lobeField = Math.min(lobeField, 1.4); // cap

    // ── Double domain-warped large-scale — maximum organic chaos ──
    const big = doubleWarpedFbm3D(sx * 1.0, sy * 1.0, sz * 1.0, 4) * 0.45;

    // ── Ridged crags with warped input — less uniform ──
    const warpedSx = sx + 0.3 * valueNoise3D(sx * 2, sy * 2, sz * 2);
    const warpedSy = sy + 0.3 * valueNoise3D(sx * 2 + 5, sy * 2, sz * 2);
    const mid = ridgedNoise3D(warpedSx * 3.5, warpedSy * 3.5, sz * 3.5, 4) * 0.20;

    // ── Fine surface roughness ──
    const fine = fbm3D(sx * 12, sy * 12, sz * 12, 3) * 0.06;

    // ── Multi-scale craters — small and large bowls ──
    let crater = 0;
    // Large craters
    const cNoise1 = valueNoise3D(sx * 2.5, sy * 2.5, sz * 2.5);
    if (cNoise1 > 0.55) {
      const depth = (cNoise1 - 0.55) * 2.2;
      crater -= depth * depth * 0.35;
      if (cNoise1 < 0.65) crater += 0.04; // rim
    }
    // Small craters
    const cNoise2 = valueNoise3D(sx * 7, sy * 7, sz * 7);
    if (cNoise2 > 0.6) {
      crater -= (cNoise2 - 0.6) * 0.25;
    }

    let displacement = (lobeField * 0.7 + 0.3 + big + mid + fine + crater) * radius;

    // ── Flat plateau clamp — creates flat faceted faces ──
    for (const pl of plateaus) {
      const dot = nx * pl.normal.x + ny * pl.normal.y + nz * pl.normal.z;
      if (dot > 0.7) {
        const flatAmount = (dot - 0.7) / 0.3; // 0-1
        const clamped = pl.threshold * radius;
        displacement = displacement * (1 - flatAmount * 0.6) + clamped * flatAmount * 0.6;
      }
    }

    displacements[v] = displacement;

    posAttr.setXYZ(v,
      nx * displacement * stretchX,
      ny * displacement * stretchY,
      nz * displacement * stretchZ,
    );

    // ── Vertex color ──
    const colorNoise = warpedFbm3D(sx * 2.5, sy * 2.5, sz * 2.5, 3, 0.5);
    const streakNoise = ridgedNoise3D(sx * 8, sy * 8, sz * 8, 2);
    const dustNoise = fbm3D(sx * 1.2, sy * 1.2, sz * 1.2, 2);
    const ironNoise = valueNoise3D(sx * 5, sy * 5, sz * 5);

    const ridgeBright = Math.max(0, mid) * 1.8;
    const valleyDark = Math.min(0, crater) * 2.5;
    const variation = colorNoise * 0.3 + streakNoise * 0.12 + ridgeBright + valleyDark;

    // Warm dust patches
    const dustTint = dustNoise > 0.2 ? (dustNoise - 0.2) * 0.25 : 0;
    // Dark metallic iron veins
    const ironTint = ironNoise > 0.7 ? (ironNoise - 0.7) * 0.5 : 0;

    colors[v * 3]     = Math.max(0, Math.min(1, baseR + variation * 0.35 + dustTint - ironTint * 0.3));
    colors[v * 3 + 1] = Math.max(0, Math.min(1, baseG + variation * 0.28 - ironTint * 0.2));
    colors[v * 3 + 2] = Math.max(0, Math.min(1, baseB + variation * 0.22 - dustTint * 0.4 + ironTint * 0.05));
  }

  // ── Vertex ambient occlusion pass — darken concave areas ──
  // Compare each vertex displacement to its neighbors to estimate concavity
  const indexAttr = geo.index;
  if (indexAttr) {
    // Build adjacency: which vertices are neighbors
    const adj: Set<number>[] = new Array(vertCount);
    for (let i = 0; i < vertCount; i++) adj[i] = new Set();
    for (let f = 0; f < indexAttr.count; f += 3) {
      const a = indexAttr.getX(f), b = indexAttr.getX(f + 1), c = indexAttr.getX(f + 2);
      adj[a].add(b); adj[a].add(c);
      adj[b].add(a); adj[b].add(c);
      adj[c].add(a); adj[c].add(b);
    }
    for (let v = 0; v < vertCount; v++) {
      if (adj[v].size === 0) continue;
      let avgNeighborDisp = 0;
      for (const n of adj[v]) avgNeighborDisp += displacements[n];
      avgNeighborDisp /= adj[v].size;
      // If this vertex is lower than neighbors = concave = darker
      const ao = Math.max(0, (avgNeighborDisp - displacements[v]) / radius);
      const darken = ao * 2.5; // strength
      colors[v * 3]     = Math.max(0, colors[v * 3] - darken * 0.15);
      colors[v * 3 + 1] = Math.max(0, colors[v * 3 + 1] - darken * 0.15);
      colors[v * 3 + 2] = Math.max(0, colors[v * 3 + 2] - darken * 0.12);
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // ── Procedural normal map for micro detail ──
  const normalMap = createAsteroidNormalMap(512, seed);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85 + rng() * 0.15,
    metalness: 0.03 + rng() * 0.12,
    flatShading: true,
    side: THREE.DoubleSide,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });

  const mainMesh = new THREE.Mesh(geo, mat);

  return { mesh: mainMesh, mat };
}

export function createAsteroidBelt(scene: THREE.Scene): LevelEnvironment {
  const asteroids: Asteroid[] = [];
  const count = 12 + Math.floor(Math.random() * 6); // 12-17

  for (let i = 0; i < count; i++) {
    // Random size: small (4-7), medium (10-16), large (18-30)
    const sizeRoll = Math.random();
    let radius: number;
    if (sizeRoll < 0.45) radius = 4 + Math.random() * 3;
    else if (sizeRoll < 0.8) radius = 10 + Math.random() * 6;
    else radius = 18 + Math.random() * 12;

    const { mesh } = createAsteroidMesh(radius, i);

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
          const speed = player.velocity.length();
          _tmpDiff.normalize();
          if (speed > 40) {
            // High-speed impact — instant death + explosion
            player.applyDamage(9999, performance.now());
            if (explosions && camera) {
              explosions.spawnDeathWorld(player.position.clone(), camera);
            }
          } else {
            // Low-speed bump — bounce off with minor damage
            player.position.copy(ast.mesh.position).addScaledVector(_tmpDiff, minDist);
            const dot = player.velocity.dot(_tmpDiff);
            if (dot < 0) {
              player.velocity.addScaledVector(_tmpDiff, -dot * 1.5);
            }
            player.applyDamage(3, performance.now());
          }
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
          if (!bolt.active) continue;
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
// Fiery fantastical black hole — intense orange/yellow swirling
// accretion disk with turbulent filaments, radial sparks, thick
// spiral gas arms, volumetric glow, and real gravity pull.

/** Black hole world position — exported so AI behaviors can reference it.
 *  Placed far from planets (800,-300,-1200) and moon (-600,200,-900). */
export const BLACK_HOLE_POS = new THREE.Vector3(-1800, 200, 1600);

// ── GLSL snippets for the accretion disk shader ──

const DISK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISK_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uHotSpotAngle;
  varying vec2 vUv;

  // --- Simplex-style hash noise ---
  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // --- Value noise ---
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // --- Fractal Brownian Motion (turbulent organic gas) ---
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  // --- Ridged noise (bright filament structures) ---
  float ridged(vec2 p) {
    return 1.0 - abs(vnoise(p) * 2.0 - 1.0);
  }
  float ridgedFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * ridged(p);
      p = rot * p * 2.1;
      a *= 0.5;
    }
    return v;
  }

  // --- Fire color ramp ---
  vec3 fireColor(float t) {
    // black → deep red → orange → yellow → white-hot
    vec3 c0 = vec3(0.05, 0.0, 0.0);   // black/very dark red
    vec3 c1 = vec3(0.6, 0.1, 0.0);    // deep red
    vec3 c2 = vec3(1.0, 0.4, 0.0);    // orange
    vec3 c3 = vec3(1.0, 0.75, 0.2);   // yellow-orange
    vec3 c4 = vec3(1.0, 0.95, 0.7);   // white-hot

    if (t < 0.2) return mix(c0, c1, t / 0.2);
    if (t < 0.4) return mix(c1, c2, (t - 0.2) / 0.2);
    if (t < 0.65) return mix(c2, c3, (t - 0.4) / 0.25);
    return mix(c3, c4, clamp((t - 0.65) / 0.35, 0.0, 1.0));
  }

  void main() {
    // Convert UV to polar: center of disk at (0.5, 0.5)
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0; // 0 at center, 1 at edge
    float angle = atan(centered.y, centered.x);

    // Inner/outer cutoff
    float innerR = 0.18;  // black void radius
    float outerR = 0.95;  // outer fade
    if (dist < innerR || dist > outerR) discard;

    // Normalized radial position: 0 at inner edge, 1 at outer
    float radialT = (dist - innerR) / (outerR - innerR);

    // Spiral UV distortion — makes the gas swirl
    float spiralWind = 3.0; // how tightly wound
    float spiralAngle = angle + radialT * spiralWind + uTime * 0.15;

    // Sample coordinates for noise
    vec2 noiseUV = vec2(spiralAngle * 1.2, radialT * 4.0);

    // Base turbulence (large-scale gas structure)
    float turb = fbm(noiseUV * 3.0 + uTime * 0.08);

    // Bright filaments (ridged noise for tendril structures)
    float filaments = ridgedFbm(noiseUV * 4.0 + vec2(uTime * 0.05, uTime * 0.12));

    // Combine: turbulence base + bright filament overlay
    float intensity = turb * 0.6 + filaments * 0.55;

    // Radial brightness: hotter near inner edge, cooler at outer
    float radialBrightness = 1.0 - radialT * 0.7;
    intensity *= radialBrightness;

    // Hot spot — concentrated brightness at one angular position
    float hotSpotDist = 1.0 - smoothstep(0.0, 1.8,
      abs(mod(angle - uHotSpotAngle + 3.14159, 6.28318) - 3.14159));
    float hotSpotRadial = smoothstep(0.0, 0.5, radialT) * smoothstep(0.8, 0.3, radialT);
    intensity += hotSpotDist * hotSpotRadial * 0.5;

    // Extra inner-edge brightness (white-hot ring hugging the void)
    float innerGlow = smoothstep(0.15, 0.0, radialT) * 1.2;
    intensity += innerGlow;

    // Clamp and apply fire color ramp
    intensity = clamp(intensity, 0.0, 1.5);
    vec3 color = fireColor(intensity);

    // Boost bright areas for bloom to catch
    color *= 1.0 + intensity * 0.8;

    // Alpha: fade at inner edge (just past void), fade at outer edge
    float alphaInner = smoothstep(0.0, 0.06, radialT);
    float alphaOuter = 1.0 - smoothstep(0.75, 1.0, radialT);
    float alpha = alphaInner * alphaOuter * clamp(intensity * 1.5, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Helper: generate a canvas texture for a radial glow sprite
function makeGlowTexture(
  size: number,
  stops: Array<{ pos: number; color: string }>,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const s of stops) grad.addColorStop(s.pos, s.color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function createBlackHole(scene: THREE.Scene): LevelEnvironment {
  const group = new THREE.Group();
  group.position.copy(BLACK_HOLE_POS);
  const disposables: Array<{ dispose(): void }> = [];

  const DISK_TILT = Math.PI * 0.42;

  // ── 1. Singularity sphere (deep black void) ──
  const holeGeo = new THREE.SphereGeometry(60, 48, 48);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const holeMesh = new THREE.Mesh(holeGeo, holeMat);
  group.add(holeMesh);
  disposables.push(holeGeo, holeMat);

  // ── 2. Outer volumetric glow (large warm orange wash) ──
  const outerGlowTex = makeGlowTexture(512, [
    { pos: 0, color: 'rgba(255, 160, 40, 0.35)' },
    { pos: 0.12, color: 'rgba(255, 120, 20, 0.25)' },
    { pos: 0.3, color: 'rgba(200, 70, 5, 0.12)' },
    { pos: 0.55, color: 'rgba(120, 30, 0, 0.05)' },
    { pos: 0.8, color: 'rgba(40, 8, 0, 0.02)' },
    { pos: 1, color: 'rgba(0, 0, 0, 0)' },
  ]);
  const outerGlowMat = new THREE.SpriteMaterial({
    map: outerGlowTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const outerGlow = new THREE.Sprite(outerGlowMat);
  outerGlow.scale.set(1000, 1000, 1);
  group.add(outerGlow);
  disposables.push(outerGlowTex, outerGlowMat);

  // ── 3. Inner intense glow (white-hot core halo) ──
  const innerGlowTex = makeGlowTexture(512, [
    { pos: 0, color: 'rgba(255, 240, 180, 0.6)' },
    { pos: 0.08, color: 'rgba(255, 200, 80, 0.5)' },
    { pos: 0.2, color: 'rgba(255, 140, 30, 0.3)' },
    { pos: 0.4, color: 'rgba(255, 80, 5, 0.12)' },
    { pos: 0.7, color: 'rgba(120, 30, 0, 0.03)' },
    { pos: 1, color: 'rgba(0, 0, 0, 0)' },
  ]);
  const innerGlowMat = new THREE.SpriteMaterial({
    map: innerGlowTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const innerGlow = new THREE.Sprite(innerGlowMat);
  innerGlow.scale.set(500, 500, 1);
  group.add(innerGlow);
  disposables.push(innerGlowTex, innerGlowMat);

  // ── 4. Shader accretion disk (the main fiery swirl) ──
  const diskUniforms = {
    uTime: { value: 0.0 },
    uHotSpotAngle: { value: -0.8 }, // lower-right hot spot
  };
  const diskGeo = new THREE.PlaneGeometry(500, 500, 1, 1);
  const diskMat = new THREE.ShaderMaterial({
    uniforms: diskUniforms,
    vertexShader: DISK_VERTEX,
    fragmentShader: DISK_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const diskMesh = new THREE.Mesh(diskGeo, diskMat);
  diskMesh.rotation.x = DISK_TILT;
  group.add(diskMesh);
  disposables.push(diskGeo, diskMat);

  // ── 5. Second disk layer (offset tilt for volumetric depth) ──
  const disk2Geo = new THREE.PlaneGeometry(480, 480, 1, 1);
  const disk2Mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: diskUniforms.uTime, // share time uniform
      uHotSpotAngle: { value: -0.4 }, // slightly different hot spot
    },
    vertexShader: DISK_VERTEX,
    fragmentShader: DISK_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const disk2Mesh = new THREE.Mesh(disk2Geo, disk2Mat);
  disk2Mesh.rotation.x = DISK_TILT + 0.12;
  disk2Mesh.rotation.z = 0.25;
  group.add(disk2Mesh);
  disposables.push(disk2Geo, disk2Mat);

  // ── 6. Inner bright filament ring (white-hot edge around void) ──
  const innerRingGeo = new THREE.TorusGeometry(64, 3.5, 16, 128);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: 0xffeeaa, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.rotation.x = DISK_TILT;
  group.add(innerRing);
  disposables.push(innerRingGeo, innerRingMat);

  // Thin secondary inner ring
  const innerRing2Geo = new THREE.TorusGeometry(68, 2, 16, 128);
  const innerRing2Mat = new THREE.MeshBasicMaterial({
    color: 0xffcc66, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const innerRing2 = new THREE.Mesh(innerRing2Geo, innerRing2Mat);
  innerRing2.rotation.x = DISK_TILT;
  group.add(innerRing2);
  disposables.push(innerRing2Geo, innerRing2Mat);

  // ── 8. Swirling gas stream particles (spiral inward) ──
  const STREAM_COUNT = 400;
  const streamGeo = new THREE.BufferGeometry();
  const streamPositions = new Float32Array(STREAM_COUNT * 3);
  const streamColors = new Float32Array(STREAM_COUNT * 3);
  const streamAngles = new Float32Array(STREAM_COUNT);
  const streamRadii = new Float32Array(STREAM_COUNT);
  const streamSpeeds = new Float32Array(STREAM_COUNT);
  const streamHeights = new Float32Array(STREAM_COUNT);

  for (let i = 0; i < STREAM_COUNT; i++) {
    streamAngles[i] = Math.random() * Math.PI * 2;
    streamRadii[i] = 60 + Math.random() * 200;
    streamSpeeds[i] = 0.2 + Math.random() * 0.4;
    streamHeights[i] = (Math.random() - 0.5) * 25;
    const t = (streamRadii[i] - 60) / 200;
    streamColors[i * 3] = 1.0;
    streamColors[i * 3 + 1] = 0.5 + (1 - t) * 0.45;
    streamColors[i * 3 + 2] = (1 - t) * 0.3;
  }
  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
  const streamMat = new THREE.PointsMaterial({
    size: 3.5, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const streamPoints = new THREE.Points(streamGeo, streamMat);
  streamPoints.rotation.x = DISK_TILT;
  group.add(streamPoints);
  disposables.push(streamGeo, streamMat);

  // ── 9. Radial spark particles (ejected outward from disk) ──
  const SPARK_COUNT = 500;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkColors = new Float32Array(SPARK_COUNT * 3);
  const sparkAngles = new Float32Array(SPARK_COUNT);
  const sparkRadii = new Float32Array(SPARK_COUNT);
  const sparkSpeeds = new Float32Array(SPARK_COUNT); // outward velocity
  const sparkHeights = new Float32Array(SPARK_COUNT);
  const sparkLife = new Float32Array(SPARK_COUNT); // 0-1 lifecycle

  for (let i = 0; i < SPARK_COUNT; i++) {
    sparkAngles[i] = Math.random() * Math.PI * 2;
    sparkRadii[i] = 70 + Math.random() * 60;
    sparkSpeeds[i] = 30 + Math.random() * 120; // fast outward
    sparkHeights[i] = (Math.random() - 0.5) * 40;
    sparkLife[i] = Math.random(); // start at random point in lifecycle
    // Bright orange-yellow-white sparks
    const bright = 0.6 + Math.random() * 0.4;
    sparkColors[i * 3] = 1.0;
    sparkColors[i * 3 + 1] = 0.5 + bright * 0.4;
    sparkColors[i * 3 + 2] = bright * 0.3;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 2.0, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.rotation.x = DISK_TILT;
  group.add(sparkPoints);
  disposables.push(sparkGeo, sparkMat);

  // ── 10. Warm point lights ──
  const warmLight = new THREE.PointLight(0xff7700, 3.5, 1000);
  group.add(warmLight);
  const warmLight2 = new THREE.PointLight(0xffaa33, 1.5, 600);
  warmLight2.position.set(40, -20, 30);
  group.add(warmLight2);

  scene.add(group);

  // ── Gravity — pulls ships that fly close ──
  const GRAVITY_STRENGTH = 600;
  const EVENT_HORIZON = 60; // match singularity radius
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

  function update(dt: number, now: number, player: Ship3D, enemies: Ship3D[]): void {
    // Advance shader time
    diskUniforms.uTime.value = now;

    // Rotate inner rings at different speeds
    innerRing.rotation.z += dt * 0.08;
    innerRing2.rotation.z -= dt * 0.05;

    // Animate stream particles — spiral inward
    const posArr = streamGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < STREAM_COUNT; i++) {
      streamAngles[i] += dt * streamSpeeds[i] * (180 / Math.max(streamRadii[i], 60));
      streamRadii[i] -= dt * 3; // drift inward
      if (streamRadii[i] < 58) {
        streamRadii[i] = 140 + Math.random() * 120;
        streamAngles[i] = Math.random() * Math.PI * 2;
      }
      const a = streamAngles[i];
      const r = streamRadii[i];
      posArr[i * 3] = Math.cos(a) * r;
      posArr[i * 3 + 1] = streamHeights[i] * (r / 200);
      posArr[i * 3 + 2] = Math.sin(a) * r;
    }
    streamGeo.attributes.position.needsUpdate = true;

    // Animate spark particles — radiate outward
    const sparkPosArr = sparkGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparkLife[i] += dt * (0.3 + sparkSpeeds[i] * 0.003);
      if (sparkLife[i] > 1) {
        // Respawn at inner disk edge
        sparkLife[i] = 0;
        sparkAngles[i] = Math.random() * Math.PI * 2;
        sparkRadii[i] = 70 + Math.random() * 40;
        sparkHeights[i] = (Math.random() - 0.5) * 20;
        sparkSpeeds[i] = 30 + Math.random() * 120;
      }
      // Outward radial motion
      const currentR = sparkRadii[i] + sparkLife[i] * sparkSpeeds[i];
      const a = sparkAngles[i] + sparkLife[i] * 0.3; // slight spiral
      sparkPosArr[i * 3] = Math.cos(a) * currentR;
      sparkPosArr[i * 3 + 1] = sparkHeights[i] * (1 - sparkLife[i] * 0.5);
      sparkPosArr[i * 3 + 2] = Math.sin(a) * currentR;
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // Pulsing inner ring
    innerRingMat.opacity = 0.55 + 0.2 * Math.sin(now * 1.8);

    // Flickering warm lights
    warmLight.intensity = 3.0 + 1.0 * Math.sin(now * 0.9);
    warmLight2.intensity = 1.3 + 0.5 * Math.sin(now * 1.4 + 1.0);

    applyGravity(player, dt);
    for (const enemy of enemies) {
      applyGravity(enemy, dt);
    }
  }

  function cleanup(): void {
    scene.remove(group);
    for (const d of disposables) d.dispose();
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

// ── High-speed collision check for celestial bodies (planet, moon) ──
// These are in SpaceEnvironment (always present), not per-level LevelEnvironment.

interface CelestialBody {
  group: THREE.Group;
  radius: number;
}

const _celestialDiff = new THREE.Vector3();

/** Check player collision with planet/moon/black hole.
 *  Speed > 40 on asteroids = death. Any planet/moon hit = death (massive body). */
export function checkCelestialCollisions(
  player: Ship3D,
  bodies: CelestialBody[],
  explosions?: ExplosionPool,
  camera?: THREE.PerspectiveCamera,
): void {
  if (!player.alive) return;
  for (const body of bodies) {
    _celestialDiff.subVectors(player.position, body.group.position);
    const dist = _celestialDiff.length();
    const minDist = body.radius + 30;
    if (dist < minDist) {
      // Hitting a planet or moon at any speed = instant death
      player.applyDamage(9999, performance.now());
      if (explosions && camera) {
        explosions.spawnDeathWorld(player.position.clone(), camera);
      }
    }
  }
}
