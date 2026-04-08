// ── CanyonGeometry.ts ─────────────────────────────────────
// Procedural Mars canyon terrain for the Earth Landing level.
// Generates canyon walls, floor, rock arches, distant mesas,
// and small base equipment near the landing pad.

import * as THREE from 'three';
import { fbm3D, ridgedNoise3D, valueNoise3D } from '../systems/EnvironmentLoader';

// ── Procedural rock normal map — adds micro-cracks, grain, pitting to surfaces ──
function createRockNormalMap(size: number, seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;
      const u = px / size, v = py / size;
      const eps = 1.0 / size;

      // Multi-scale height: large cracks + fine grain + micro pitting
      const h = (s: number, t: number) => {
        const crack = valueNoise3D(s * 15 + seed, t * 15, seed * 0.3) * 0.5;
        const grain = valueNoise3D(s * 60 + seed * 2, t * 60, seed * 0.7) * 0.2;
        const pit = valueNoise3D(s * 120 + seed * 3, t * 120, seed) * 0.1;
        return crack + grain + pit;
      };

      // Central difference for normal
      const hL = h(u - eps, v), hR = h(u + eps, v);
      const hD = h(u, v - eps), hU = h(u, v + eps);
      let nx = (hL - hR) * 4.0;
      let ny = (hD - hU) * 4.0;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;

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

// Shared normal map instance (created once)
let _rockNormalMap: THREE.CanvasTexture | null = null;
function getRockNormalMap(): THREE.CanvasTexture {
  if (!_rockNormalMap) _rockNormalMap = createRockNormalMap(512, 77);
  return _rockNormalMap;
}

// ── Types ────────────────────────────────────────────────

export interface CanyonConfig {
  length: number;       // depth of canyon along Z axis
  baseWidth: number;    // half-width of canyon at floor level
  topWidth: number;     // half-width at the top (wider = flared walls)
  wallHeight: number;   // vertical extent of walls
}

export interface CanyonTerrain {
  group: THREE.Group;
  wallCenterX: { left: number; right: number };
  canyonLength: number;
  cleanup(): void;
}

const DEFAULT_CONFIG: CanyonConfig = {
  length: 20000,
  baseWidth: 120,
  topWidth: 300,
  wallHeight: 1500,
};

// ── Colour helpers ───────────────────────────────────────

/** Mars iron-red base colour, modulated by noise for organic variation. */
function marsRed(noiseVal: number): THREE.Color {
  // Base: rust-red Mars surface
  const r = 0.55 + noiseVal * 0.08;
  const g = 0.28 + noiseVal * 0.05;
  const b = 0.15 + noiseVal * 0.03;
  return new THREE.Color(r, g, b);
}

// ── 1. Canyon Wall ───────────────────────────────────────

/**
 * Builds one canyon wall (left side = -1, right side = 1).
 * A PlaneGeometry displaced with layered noise to create
 * organic crags, sediment stripes, and overhangs.
 */
export function createWall(
  side: -1 | 1,
  config: CanyonConfig = DEFAULT_CONFIG,
  seed: number = 0,
): THREE.Mesh {
  const { length, baseWidth, topWidth, wallHeight } = config;
  const segW = 60; // along length (Z)
  const segH = 30; // along height (Y)

  const geo = new THREE.PlaneGeometry(length, wallHeight, segW, segH);
  geo.rotateY(side === -1 ? Math.PI / 2 : -Math.PI / 2); // face inward

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const vertCount = pos.count;
  const colors = new Float32Array(vertCount * 3);

  // After rotation the wall faces down the canyon:
  //   x-axis = perpendicular into canyon (initially 0)
  //   y-axis = up/down (height)
  //   z-axis = along the canyon length

  for (let i = 0; i < vertCount; i++) {
    const rawX = pos.getX(i);
    const rawY = pos.getY(i);
    const rawZ = pos.getZ(i);

    // Normalised height 0..1  (bottom of wall = 0, top = 1)
    const tY = (rawY + wallHeight * 0.5) / wallHeight;
    // Normalised position along canyon length -1..1
    const tZ = rawZ / (length * 0.5);

    // ── Width flare: canyon widens at the top ──
    // The wall face starts at baseWidth (at floor) and widens to topWidth at top.
    const halfW = THREE.MathUtils.lerp(baseWidth, topWidth, tY);
    const wallX = side * halfW; // the "inward face" X position

    // ── Noise coordinates (scaled for natural feature sizes) ──
    const ns = 0.003; // main structure scale
    const nx = tY * 2.0;
    const ny = (rawZ + seed * 100) * ns;
    const nz = seed * 0.5 + tY;

    // Fbm for large lumps and undulations
    const lumps = fbm3D(nx * 0.8, ny * 0.8, nz, 5) * 30;

    // Ridged noise for sharp crags and cliff faces
    const crags = ridgedNoise3D(nx * 1.5 + 3.1, ny * 1.5 + seed * 0.3, nz + 1.7, 4) * 12;

    // Fine detail grain
    const detail = valueNoise3D(nx * 6 + seed, ny * 6, nz * 2) * 4;

    // Overhang: push top portions outward (away from canyon centre)
    const overhangFactor = Math.max(0, tY - 0.65) / 0.35; // 0 below 65%, rises to 1 at top
    const overhang = ridgedNoise3D(nx * 2 + 7.3, ny * 2, nz + 3.1, 3) * 20 * overhangFactor;

    const totalDisp = lumps + crags + detail + overhang;

    // Apply displacement along the wall normal (pointing inward)
    pos.setX(i, wallX + side * totalDisp);
    pos.setY(i, rawY);
    pos.setZ(i, rawZ);

    // ── Vertex colour: dirty sandstone with iron oxide staining ──
    const stripe = Math.sin(tY * 22 + fbm3D(tZ * 2, tY * 3, seed, 3) * 3.0);
    const bandMix = stripe * 0.5 + 0.5;

    // Base: dirty tan sandstone (not salmon/pink)
    let r = 0.48 + bandMix * 0.10;
    let g = 0.34 + bandMix * 0.06;
    let b = 0.22 + bandMix * 0.03;

    // Dark iron-oxide staining (rusty brown-red streaks)
    const ironBand = Math.pow(Math.max(0, Math.sin(tY * 11 + seed * 3.7) * 0.5 + 0.5 - 0.6) / 0.4, 2);
    r += ironBand * 0.08;
    g -= ironBand * 0.10;
    b -= ironBand * 0.08;

    // Darker grime in crevices (low areas where displacement is negative)
    const grimeFactor = Math.max(0, -totalDisp / 30) * 0.15;
    r -= grimeFactor;
    g -= grimeFactor;
    b -= grimeFactor * 0.8;

    // Lighter dust/weathering near the top
    const dustTop = tY * tY * 0.12;
    r += dustTop;
    g += dustTop * 0.8;
    b += dustTop * 0.6;

    // Fine noise variation
    const noiseColor = valueNoise3D(nx * 4, ny * 4, nz) * 0.06;
    r += noiseColor;
    g += noiseColor * 0.7;
    b += noiseColor * 0.4;

    colors[i * 3] = Math.min(1, Math.max(0, r));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, g));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, b));
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
    flatShading: true,
    normalMap: getRockNormalMap(),
    normalScale: new THREE.Vector2(0.8, 0.8),
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(side * baseWidth, wallHeight * 0.5, 0);
  return mesh;
}

