import * as THREE from 'three';
import { valueNoise3D, fbm3D } from '../systems/EnvironmentLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpaceportTerrain {
  group: THREE.Group;
  guidePathGroup: THREE.Group;
  padRing: THREE.Mesh;
  cleanup(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Desert Ground
// ─────────────────────────────────────────────────────────────────────────────

export function createDesertGround(seed: number = 0): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4000, 4000, 80, 80);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const count = positions.count;

  // Build vertex colors
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  // Seed offset for noise variation
  const sx = seed * 137.5;
  const sz = seed * 251.3;

  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    // Distance from spaceport center (0, 0)
    const dist = Math.sqrt(x * x + z * z);

    // Dune height using fBm
    const noiseScale = 0.003;
    let height = fbm3D(
      x * noiseScale + sx,
      0,
      z * noiseScale + sz,
      5,
      2.0,
      0.5
    ) * 40; // ±40 units amplitude

    // Flatten near spaceport pad (radius 200 units)
    const flatRadius = 200;
    const flatFalloff = 400;
    if (dist < flatRadius) {
      height *= 0;
    } else if (dist < flatFalloff) {
      const t = (dist - flatRadius) / (flatFalloff - flatRadius);
      height *= t * t;
    }

    // Push ocean side below waterline
    if (x > 1500) {
      const oceanT = Math.min((x - 1500) / 500, 1.0);
      height -= oceanT * 30;
    }

    positions.setY(i, height);

    // Vertex color — sandy tan base
    const sandNoise = valueNoise3D(x * 0.008 + sx, height * 0.05, z * 0.008 + sz) * 0.5 + 0.5;

    // Three terrain zones based on noise
    if (sandNoise < 0.3) {
      // Dark dry earth patches
      color.setRGB(0.55 + sandNoise * 0.2, 0.42 + sandNoise * 0.15, 0.22 + sandNoise * 0.1);
    } else if (sandNoise > 0.75) {
      // Pale salt flat regions
      color.setRGB(0.88 + sandNoise * 0.1, 0.86 + sandNoise * 0.08, 0.78 + sandNoise * 0.08);
    } else {
      // Sandy tan base
      color.setRGB(0.76 + sandNoise * 0.1, 0.65 + sandNoise * 0.08, 0.42 + sandNoise * 0.06);
    }

    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'desert-ground';
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ocean
// ─────────────────────────────────────────────────────────────────────────────

export function createOcean(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(4000, 4000);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x1a6b8a),
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(3000, -1, 0);
  mesh.receiveShadow = true;
  mesh.name = 'ocean';
  return mesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Spaceport Structures
// ─────────────────────────────────────────────────────────────────────────────

export function createSpaceportStructures(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'spaceport-structures';

  // ── Landing Pad ──────────────────────────────────────────────────────────
  const padGeo = new THREE.CircleGeometry(30, 64);
  const padMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x555566),
    roughness: 0.8,
    metalness: 0.2,
  });
  const padMesh = new THREE.Mesh(padGeo, padMat);
  padMesh.rotation.x = -Math.PI / 2;
  padMesh.position.set(0, 0.1, 0);
  padMesh.receiveShadow = true;
  padMesh.name = 'landing-pad';
  group.add(padMesh);

  // Pad edge ring (cyan)
  const ringGeo = new THREE.TorusGeometry(30, 0.6, 8, 64);
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x00ffee),
    emissive: new THREE.Color(0x00ffee),
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.5,
  });
  const padRing = new THREE.Mesh(ringGeo, ringMat);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(0, 0.2, 0);
  padRing.name = 'pad-ring';
  group.add(padRing);

  // ── Control Tower ─────────────────────────────────────────────────────────
  const towerBase = new THREE.Mesh(
    new THREE.BoxGeometry(8, 40, 8),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.7, metalness: 0.3 })
  );
  towerBase.position.set(-60, 20, -40);
  towerBase.castShadow = true;
  towerBase.name = 'tower-base';
  group.add(towerBase);

  const towerCabin = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 12),
    new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.75,
    })
  );
  towerCabin.position.set(-60, 43, -40);
  towerCabin.castShadow = true;
  towerCabin.name = 'tower-cabin';
  group.add(towerCabin);

  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.6 })
  );
  antenna.position.set(-60, 50, -40);
  antenna.name = 'tower-antenna';
  group.add(antenna);

  // ── Hangars ───────────────────────────────────────────────────────────────
  const hangarPositions: [number, number, number][] = [
    [-100, 5, 60],
    [-140, 5, 10],
    [-110, 5, -70],
  ];

  hangarPositions.forEach((pos, idx) => {
    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(25, 10, 40),
      new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.8, metalness: 0.2 })
    );
    hangar.position.set(...pos);
    hangar.castShadow = true;
    hangar.receiveShadow = true;
    hangar.name = `hangar-${idx}`;
    group.add(hangar);
  });

  // ── Fuel Tanks ────────────────────────────────────────────────────────────
  const tankPositions: [number, number, number][] = [
    [70, 6, -60],
    [85, 6, -60],
    [70, 6, -80],
    [85, 6, -80],
  ];

  tankPositions.forEach((pos, idx) => {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 12, 16),
      new THREE.MeshStandardMaterial({ color: 0xbbbbcc, roughness: 0.5, metalness: 0.6 })
    );
    tank.position.set(...pos);
    tank.castShadow = true;
    tank.name = `fuel-tank-${idx}`;
    group.add(tank);
  });

  // ── Roads ─────────────────────────────────────────────────────────────────
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.95, metalness: 0.0 });

  // Main approach road (runs along Z axis toward pad)
  const road1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 200), roadMat);
  road1.rotation.x = -Math.PI / 2;
  road1.position.set(0, 0.15, -130);
  road1.receiveShadow = true;
  road1.name = 'road-approach';
  group.add(road1);

  // Cross road to hangars
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(120, 6), roadMat);
  road2.rotation.x = -Math.PI / 2;
  road2.position.set(-55, 0.15, 0);
  road2.receiveShadow = true;
  road2.name = 'road-cross';
  group.add(road2);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide Path
