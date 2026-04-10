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
/** Optional cavern cutout — pushes wall vertices outward to create an opening. */
export interface CavernCutout {
  zCenter: number;   // center Z of the opening
  zWidth: number;    // full width of opening along Z
  height: number;    // how high the opening goes (from floor)
  depth: number;     // how far the wall is pushed outward
}

export function createWall(
  side: -1 | 1,
  config: CanyonConfig = DEFAULT_CONFIG,
  seed: number = 0,
  cutout?: CavernCutout,
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

    // ── Cavern cutout — push wall outward to carve an opening ──
    let cutoutDisp = 0;
    if (cutout && side === 1) {
      const vertY = rawY + wallHeight * 0.5; // actual Y from floor (0 = floor)
      const zDist = Math.abs(rawZ - cutout.zCenter);
      const zHalf = cutout.zWidth / 2;
      const inZRange = zDist < zHalf;
      const inYRange = vertY < cutout.height;
      if (inZRange && inYRange) {
        // Smooth falloff at edges so the opening blends into the rock
        const zEdge = 1 - Math.pow(zDist / zHalf, 4);
        const yEdge = 1 - Math.pow(vertY / cutout.height, 4);
        cutoutDisp = cutout.depth * zEdge * yEdge;
      }
    }

    // Apply displacement along the wall normal (pointing inward)
    pos.setX(i, wallX + side * (totalDisp + cutoutDisp));
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

/** Builds 3D tube struts along geodesic edges of the upper hemisphere. */
function buildGeodesicStruts(radius: number, detail: number, barRadius: number, mat: THREE.MeshStandardMaterial): THREE.Group {
  const struts = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(radius, detail);
  const pos = ico.getAttribute('position');
  const idx = ico.getIndex();
  const yThresh = -radius * 0.05;

  // Read triangles — handle both indexed and non-indexed geometry
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  function getVert(triIdx: number, vertIdx: number): THREE.Vector3 {
    const i = idx ? idx.getX(triIdx * 3 + vertIdx) : triIdx * 3 + vertIdx;
    return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  }

  // Collect unique edges (upper hemisphere only)
  const edgeSet = new Set<string>();
  const edges: [THREE.Vector3, THREE.Vector3][] = [];

  for (let t = 0; t < triCount; t++) {
    const v0 = getVert(t, 0), v1 = getVert(t, 1), v2 = getVert(t, 2);
    if (v0.y < yThresh || v1.y < yThresh || v2.y < yThresh) continue;

    const tri = [v0, v1, v2];
    for (let j = 0; j < 3; j++) {
      const a = tri[j], b = tri[(j + 1) % 3];
      // Deduplicate edges by sorting endpoint coords
      const ax = a.x.toFixed(2), ay = a.y.toFixed(2), az = a.z.toFixed(2);
      const bx = b.x.toFixed(2), by = b.y.toFixed(2), bz = b.z.toFixed(2);
      const key = `${ax},${ay},${az}` < `${bx},${by},${bz}`
        ? `${ax},${ay},${az}|${bx},${by},${bz}`
        : `${bx},${by},${bz}|${ax},${ay},${az}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([a.clone(), b.clone()]);
      }
    }
  }

  // Build a tube mesh for each edge
  for (const [a, b] of edges) {
    const path = new THREE.LineCurve3(a, b);
    const tubeGeo = new THREE.TubeGeometry(path, 1, barRadius, 6, false);
    struts.add(new THREE.Mesh(tubeGeo, mat));
  }

  ico.dispose();
  return struts;
}

/** Creates a detailed geodesic dome with 3D triangulated roof bars, windows, and antenna. */
function createDome(radius: number, px: number, pz: number): THREE.Group {
  const domeGroup = new THREE.Group();

  // Solid dome shell — opaque panels between the bars
  const shellGeo = new THREE.SphereGeometry(radius * 0.995, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8e0,
    roughness: 0.2,
    metalness: 0.6,
  });
  domeGroup.add(new THREE.Mesh(shellGeo, shellMat));

  // Geodesic roof bars — dark metal, clearly raised above the shell
  const barMat = new THREE.MeshStandardMaterial({
    color: 0x667788,
    roughness: 0.6,
    metalness: 0.4,
  });
  const fineStruts = buildGeodesicStruts(radius * 1.04, 2, radius * 0.018, barMat);
  domeGroup.add(fineStruts);

  // Heavy structural ribs — thick dark beams
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x556677,
    roughness: 0.5,
    metalness: 0.5,
  });
  const heavyStruts = buildGeodesicStruts(radius * 1.06, 1, radius * 0.035, ribMat);
  domeGroup.add(heavyStruts);

  // Hub nodes at structural intersections — small spheres where heavy ribs meet
  const hubGeo = new THREE.SphereGeometry(radius * 0.035, 8, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.5, metalness: 0.5 });
  const icoRef = new THREE.IcosahedronGeometry(radius * 1.065, 1);
  const icoPos = icoRef.getAttribute('position');
  const hubSet = new Set<string>();
  for (let i = 0; i < icoPos.count; i++) {
    const y = icoPos.getY(i);
    if (y < -radius * 0.05) continue;
    const key = `${icoPos.getX(i).toFixed(1)},${icoPos.getY(i).toFixed(1)},${icoPos.getZ(i).toFixed(1)}`;
    if (hubSet.has(key)) continue;
    hubSet.add(key);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(icoPos.getX(i), icoPos.getY(i), icoPos.getZ(i));
    domeGroup.add(hub);
  }
  icoRef.dispose();

  // Glowing window band — cyan ring
  const windowGeo = new THREE.TorusGeometry(radius * 0.85, radius * 0.04, 8, 64);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.7 });
  const windowRing = new THREE.Mesh(windowGeo, windowMat);
  windowRing.rotation.x = -Math.PI / 2;
  windowRing.position.y = radius * 0.35;
  domeGroup.add(windowRing);

  // Antenna/spire
  const spireGeo = new THREE.CylinderGeometry(radius * 0.01, radius * 0.03, radius * 0.3, 8);
  const spireMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.4, metalness: 0.8 });
  const spire = new THREE.Mesh(spireGeo, spireMat);
  spire.position.y = radius + radius * 0.15;
  domeGroup.add(spire);

  // Blinking light on tip
  const tipGeo = new THREE.SphereGeometry(radius * 0.025, 8, 8);
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.y = radius + radius * 0.3;
  domeGroup.add(tip);

  // Base ring — concrete foundation
  const baseGeo = new THREE.CylinderGeometry(radius * 1.08, radius * 1.14, radius * 0.18, 48);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.2 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = radius * 0.09;
  domeGroup.add(base);

  // Inner glow
  const glowLight = new THREE.PointLight(0x66ddff, 0.5, radius * 3);
  glowLight.position.y = radius * 0.3;
  domeGroup.add(glowLight);

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
 * Mars base colony — geodesic domes inside a massive cavern
 * carved into the RIGHT canyon wall, near the launch pad.
 * Player starts at (0, 15, -8000) facing up canyon.
 * The cavern opens at the right wall (X ≈ +120) and extends
 * deep into the rock. Warm lighting illuminates the interior.
 */
export function createBaseColony(): THREE.Group {
  const group = new THREE.Group();

  // ── Cavern — open-front chamber carved into the right wall ──
  const cavernW = 800;  // depth into wall (X)
  const cavernH = 250;  // ceiling height (Y)
  const cavernD = 900;  // width along canyon (Z)
  const wallX = 50;     // entrance X — just past canyon center so domes are RIGHT THERE
  const cx = wallX + cavernW / 2;  // center X
  const cz = -7950;     // centered on player Z (-8000) but slightly ahead

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x1a0e08,
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // Ceiling — massive slab, orangish brown to match canyon walls
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x8a5030,
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const ceilWidth = cavernW + 800;
  const ceilDepth = cavernD + 2000; // massively oversized to embed into canyon walls
  const ceilGeo = new THREE.BoxGeometry(ceilWidth, 200, ceilDepth);
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.position.set(wallX + ceilWidth / 2, cavernH + 100, cz);
  group.add(ceil);

  // Back wall (far +X side)
  const backGeo = new THREE.PlaneGeometry(cavernD, cavernH);
  backGeo.rotateY(-Math.PI / 2); // face -X (toward entrance)
  const back = new THREE.Mesh(backGeo, rockMat);
  back.position.set(wallX + cavernW, cavernH / 2, cz);
  group.add(back);

  // No side walls — the canyon wall cutout wraps around naturally

  // Floor — dark rock
  const floorGeo = new THREE.PlaneGeometry(cavernW, cavernD);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x4a3020,
    roughness: 0.85,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(cx, 0.5, cz);
  group.add(floor);

  // NO left wall — that's the open entrance facing the canyon

  // ── Domes — clustered near the entrance so visible from the canyon ──
  const ex = wallX + 120; // dome cluster center — near the entrance
  const domes: [number, number, number][] = [
    [80,  ex,        cz],          // large central hub
    [55,  ex + 10,   cz + 150],    // medium front
    [55,  ex + 10,   cz - 150],    // medium back
    [60,  ex + 160,  cz + 80],     // medium deeper-front
    [60,  ex + 160,  cz - 80],     // medium deeper-back
    [40,  ex + 280,  cz],          // small deepest
    [35,  ex - 50,   cz + 280],    // small near entrance-front
  ];

  for (const [r, x, z] of domes) {
    group.add(createDome(r, x, z));
  }

  // ── Connecting corridors ──
  group.add(createCorridor(ex, cz, ex + 10, cz + 150, 8));
  group.add(createCorridor(ex, cz, ex + 10, cz - 150, 8));
  group.add(createCorridor(ex, cz, ex + 160, cz + 80, 8));
  group.add(createCorridor(ex, cz, ex + 160, cz - 80, 8));
  group.add(createCorridor(ex + 160, cz + 80, ex + 280, cz, 6));
  group.add(createCorridor(ex + 160, cz - 80, ex + 280, cz, 6));
  group.add(createCorridor(ex + 10, cz + 150, ex - 50, cz + 280, 6));

  // ── Cavern lighting — warm amber glow throughout ──
  // Central overhead
  const mainLight = new THREE.PointLight(0xffaa44, 3, 600);
  mainLight.position.set(cx, cavernH * 0.8, cz);
  group.add(mainLight);

  // Front fill — illuminates domes facing the canyon opening
  const frontLight = new THREE.PointLight(0xff9933, 2, 400);
  frontLight.position.set(cx - 100, 60, cz + 100);
  group.add(frontLight);

  // Back fill
  const backLight = new THREE.PointLight(0xff8822, 1.5, 350);
  backLight.position.set(cx + 80, 50, cz - 100);
  group.add(backLight);

  // Cool blue accent lights near the floor — tech/industrial feel
  const blueLight1 = new THREE.PointLight(0x4488ff, 1, 200);
  blueLight1.position.set(cx - 60, 5, cz + 60);
  group.add(blueLight1);

  const blueLight2 = new THREE.PointLight(0x4488ff, 1, 200);
  blueLight2.position.set(cx + 80, 5, cz - 40);
  group.add(blueLight2);

  // Red warning lights at cavern entrance edges
  const redLight1 = new THREE.PointLight(0xff2200, 1.5, 150);
  redLight1.position.set(120, 30, cz - 80);
  group.add(redLight1);

  const redLight2 = new THREE.PointLight(0xff2200, 1.5, 150);
  redLight2.position.set(120, 30, cz + 80);
  group.add(redLight2);

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
  // Carve a cavern opening in the right wall for the dome colony
  const rightWall = createWall(1, config, seed + 1337, {
    zCenter: -7950,
    zWidth: 900,
    height: 250,
    depth: 800,
  });
  group.add(leftWall, rightWall);

  // ── Floor ──
  const floor = createFloor(config, seed);
  group.add(floor);

  // ── Dome colony — nestled in the canyon near the launch pad ──
  const colony = createBaseColony();
  group.add(colony);

  // ── Mars planet sphere — massive textured surface ──
  const MARS_RADIUS = 100000;

  // ── Procedural Mars surface texture ──
  const texSize = 2048;
  const marsCanvas = document.createElement('canvas');
  marsCanvas.width = texSize; marsCanvas.height = texSize;
  const mCtx = marsCanvas.getContext('2d')!;
  let _ms = seed + 777;
  const _mr = () => { _ms = (_ms * 16807 + 7) % 2147483647; return (_ms - 1) / 2147483646; };

  // Base: varied rusty terrain
  const baseGrad = mCtx.createRadialGradient(texSize * 0.4, texSize * 0.5, 0, texSize * 0.5, texSize * 0.5, texSize * 0.7);
  baseGrad.addColorStop(0, '#8a5030');
  baseGrad.addColorStop(0.3, '#7a4528');
  baseGrad.addColorStop(0.6, '#6a3a20');
  baseGrad.addColorStop(1, '#5a3018');
  mCtx.fillStyle = baseGrad;
  mCtx.fillRect(0, 0, texSize, texSize);

  // Large dark highland/volcanic regions
  for (let i = 0; i < 80; i++) {
    const cx = _mr() * texSize, cy = _mr() * texSize;
    const cr = 20 + _mr() * 250;
    const g = mCtx.createRadialGradient(cx, cy, cr * 0.05, cx, cy, cr);
    const dark = _mr() > 0.5;
    g.addColorStop(0, dark ? `rgba(35, 15, 8, ${0.2 + _mr() * 0.25})` : `rgba(140, 80, 40, ${0.1 + _mr() * 0.15})`);
    g.addColorStop(0.5, dark ? `rgba(45, 20, 10, ${0.1 + _mr() * 0.1})` : `rgba(120, 70, 35, ${0.05})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mCtx.fillStyle = g;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.fill();
  }

  // Impact craters with rims and shadows
  for (let i = 0; i < 50; i++) {
    const cx = _mr() * texSize, cy = _mr() * texSize;
    const cr = 3 + _mr() * 60;
    // Shadow inside
    const sg = mCtx.createRadialGradient(cx - cr * 0.15, cy - cr * 0.15, 0, cx, cy, cr);
    sg.addColorStop(0, `rgba(30, 12, 6, ${0.15 + _mr() * 0.2})`);
    sg.addColorStop(0.6, `rgba(40, 18, 8, ${0.05})`);
    sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    mCtx.fillStyle = sg;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.fill();
    // Bright rim (ejecta)
    mCtx.strokeStyle = `rgba(160, 100, 60, ${0.1 + _mr() * 0.15})`;
    mCtx.lineWidth = 1 + _mr() * 3;
    mCtx.beginPath(); mCtx.arc(cx, cy, cr, 0, Math.PI * 2); mCtx.stroke();
    // Ejecta rays on larger craters
    if (cr > 25) {
      const rays = 4 + Math.floor(_mr() * 5);
      for (let r = 0; r < rays; r++) {
        const angle = _mr() * Math.PI * 2;
        const rayLen = cr * (1.5 + _mr() * 2);
        mCtx.strokeStyle = `rgba(150, 95, 55, ${0.04 + _mr() * 0.06})`;
        mCtx.lineWidth = 1 + _mr() * 2;
        mCtx.beginPath();
        mCtx.moveTo(cx + Math.cos(angle) * cr, cy + Math.sin(angle) * cr);
        mCtx.lineTo(cx + Math.cos(angle) * rayLen, cy + Math.sin(angle) * rayLen);
        mCtx.stroke();
      }
    }
  }

  // Fine noise grain overlay
  const imgData = mCtx.getImageData(0, 0, texSize, texSize);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (_mr() - 0.5) * 12;
    pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));
    pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise * 0.7));
    pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise * 0.5));
  }
  mCtx.putImageData(imgData, 0, 0);

  const marsTex = new THREE.CanvasTexture(marsCanvas);
  marsTex.colorSpace = THREE.SRGBColorSpace;
  marsTex.anisotropy = 4;

  const marsMat = new THREE.MeshStandardMaterial({
    map: marsTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const marsGeo = new THREE.SphereGeometry(MARS_RADIUS, 128, 96);
  const marsSphere = new THREE.Mesh(marsGeo, marsMat);
  marsSphere.position.y = -MARS_RADIUS + config.wallHeight;
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