// ── 2. Canyon Floor ──────────────────────────────────────

/**
 * Procedural canyon floor with noise displacement and a
 * central landing pad (flat circle with glowing torus edge).
 */
export function createFloor(
  config: CanyonConfig = DEFAULT_CONFIG,
  seed: number = 0,
): THREE.Group {
  const { length, topWidth } = config;
  const floorGroup = new THREE.Group();

  const floorWidth = topWidth * 2.2;
  const segW = 80;
  const segH = 80;

  // ── Main floor plane ──
  const floorGeo = new THREE.PlaneGeometry(floorWidth, length, segW, segH);
  floorGeo.rotateX(-Math.PI / 2);

  const floorPos = floorGeo.attributes.position as THREE.BufferAttribute;
  const fCount = floorPos.count;
  const fColors = new Float32Array(fCount * 3);

  const PAD_RADIUS = 15;
  const PAD_RADIUS_SQ = PAD_RADIUS * PAD_RADIUS;

  for (let i = 0; i < fCount; i++) {
    const x = floorPos.getX(i);
    const y = floorPos.getY(i); // should be ~0 after rotation; Z is "up" in world
    const z = floorPos.getZ(i);

    // Distance from pad centre (world origin)
    const distSq = x * x + z * z;
    const padFade = 1 - Math.min(1, distSq / (PAD_RADIUS_SQ * 9)); // smooth out to 3× pad radius

    // ── Height displacement — flattened near landing pad ──
    const ns = 0.0025;
    const noiseH = fbm3D(x * ns + seed, z * ns, seed * 0.3, 6) * 14
      + ridgedNoise3D(x * ns * 2 + seed * 2, z * ns * 2, seed + 1, 3) * 5
      + valueNoise3D(x * ns * 8, z * ns * 8, seed) * 2;

    const disp = noiseH * (1 - padFade * padFade);
    floorPos.setY(i, y + disp);

    // ── Floor vertex colours — dusty tan sandstone ──
    const colNoise = valueNoise3D(x * 0.01 + seed, z * 0.01, seed * 0.7);
    const r = 0.46 + colNoise * 0.08;
    const g = 0.34 + colNoise * 0.05;
    const bl = 0.22 + colNoise * 0.03;
    fColors[i * 3] = Math.min(1, r);
    fColors[i * 3 + 1] = Math.min(1, g);
    fColors[i * 3 + 2] = Math.min(1, bl);
  }

  floorGeo.setAttribute('color', new THREE.BufferAttribute(fColors, 3));
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
    normalMap: getRockNormalMap(),
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorGroup.add(floorMesh);

  // ── Landing pad surface ──
  const padGeo = new THREE.CircleGeometry(PAD_RADIUS, 48);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x707880,
    roughness: 0.6,
    metalness: 0.35,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.position.y = 0.05; // tiny lift to prevent z-fighting
  floorGroup.add(padMesh);

  // ── Landing pad glowing edge ring ──
  const ringGeo = new THREE.TorusGeometry(PAD_RADIUS, 0.4, 8, 64);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: new THREE.Color(0x00cccc),
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.8,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.position.y = 0.15;
  floorGroup.add(ringMesh);

  return floorGroup;
}