// ─────────────────────────────────────────────────────────────────────────────

export function createGuidePath(startY: number, count: number = 20): THREE.Group {
  const group = new THREE.Group();
  group.name = 'guide-path';
  group.visible = false; // Hidden initially

  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x00ffee),
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0 = far/high, 1 = near/low

    // Z position: from -200 (far approach) to 0 (at pad)
    const z = -200 * (1 - t);

    // Y position: descend from startY down to 0
    const y = startY * (1 - t);

    // Ring radius: bigger further away, smaller near pad
    const radius = 20 + 30 * (1 - t);

    const ringGeo = new THREE.TorusGeometry(radius, 0.5, 8, 48);
    const ring = new THREE.Mesh(ringGeo, ringMat.clone());
    ring.position.set(0, y, z);
    ring.name = `guide-ring-${i}`;
    group.add(ring);
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vegetation
// ─────────────────────────────────────────────────────────────────────────────

export function createVegetation(seed: number = 0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vegetation';

  const vegMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x4a6b30),
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    alphaTest: 0.1,
  });

  // Simple LCG-based deterministic random using seed
  let rand = seed * 9301 + 49297;
  const next = (): number => {
    rand = (rand * 9301 + 49297) % 233280;
    return rand / 233280;
  };

  const SCATTER_RADIUS = 600;
  const PAD_EXCLUSION = 50;
  const SHRUB_COUNT = 30;

  let placed = 0;
  let attempts = 0;

  while (placed < SHRUB_COUNT && attempts < 2000) {
    attempts++;
    const angle = next() * Math.PI * 2;
    const dist = PAD_EXCLUSION + next() * (SCATTER_RADIUS - PAD_EXCLUSION);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    // Skip center pad area
    if (Math.sqrt(x * x + z * z) < PAD_EXCLUSION) continue;

    // Vary size
    const w = 2 + next() * 3;
    const h = 1.5 + next() * 2.5;

    // Two crossed quads for billboarding effect
    const mat = vegMat.clone();
    // Slight color variation
    const greenShift = next() * 0.15;
    (mat as THREE.MeshBasicMaterial).color.setRGB(
      0.28 + greenShift,
      0.40 + greenShift,
      0.18 + greenShift * 0.5
    );

    for (let q = 0; q < 2; q++) {
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      quad.position.set(x, h / 2, z);
      quad.rotation.y = (q * Math.PI) / 2;
      quad.name = `shrub-${placed}-quad-${q}`;
      group.add(quad);
    }

    placed++;
  }

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lighting
// ─────────────────────────────────────────────────────────────────────────────

function createSpaceportLighting(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'spaceport-lighting';

  // Desert sun — warm directional light from south-east
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.92, 0.75), 2.2);
  sun.position.set(800, 600, -400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 3000;
  sun.shadow.camera.left = -600;
  sun.shadow.camera.right = 600;
  sun.shadow.camera.top = 600;
  sun.shadow.camera.bottom = -600;
  sun.name = 'sun';
  group.add(sun);

  // Sky ambient — soft blue-sky fill
  const ambient = new THREE.AmbientLight(new THREE.Color(0.55, 0.65, 0.80), 0.6);
  ambient.name = 'sky-ambient';
  group.add(ambient);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export function createSpaceportTerrain(
  scene: THREE.Scene,
  seed: number = 42
): SpaceportTerrain {
  const group = new THREE.Group();
  group.name = 'spaceport-terrain';

  // Ground
  const ground = createDesertGround(seed);
  group.add(ground);

  // Ocean
  const ocean = createOcean();
  group.add(ocean);

  // Structures
  const structures = createSpaceportStructures();
  group.add(structures);

  // Vegetation
  const vegetation = createVegetation(seed);
  group.add(vegetation);

  // Lighting
  const lighting = createSpaceportLighting();
  group.add(lighting);

  // Guide path — starts high (400 units) and descends to pad
  const guidePathGroup = createGuidePath(400, 20);
  group.add(guidePathGroup);

  // Grab the pad-ring reference for external use
  const padRing = structures.getObjectByName('pad-ring') as THREE.Mesh;

  scene.add(group);

  function cleanup(): void {
    scene.remove(group);

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      if (obj instanceof THREE.Light) {
        // Lights don't need explicit disposal but shadow maps do
        if ((obj as THREE.DirectionalLight).shadow?.map) {
          (obj as THREE.DirectionalLight).shadow.map!.dispose();
        }
      }
    });
  }

  return { group, guidePathGroup, padRing, cleanup };
}
