// ── CanyonGeometry.ts ─────────────────────────────────────
// Procedural Mars canyon terrain for the Earth Landing level.
// Generates canyon walls, floor, rock arches, distant mesas,
// and small base equipment near the landing pad.

import * as THREE from 'three';
import { fbm3D, ridgedNoise3D, valueNoise3D } from '../systems/EnvironmentLoader';

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
  length: 2000,
  baseWidth: 80,
  topWidth: 200,
  wallHeight: 500,
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

    // ── Vertex colour: sediment banding + dust + iron ──
    // Sediment stripes (horizontal bands in geological layers)
    const stripe = Math.sin(tY * 18 + fbm3D(tZ * 2, tY * 3, seed, 3) * 2.5);
    const bandMix = stripe * 0.5 + 0.5; // 0..1

    // Base Mars iron-red
    let r = 0.55 + bandMix * 0.08;
    let g = 0.28 + bandMix * 0.04;
    let b = 0.15 + bandMix * 0.02;

    // Dark iron-oxide bands (near-black)
    const ironBand = Math.pow(Math.max(0, Math.sin(tY * 9 + seed * 3.7) * 0.5 + 0.5 - 0.7) / 0.3, 2);
    r -= ironBand * 0.22;
    g -= ironBand * 0.14;
    b -= ironBand * 0.06;

    // Lighter dust accumulation near the top
    const dustTop = tY * tY * 0.18;
    r += dustTop;
    g += dustTop * 0.7;
    b += dustTop * 0.55;

    // Fine noise variation
    const noiseColor = valueNoise3D(nx * 4, ny * 4, nz) * 0.06;
    r += noiseColor;
    g += noiseColor * 0.5;

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
  });

  const mesh = new THREE.Mesh(geo, mat);
  // Translate wall away from canyon centre (Y centred, Z centred)
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

    // ── Floor vertex colours — dusty reddish with rock variation ──
    const colNoise = valueNoise3D(x * 0.01 + seed, z * 0.01, seed * 0.7);
    const r = 0.52 + colNoise * 0.07;
    const g = 0.27 + colNoise * 0.04;
    const bl = 0.14 + colNoise * 0.02;
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
      color: new THREE.Color(0.38, 0.20, 0.10),
      roughness: 0.96,
      metalness: 0.0,
    });

    const mesa = new THREE.Mesh(mGeo, mat);
    mesa.position.set(px, h / 2, pz);
    group.add(mesa);
  }

  return group;
}

// ── 5. Base Equipment ────────────────────────────────────

/**
 * Small structures clustered around the landing pad:
 * antenna dish, fuel tanks, cargo containers.
 */
export function createBaseEquipment(): THREE.Group {
  const group = new THREE.Group();

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xb0b8c0,
    roughness: 0.4,
    metalness: 0.7,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x607080,
    roughness: 0.5,
    metalness: 0.6,
  });
  const orangeMat = new THREE.MeshStandardMaterial({
    color: 0xd0602a,
    roughness: 0.5,
    metalness: 0.3,
  });

  // ── Antenna dish ──
  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.3, 0.35, 12, 8);
  const pole = new THREE.Mesh(poleGeo, metalMat);
  pole.position.set(22, 6, 18);
  group.add(pole);
  // Dish arm
  const armGeo = new THREE.CylinderGeometry(0.2, 0.2, 5, 6);
  armGeo.rotateZ(Math.PI / 4);
  const arm = new THREE.Mesh(armGeo, metalMat);
  arm.position.set(22 + 2.2, 12.5, 18);
  group.add(arm);
  // Dish bowl (sphere segment)
  const dishGeo = new THREE.SphereGeometry(3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
  dishGeo.rotateX(Math.PI); // open side up-ish
  const dish = new THREE.Mesh(dishGeo, metalMat);
  dish.position.set(22 + 3.5, 14.5, 18);
  dish.rotation.y = Math.PI * 0.3;
  group.add(dish);

  // ── Fuel tanks (3 cylinders) ──
  const tankPositions = [
    [-20, 0, 15],
    [-24, 0, 22],
    [-17, 0, 26],
  ] as const;
  for (const [tx, , tz] of tankPositions) {
    const tankH = 6 + Math.random() * 3;
    const tankR = 1.8;
    const tankGeo = new THREE.CylinderGeometry(tankR, tankR, tankH, 12);
    const tank = new THREE.Mesh(tankGeo, orangeMat);
    tank.position.set(tx, tankH / 2, tz);
    group.add(tank);
    // End caps
    const capGeo = new THREE.SphereGeometry(tankR, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const capTop = new THREE.Mesh(capGeo, orangeMat);
    capTop.position.set(tx, tankH, tz);
    group.add(capTop);
    const capBot = new THREE.Mesh(capGeo, orangeMat);
    capBot.rotation.x = Math.PI;
    capBot.position.set(tx, 0, tz);
    group.add(capBot);
  }

  // ── Cargo containers (2 boxes) ──
  const containerDefs = [
    { x: 28, z: -18, w: 8, h: 4, d: 4 },
    { x: 18, z: -24, w: 6, h: 4, d: 4 },
  ];
  for (const cd of containerDefs) {
    const cGeo = new THREE.BoxGeometry(cd.w, cd.h, cd.d);
    const container = new THREE.Mesh(cGeo, darkMetalMat);
    container.position.set(cd.x, cd.h / 2, cd.z);
    container.rotation.y = (Math.random() - 0.5) * 0.4;
    group.add(container);
  }

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

  // ── Arches (2-3 spanning the canyon at different depths) ──
  const archZPositions = [-300, 200, -700];
  for (let ai = 0; ai < archZPositions.length; ai++) {
    const arch = createArch(archZPositions[ai], config, seed + ai * 999);
    group.add(arch);
  }

  // ── Distant mesas ──
  const mesas = createMesas(config, seed);
  group.add(mesas);

  // ── Base equipment ──
  const equipment = createBaseEquipment();
  group.add(equipment);

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
      scene.remove(sunLight);
      scene.remove(ambientLight);
      scene.remove(fillLight);

      // Traverse and dispose all geometries + materials
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