// ── 3. Rock Arch ─────────────────────────────────────────

/**
 * A single TorusGeometry arch spanning the canyon width at mid-height.
 * Vertices are displaced with noise to look like eroded sandstone.
 */
export function createArch(
  z: number,
  config: CanyonConfig = DEFAULT_CONFIG,
  seed: number = 0,
): THREE.Mesh {
  const span = config.baseWidth * 2 + 30; // span slightly wider than floor
  const thickness = 10 + valueNoise3D(seed, z * 0.01, 1) * 5;
  const arcHeight = config.wallHeight * 0.45;

  // TorusGeometry(radius, tube, radialSegs, tubularSegs, arc)
  // arc = Math.PI → half-torus = arch
  const geo = new THREE.TorusGeometry(span / 2, thickness, 12, 24, Math.PI);

  // Rotate so the arch opens downward and spans left-right
  geo.rotateZ(Math.PI); // open side down
  geo.rotateX(Math.PI / 2); // lay in XY plane

  // Displace vertices for rocky appearance
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const vz = pos.getZ(i);
    const ns = 0.04;
    const disp = fbm3D(x * ns + seed, y * ns, vz * ns + seed * 2, 4) * 8
      + valueNoise3D(x * ns * 3 + seed, y * ns * 3, vz * ns * 3) * 3;
    const len = Math.sqrt(x * x + y * y + vz * vz) || 1;
    pos.setXYZ(i, x + (x / len) * disp, y + (y / len) * disp, vz + (vz / len) * disp);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.48, 0.26, 0.13),
    roughness: 0.9,
    metalness: 0.03,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, arcHeight, z);
  return mesh;
}

// ── 4. Distant Mesas ─────────────────────────────────────

/**
 * 8-12 mesa silhouettes positioned around the horizon to fill
 * the skyline with Martian geology.
 */
export function createMesas(
  config: CanyonConfig = DEFAULT_CONFIG,
  seed: number = 0,
): THREE.Group {
  const group = new THREE.Group();
  const count = 8 + Math.floor(valueNoise3D(seed, 0, 0) * 0.5 + 0.5 + 0.01) * 4; // 8-12

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seed * 0.3;
    const dist = 800 + valueNoise3D(i, seed, 2) * 0.5 * 400 + 200; // 800-1200
    const px = Math.cos(angle) * dist;
    const pz = Math.sin(angle) * dist;

    const w = 120 + valueNoise3D(i * 3, seed + 1, 0) * 0.5 * 180;
    const h = 80 + valueNoise3D(i * 7, seed + 2, 1) * 0.5 * 200;
    const d = 100 + valueNoise3D(i * 5, seed + 3, 2) * 0.5 * 150;

    // BoxGeometry with noise-displaced cliff faces but flat top
    const mGeo = new THREE.BoxGeometry(w, h, d, 6, 4, 6);
    const mPos = mGeo.attributes.position as THREE.BufferAttribute;

    for (let v = 0; v < mPos.count; v++) {
      const vx = mPos.getX(v);
      const vy = mPos.getY(v);
      const vz = mPos.getZ(v);

      // Only displace sides, keep top flat (vy near h/2)
      const topness = Math.max(0, (vy / (h / 2) - 0.6) / 0.4); // 0 on sides, 1 at top
      const ns = 0.008;
      const cliff = fbm3D(vx * ns + i, vy * ns, vz * ns + seed, 4) * 18 * (1 - topness);

      const nx = vx / (w / 2 + 0.01);
      const nz = vz / (d / 2 + 0.01);
      const lateralMag = Math.sqrt(nx * nx + nz * nz) || 1;
      mPos.setX(v, vx + (nx / lateralMag) * cliff * 0.7);
      mPos.setZ(v, vz + (nz / lateralMag) * cliff * 0.7);
    }
    mGeo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.42, 0.28, 0.18),
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });

    const mesa = new THREE.Mesh(mGeo, mat);
    mesa.position.set(px, h / 2, pz);
    group.add(mesa);
  }

  return group;
}

// ── 5. Base Equipment ────────────────────────────────────

/** Creates a single geodesic dome with wireframe overlay and copper top. */
function createDome(radius: number, px: number, pz: number): THREE.Group {
  const domeGroup = new THREE.Group();
  const detail = radius > 15 ? 3 : 2;

  // Dome shell — half icosahedron (clip bottom half)
  const shellGeo = new THREE.IcosahedronGeometry(radius, detail);
  const shellPos = shellGeo.attributes.position as THREE.BufferAttribute;
  // Push vertices below equator up to equator (creates flat bottom)
  for (let i = 0; i < shellPos.count; i++) {
    if (shellPos.getY(i) < 0) shellPos.setY(i, 0);
  }
  shellGeo.computeVertexNormals();

  // Shell material — white/light grey panels
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce0,
    roughness: 0.3,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  domeGroup.add(new THREE.Mesh(shellGeo, shellMat));

  // Wireframe overlay — dark structural grid lines
  const wireGeo = new THREE.IcosahedronGeometry(radius * 1.003, detail);
  const wirePos = wireGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < wirePos.count; i++) {
    if (wirePos.getY(i) < 0) wirePos.setY(i, 0);
  }
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x334455,
    wireframe: true,
  });
  domeGroup.add(new THREE.Mesh(wireGeo, wireMat));

  // Copper/orange top cap — upper hemisphere tinted
  const capGeo = new THREE.IcosahedronGeometry(radius * 0.6, detail);
  const capPos = capGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < capPos.count; i++) {
    if (capPos.getY(i) < radius * 0.25) capPos.setY(i, radius * 0.25);
  }
  capGeo.computeVertexNormals();
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xcc6633,
    roughness: 0.4,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = radius * 0.35;
  domeGroup.add(cap);

  // Base ring — cylindrical foundation
  const baseGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.1, radius * 0.15, 24);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.6,
    metalness: 0.5,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = radius * 0.075;
  domeGroup.add(base);

  domeGroup.position.set(px, 0, pz);
  return domeGroup;
}

/** Connecting corridor between two dome positions. */
function createCorridor(x1: number, z1: number, x2: number, z2: number, tubeRadius: number): THREE.Mesh {
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  const geo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, length, 12);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xaab0b8,
    roughness: 0.4,
    metalness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x1 + x2) / 2, tubeRadius * 1.2, (z1 + z2) / 2);
  mesh.rotation.y = -angle;
  return mesh;
}

/**
 * Mars base colony — geodesic domes with connecting corridors,
 * clustered near the landing pad.
 */
export function createBaseColony(): THREE.Group {
  const group = new THREE.Group();

  // Dome positions and sizes [radius, x, z]
  const domes: [number, number, number][] = [
    [25, -50, -40],    // large central dome
    [18, -90, -30],    // medium left
    [15, -40, -80],    // medium right-back
    [20, -80, -75],    // medium far
    [12, -110, -60],   // small far-left
  ];

  for (const [r, x, z] of domes) {
    group.add(createDome(r, x, z));
  }

  // Connecting corridors between adjacent domes
  group.add(createCorridor(-50, -40, -90, -30, 3));   // central → left
  group.add(createCorridor(-50, -40, -40, -80, 3));   // central → right-back
  group.add(createCorridor(-90, -30, -80, -75, 2.5)); // left → far
  group.add(createCorridor(-90, -30, -110, -60, 2));  // left → far-left
  group.add(createCorridor(-80, -75, -40, -80, 2.5)); // far → right-back

  // Flat pad area under the colony
  const padGeo = new THREE.CircleGeometry(80, 32);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x606060,
    roughness: 0.7,
    metalness: 0.2,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.set(-70, 0.1, -55);
  group.add(pad);

  return group;
}

// ── 6. Main Entry — createCanyonTerrain ──────────────────

/**
 * Assembles the full Mars canyon terrain:
 * walls, floor, arches, mesas, base equipment, and lighting.
 *
 * @param scene  Three.js scene to add lighting into
 * @param seed   Optional random seed (default 42)
 * @returns      CanyonTerrain handle with cleanup
 */
export function createCanyonTerrain(
  scene: THREE.Scene,
  seed: number = 42,
): CanyonTerrain {
  const config: CanyonConfig = { ...DEFAULT_CONFIG };
  const group = new THREE.Group();

  // ── Walls ──
  const leftWall = createWall(-1, config, seed);
  const rightWall = createWall(1, config, seed + 1337);
  group.add(leftWall, rightWall);

  // ── Floor ──
  const floor = createFloor(config, seed);
  group.add(floor);

  // ── Geodesic dome colony near the launch pad ──
  const colony = createBaseColony();
  group.add(colony);

  // ── Mars planet sphere — massive textured surface ──
  const MARS_RADIUS = 100000;
  const marsGeo = new THREE.SphereGeometry(MARS_RADIUS, 128, 96);

  // Procedural Mars surface texture
  const texW = 2048, texH = 1024;
  const marsCanvas = document.createElement('canvas');
  marsCanvas.width = texW; marsCanvas.height = texH;
  const mCtx = marsCanvas.getContext('2d')!;

  // Base rusty red
  mCtx.fillStyle = '#8b3a1a';
  mCtx.fillRect(0, 0, texW, texH);

  // Large dark highland regions
  let _ms = seed + 777;
  const _mr = () => { _ms = (_ms * 16807 + 7) % 2147483647; return (_ms - 1) / 2147483646; };
  for (let i = 0; i < 60; i++) {
    const cx = _mr() * texW, cy = _mr() * texH, cr = 30 + _mr() * 200;
    const g = mCtx.createRadialGradient(cx, cy, cr * 0.1, cx, cy, cr);
    g.addColorStop(0, `rgba(60, 20, 8, ${0.15 + _mr() * 0.2})`);
    g.addColorStop(0.6, `rgba(80, 30, 12, ${0.05 + _mr() * 0.1})`);
    g.addColorStop(1, 'rgba(80, 30, 12, 0)');
    mCtx.fillStyle = g;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.fill();
  }

  // Lighter dust plains
  for (let i = 0; i < 40; i++) {
    const cx = _mr() * texW, cy = _mr() * texH, cr = 40 + _mr() * 150;
    const g = mCtx.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
    g.addColorStop(0, `rgba(180, 100, 50, ${0.08 + _mr() * 0.12})`);
    g.addColorStop(1, 'rgba(180, 100, 50, 0)');
    mCtx.fillStyle = g;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.fill();
  }

  // Impact craters
  for (let i = 0; i < 30; i++) {
    const cx = _mr() * texW, cy = _mr() * texH, cr = 5 + _mr() * 40;
    mCtx.strokeStyle = `rgba(50, 18, 8, ${0.2 + _mr() * 0.2})`;
    mCtx.lineWidth = 1 + _mr() * 2;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.stroke();
    // Crater shadow
    const sg = mCtx.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, 0, cx, cy, cr * 0.8);
    sg.addColorStop(0, `rgba(40, 15, 5, ${0.1 + _mr() * 0.1})`);
    sg.addColorStop(1, 'rgba(40, 15, 5, 0)');
    mCtx.fillStyle = sg;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr * 0.8, 0, Math.PI * 2); mCtx.fill();
  }

  // Polar ice caps (white at top/bottom of texture)
  for (const yBase of [0, texH - 60]) {
    const capG = mCtx.createLinearGradient(0, yBase, 0, yBase + (yBase === 0 ? 60 : 0));
    capG.addColorStop(0, yBase === 0 ? 'rgba(200, 180, 160, 0.35)' : 'rgba(200, 180, 160, 0)');
    capG.addColorStop(1, yBase === 0 ? 'rgba(200, 180, 160, 0)' : 'rgba(200, 180, 160, 0.35)');
    mCtx.fillStyle = capG;
    mCtx.fillRect(0, yBase, texW, 60);
  }

  const marsTex = new THREE.CanvasTexture(marsCanvas);
  marsTex.colorSpace = THREE.SRGBColorSpace;
  marsTex.anisotropy = 4;
  marsTex.wrapS = THREE.RepeatWrapping;

  const marsMat = new THREE.MeshStandardMaterial({
    map: marsTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const marsSphere = new THREE.Mesh(marsGeo, marsMat);
  // Position so the top overlaps slightly ABOVE canyon floor (no gap)
  marsSphere.position.y = -MARS_RADIUS + 50;
  group.add(marsSphere);

  // ── End wall — blocks the far end, forces player to climb UP ──
  const endWallGeo = new THREE.PlaneGeometry(config.topWidth * 2.5, config.wallHeight, 30, 20);
  const endPos = endWallGeo.attributes.position as THREE.BufferAttribute;
  const endColors = new Float32Array(endPos.count * 3);
  for (let i = 0; i < endPos.count; i++) {
    const x = endPos.getX(i), y = endPos.getY(i), z = endPos.getZ(i);
    const tY = (y + config.wallHeight / 2) / config.wallHeight;
    // Noise displacement — push the wall forward/back for craggy face
    const ns = 0.003;
    const disp = fbm3D(x * ns + seed + 999, tY * 2, seed * 0.8, 4) * 40
      + ridgedNoise3D(x * ns * 2 + seed, tY * 3, seed + 5, 3) * 15;
    endPos.setZ(i, z + disp);
    // Sandstone colors matching walls
    const stripe = Math.sin(tY * 22 + fbm3D(x * ns, tY * 3, seed + 999, 3) * 3) * 0.5 + 0.5;
    endColors[i * 3]     = Math.min(1, 0.48 + stripe * 0.10);
    endColors[i * 3 + 1] = Math.min(1, 0.34 + stripe * 0.06);
    endColors[i * 3 + 2] = Math.min(1, 0.22 + stripe * 0.03);
  }
  endWallGeo.setAttribute('color', new THREE.BufferAttribute(endColors, 3));
  endWallGeo.computeVertexNormals();
  const endWallMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.04,
    side: THREE.DoubleSide, flatShading: true,
    normalMap: getRockNormalMap(), normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const endWall = new THREE.Mesh(endWallGeo, endWallMat);
  endWall.position.set(0, config.wallHeight / 2, config.length / 2); // at the far end
  group.add(endWall);

  // ── Lighting ──
  // Warm Mars sun — low angle directional light (dust-filtered orange sun)
  const sunLight = new THREE.DirectionalLight(0xffb060, 1.4);
  sunLight.position.set(300, 400, -200);
  sunLight.castShadow = false;
  scene.add(sunLight);

  // Ambient fill — slightly pinkish sky glow (dust in atmosphere)
  const ambientLight = new THREE.AmbientLight(0xd08070, 0.55);
  scene.add(ambientLight);

  // Subtle secondary fill from the canyon walls bouncing warm light
  const fillLight = new THREE.HemisphereLight(0xc06040, 0x602010, 0.3);
  scene.add(fillLight);

  // ── Return handle ──
  const wallCenterX = {
    left: -(config.baseWidth),
    right: config.baseWidth,
  };

  return {
    group,
    wallCenterX,
    canyonLength: config.length,
    cleanup() {
      scene.remove(group);
      scene.remove(sunLight);
      scene.remove(ambientLight);
      scene.remove(fillLight);

      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            (obj.material as THREE.Material).dispose();
          }
        }
      });
    },
  };
}
