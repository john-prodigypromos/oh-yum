// ── Ship Geometry ────────────────────────────────────────
// Loads GLTF models from public/models/ if available,
// falls back to procedural geometry if not.
// Player ship: sleek fighter with swept wings + dual engines.
// Enemy ship: dark gunmetal with red accent lighting.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── GLTF Model Cache ─────────────────────────────────────

const _loader = new GLTFLoader();
let _playerModelCache: THREE.Group | null = null;
let _enemyModelCache: THREE.Group | null = null;
let _modelsPreloaded = false;

/**
 * Normalize a loaded GLTF scene: center at origin, scale to target size,
 * orient so +Z is forward, ensure PBR materials.
 */
function normalizeModel(scene: THREE.Group, targetSize: number, url = ''): THREE.Group {
  const group = new THREE.Group();
  group.add(scene);

  // Compute bounding box and center
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Center the model at origin
  scene.position.sub(center);

  // Scale to fit target size
  const scale = targetSize / maxDim;
  scene.scale.multiplyScalar(scale);

  // Single-mesh Meshy GLBs — vertex-colored dark hull with accent edge glow
  const isEnemy = url.includes('enemy');
  const accent = isEnemy ? new THREE.Color(0.8, 0.08, 0.02) : new THREE.Color(0.0, 0.6, 0.9);
  const hullColor = isEnemy ? new THREE.Color(0.06, 0.06, 0.08) : new THREE.Color(0.10, 0.14, 0.20);

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const geo = child.geometry;
    const normals = geo.attributes.normal;
    const count = normals.count;
    const colors = new Float32Array(count * 3);

    for (let v = 0; v < count; v++) {
      const nx = normals.getX(v);
      const ny = normals.getY(v);
      const nz = normals.getZ(v);
      const sideFactor = Math.sqrt(nx * nx + nz * nz);
      const flatness = Math.abs(ny);

      let r = hullColor.r + flatness * 0.06;
      let g = hullColor.g + flatness * 0.06;
      let b = hullColor.b + flatness * 0.07;

      const edgeGlow = Math.pow(sideFactor, 3) * 0.3;
      r += accent.r * edgeGlow;
      g += accent.g * edgeGlow;
      b += accent.b * edgeGlow;

      colors[v * 3] = Math.min(1, r);
      colors[v * 3 + 1] = Math.min(1, g);
      colors[v * 3 + 2] = Math.min(1, b);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    child.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.85,
      emissive: accent,
      emissiveIntensity: 0.08,
      envMapIntensity: 1.0,
    });
  });

  return group;
}

/**
 * Preload both ship models during title/character select screen.
 * Call this early so models are cached before gameplay starts.
 * Safe to call multiple times — only loads once.
 */
export async function preloadShipModels(): Promise<void> {
  if (_modelsPreloaded) return;
  _modelsPreloaded = true;

  const loadModel = (url: string, targetSize: number): Promise<THREE.Group | null> =>
    new Promise((resolve) => {
      _loader.load(
        url,
        (gltf) => {
          const model = normalizeModel(gltf.scene, targetSize, url);
          resolve(model);
        },
        undefined,
        () => resolve(null), // 404 or error → null, use procedural fallback
      );
    });

  const [player, enemy] = await Promise.all([
    loadModel('/models/player-ship.glb', 8),
    loadModel('/models/enemy-ship.glb', 6),
  ]);

  _playerModelCache = player;
  _enemyModelCache = enemy;

  // Models loaded
}

/** Get a clone of the loaded player ship model, or null if not available. */
export function getPlayerShipModel(): THREE.Group | null {
  return _playerModelCache ? _playerModelCache.clone() : null;
}

/** Get a clone of the loaded enemy ship model, or null if not available. */
export function getEnemyShipModel(): THREE.Group | null {
  return _enemyModelCache ? _enemyModelCache.clone() : null;
}

/** Player fighter — same silhouette as enemy, different material names
 *  so the player material system colors it differently (blue/cyan). */
export function createPlayerShipGeometry(): THREE.Group {
  // Use the same geometry as enemy but with player material naming
  const group = createEnemyShipGeometry();

  // Remap mesh names: enemy uses 'hull'/'engine'/'nozzle'/'accent'/'armor-dark'
  // Player materials expect 'fuselage'/'engine-left'/'nozzle-left'
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const n = child.name;
    if (n === 'hull') child.name = 'fuselage';
    else if (n === 'engine') child.name = 'engine-left';
    else if (n === 'nozzle') child.name = 'nozzle-left';
    else if (n === 'armor-dark') child.name = 'cockpit';
  });

  // ── PLAYER ONLY: Enlarge canopy 28% and center it over more of the fuselage ──
  // The canopy is the first 'cockpit' mesh with a sphere-like shape (position.z > 0)
  let canopyFound = false;
  group.traverse((child) => {
    if (!canopyFound && child instanceof THREE.Mesh && child.name === 'cockpit' && child.position.z > 0.5) {
      child.scale.setScalar(1.28);
      child.position.set(0, 0.24, 0.4);
      canopyFound = true;
    }
  });

  // ── PLAYER ONLY: Dorsal 3rd engine on top (matches twin engines) ──
  const dY = 0.35;
  // Engine housing
  const dHousingGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.8, 18);
  dHousingGeo.rotateX(Math.PI / 2);
  const dHousing = new THREE.Mesh(dHousingGeo);
  dHousing.name = 'fuselage';
  dHousing.position.set(0, dY, -1.8);
  group.add(dHousing);

  // Intake lip
  const dLipGeo = new THREE.TorusGeometry(0.34, 0.03, 8, 18);
  const dLip = new THREE.Mesh(dLipGeo);
  dLip.name = 'fuselage';
  dLip.position.set(0, dY, -0.9);
  group.add(dLip);

  // Fan face
  const dFanGeo = new THREE.CircleGeometry(0.3, 16);
  const dFan = new THREE.Mesh(dFanGeo);
  dFan.name = 'cockpit';
  dFan.position.set(0, dY, -0.89);
  group.add(dFan);

  // Engine core
  const dCoreGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.8, 14);
  dCoreGeo.rotateX(Math.PI / 2);
  const dCore = new THREE.Mesh(dCoreGeo);
  dCore.name = 'engine-left';
  dCore.position.set(0, dY, -2.5);
  group.add(dCore);

  // Exhaust cone
  const dExGeo = new THREE.ConeGeometry(0.15, 0.4, 12);
  dExGeo.rotateX(Math.PI / 2);
  const dExhaust = new THREE.Mesh(dExGeo);
  dExhaust.name = 'engine-left';
  dExhaust.position.set(0, dY, -2.9);
  group.add(dExhaust);

  // Nozzle outer ring
  const dNozGeo = new THREE.TorusGeometry(0.3, 0.03, 10, 18);
  const dNoz = new THREE.Mesh(dNozGeo);
  dNoz.name = 'fuselage';
  dNoz.position.set(0, dY, -2.7);
  group.add(dNoz);

  // Nozzle glow — same as the twin engines
  const dGlowGeo = new THREE.RingGeometry(0.08, 0.26, 16);
  const dGlow = new THREE.Mesh(dGlowGeo);
  dGlow.name = 'nozzle-left';
  dGlow.position.set(0, dY, -2.75);
  group.add(dGlow);

  // Player ship is 13% larger than enemy
  group.scale.setScalar(1.13);

  return group;
}

/** DEAD CODE MARKER */
const _dead = 0; /* [
    [0.00,  4.6],  // nose tip
    [0.05,  4.4],
    [0.14,  4.0],
    [0.28,  3.4],
    [0.44,  2.7],
    [0.58,  2.0],
    [0.70,  1.3],
    [0.80,  0.6],
    [0.85,  0.0],  // max beam (narrower than enemy — sleek)
    [0.82, -0.5],
    [0.76, -1.0],
    [0.68, -1.5],
    [0.58, -2.0],
    [0.48, -2.5],
    [0.42, -2.8],
    [0.38, -3.0],  // engine mount
  ];
  const lathePoints = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const fuseGeo = new THREE.LatheGeometry(lathePoints, 28);
  const fp = fuseGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    fp.setZ(i, fp.getZ(i) * 0.52); // flatten to oval
  }
  fuseGeo.computeVertexNormals();
  const fuselage = new THREE.Mesh(fuseGeo);
  fuselage.name = 'fuselage';
  fuselage.rotation.x = -Math.PI / 2;
  group.add(fuselage);

  // ═══════════════════════════════════════════════════════════
  // DORSAL SPINE — raised ridge
  // ═══════════════════════════════════════════════════════════
  const spineShape = new THREE.Shape();
  spineShape.moveTo(0, 0);
  spineShape.lineTo(-0.06, 0);
  spineShape.lineTo(-0.03, 0.15);
  spineShape.lineTo(0.03, 0.15);
  spineShape.lineTo(0.06, 0);
  const spineGeo = new THREE.ExtrudeGeometry(spineShape, { depth: 4.5, bevelEnabled: false });
  spineGeo.rotateX(-Math.PI / 2);
  const spine = new THREE.Mesh(spineGeo);
  spine.name = 'fuselage';
  spine.position.set(0, 0.38, -1.8);
  group.add(spine);

  // ═══════════════════════════════════════════════════════════
  // COCKPIT CANOPY — larger dome + frame
  // ═══════════════════════════════════════════════════════════
  const canopyGeo = new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48);
  canopyGeo.scale(1.1, 1.0, 2.2);
  const canopy = new THREE.Mesh(canopyGeo);
  canopy.name = 'cockpit';
  canopy.position.set(0, 0.36, 1.0);
  group.add(canopy);

  // Canopy frame rails
  const cFrameGeo = new THREE.BoxGeometry(0.035, 0.07, 1.8);
  const cFrameC = new THREE.Mesh(cFrameGeo);
  cFrameC.name = 'fuselage';
  cFrameC.position.set(0, 0.56, 1.0);
  group.add(cFrameC);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 1.5));
    rail.name = 'fuselage';
    rail.position.set(side * 0.35, 0.48, 1.0);
    group.add(rail);
  }
  // Cross braces
  for (const z of [0.4, 1.0, 1.6]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.025));
    brace.name = 'fuselage';
    brace.position.set(0, 0.52, z);
    group.add(brace);
  }

  // ═══════════════════════════════════════════════════════════
  // LERX — wing-body blend
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const lerxShape = new THREE.Shape();
    lerxShape.moveTo(0, 0);
    lerxShape.lineTo(side * 0.9, -0.06);
    lerxShape.lineTo(side * 0.5, -0.18);
    lerxShape.lineTo(0, -0.08);
    const lerxGeo = new THREE.ExtrudeGeometry(lerxShape, { depth: 2.0, bevelEnabled: false });
    lerxGeo.rotateX(-Math.PI / 2);
    const lerx = new THREE.Mesh(lerxGeo);
    lerx.name = 'fuselage';
    lerx.position.set(0, 0.02, -0.4);
    group.add(lerx);
  }

  // ═══════════════════════════════════════════════════════════
  // WINGS — extruded airfoil, longer and more swept than enemy
  // ═══════════════════════════════════════════════════════════
  const wingProfile = new THREE.Shape();
  wingProfile.moveTo(0, 0);
  wingProfile.lineTo(-1.4, -0.04);
  wingProfile.quadraticCurveTo(-1.55, 0.02, -1.4, 0.11);
  wingProfile.lineTo(-0.8, 0.13);
  wingProfile.quadraticCurveTo(-0.4, 0.11, 0, 0.035);
  wingProfile.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingProfile, { depth: 5.0, bevelEnabled: false });
  const wPos = wingGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const d = wPos.getZ(i);
    const t = d / 5.0;
    const taper = 1 - t * 0.7;
    wPos.setX(i, wPos.getX(i) * taper);
    wPos.setY(i, wPos.getY(i) * taper);
    if (wPos.getX(i) < -0.3) wPos.setX(i, wPos.getX(i) + t * 0.5);
  }
  wingGeo.computeVertexNormals();

  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'wing-left';
  leftWing.rotation.y = Math.PI / 2;
  leftWing.rotation.z = -0.03;
  leftWing.position.set(-0.65, -0.04, -0.4);
  group.add(leftWing);

  const rwGeo = wingGeo.clone();
  const rwP = rwGeo.attributes.position;
  for (let i = 0; i < rwP.count; i++) rwP.setZ(i, -rwP.getZ(i));
  rwGeo.computeVertexNormals();
  const rightWing = new THREE.Mesh(rwGeo);
  rightWing.name = 'wing-right';
  rightWing.rotation.y = Math.PI / 2;
  rightWing.rotation.z = 0.03;
  rightWing.position.set(0.65, -0.04, -0.4);
  group.add(rightWing);

  // ═══════════════════════════════════════════════════════════
  // WINGTIP FINS — angled up
  // ═══════════════════════════════════════════════════════════
  const finGeo = new THREE.BoxGeometry(0.06, 1.0, 1.2);
  const fPos = finGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const y = fPos.getY(i);
    if (y > 0) fPos.setZ(i, fPos.getZ(i) * (1 - (y / 0.5) * 0.3));
  }
  finGeo.computeVertexNormals();
  for (const [x, rz] of [[-2.8, -0.12], [2.8, 0.12]] as const) {
    const fin = new THREE.Mesh(finGeo.clone());
    fin.name = 'tip-left';
    fin.position.set(x, 0.4, -1.0);
    fin.rotation.z = rz;
    group.add(fin);
  }

  // ═══════════════════════════════════════════════════════════
  // V-TAIL — twin canted stabilizers
  // ═══════════════════════════════════════════════════════════
  const stabProfile = new THREE.Shape();
  stabProfile.moveTo(0, 0);
  stabProfile.lineTo(-0.8, -0.02);
  stabProfile.quadraticCurveTo(-0.85, 0.02, -0.8, 0.06);
  stabProfile.lineTo(0, 0.03);
  const stabGeo = new THREE.ExtrudeGeometry(stabProfile, { depth: 1.5, bevelEnabled: false });
  const stP = stabGeo.attributes.position;
  for (let i = 0; i < stP.count; i++) {
    const d = stP.getZ(i);
    const t = d / 1.5;
    stP.setX(i, stP.getX(i) * (1 - t * 0.5));
    stP.setY(i, stP.getY(i) * (1 - t * 0.5));
  }
  stabGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(stabGeo.clone());
    stab.name = 'fuselage';
    stab.rotation.z = side * -Math.PI / 2 + (side > 0 ? Math.PI : 0);
    stab.rotation.x = side * 0.18;
    stab.position.set(side * 0.55, 0.12, -2.8);
    group.add(stab);
  }

  // Horizontal tail planes
  const htGeo = new THREE.BoxGeometry(2.4, 0.06, 0.9);
  const htP = htGeo.attributes.position;
  for (let i = 0; i < htP.count; i++) {
    const x = Math.abs(htP.getX(i));
    htP.setY(i, htP.getY(i) * (1 - (x / 1.2) * 0.6));
  }
  htGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    const ht = new THREE.Mesh(htGeo.clone());
    ht.name = 'fuselage';
    ht.position.set(side * 1.3, -0.02, -2.8);
    group.add(ht);
  }

  // ═══════════════════════════════════════════════════════════
  // ENGINES — twin nacelles with full detail
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const sx = side * 1.1;
    const sy = -0.08;

    // Engine housing
    const ehGeo = new THREE.CylinderGeometry(0.38, 0.46, 2.4, 20);
    ehGeo.rotateX(Math.PI / 2);
    const housing = new THREE.Mesh(ehGeo);
    housing.name = 'engine-left';
    housing.position.set(sx, sy, -2.8);
    group.add(housing);

    // Intake lip
    const lipGeo = new THREE.TorusGeometry(0.4, 0.035, 10, 20);
    const lip = new THREE.Mesh(lipGeo);
    lip.name = 'fuselage';
    lip.position.set(sx, sy, -1.6);
    group.add(lip);

    // Fan face
    const fanGeo = new THREE.CircleGeometry(0.36, 16);
    const fan = new THREE.Mesh(fanGeo);
    fan.name = 'engine-left';
    fan.position.set(sx, sy, -1.59);
    group.add(fan);

    // Engine core
    const ecGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.0, 16);
    ecGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(ecGeo);
    core.name = 'engine-left';
    core.position.set(sx, sy, -3.6);
    group.add(core);

    // Exhaust cone
    const exGeo = new THREE.ConeGeometry(0.18, 0.5, 14);
    exGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exGeo);
    exhaust.name = 'engine-left';
    exhaust.position.set(sx, sy, -4.1);
    group.add(exhaust);

    // Nozzle outer ring
    const noGeo = new THREE.TorusGeometry(0.36, 0.04, 12, 22);
    const nOuter = new THREE.Mesh(noGeo);
    nOuter.name = 'fuselage';
    nOuter.position.set(sx, sy, -4.0);
    group.add(nOuter);

    // Nozzle glow
    const ngGeo = new THREE.RingGeometry(0.1, 0.3, 20);
    const nGlow = new THREE.Mesh(ngGeo);
    nGlow.name = 'nozzle-left';
    nGlow.position.set(sx, sy, -4.05);
    group.add(nGlow);

    // Nozzle petals
    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.1, 0.18));
      petal.name = 'fuselage';
      petal.position.set(
        sx + Math.cos(angle) * 0.33,
        sy + Math.sin(angle) * 0.33,
        -4.05,
      );
      petal.rotation.z = angle;
      group.add(petal);
    }
  }

  // Engine connecting plate
  const rearGeo = new THREE.BoxGeometry(2.9, 0.35, 0.2);
  const rear = new THREE.Mesh(rearGeo);
  rear.name = 'fuselage';
  rear.position.set(0, -0.08, -2.2);
  group.add(rear);

  // ═══════════════════════════════════════════════════════════
  // VENTRAL DETAIL — keel, sensor pod, pylons
  // ═══════════════════════════════════════════════════════════
  const keelGeo = new THREE.BoxGeometry(0.05, 0.2, 3.0);
  const kP = keelGeo.attributes.position;
  for (let i = 0; i < kP.count; i++) {
    const z = kP.getZ(i);
    const t = Math.abs(z) / 1.5;
    if (t > 0.7) kP.setY(i, kP.getY(i) * (1 - (t - 0.7) * 2));
  }
  keelGeo.computeVertexNormals();
  const keel = new THREE.Mesh(keelGeo);
  keel.name = 'fuselage';
  keel.position.set(0, -0.45, 0.2);
  group.add(keel);

  // Sensor pod under nose
  const sensorGeo = new THREE.SphereGeometry(0.12, 10, 8);
  sensorGeo.scale(1, 0.7, 1.5);
  const sensor = new THREE.Mesh(sensorGeo);
  sensor.name = 'cockpit';
  sensor.position.set(0, -0.3, 3.0);
  group.add(sensor);

  // Wing pylons
  for (const side of [-1, 1]) {
    const pyGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.8, 8);
    pyGeo.rotateX(-Math.PI / 2);
    const pylon = new THREE.Mesh(pyGeo);
    pylon.name = 'fuselage';
    pylon.position.set(side * 2.0, -0.16, -0.2);
    group.add(pylon);
  }

  // ═══════════════════════════════════════════════════════════
  // CANNON BARRELS + NOSE DETAIL
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const bGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 10);
    bGeo.rotateX(-Math.PI / 2);
    const barrel = new THREE.Mesh(bGeo);
    barrel.name = 'fuselage';
    barrel.position.set(side * 0.22, -0.15, 4.0);
    group.add(barrel);
    const mGeo = new THREE.TorusGeometry(0.055, 0.012, 6, 10);
    const muzzle = new THREE.Mesh(mGeo);
    muzzle.name = 'fuselage';
    muzzle.position.set(side * 0.22, -0.15, 4.8);
    group.add(muzzle);
  }

  // Nose antenna
  const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6);
  antGeo.rotateX(-Math.PI / 2);
  const antenna = new THREE.Mesh(antGeo);
  antenna.name = 'fuselage';
  antenna.position.set(0, 0.2, 4.5);
  group.add(antenna);

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION LIGHTS
  // ═══════════════════════════════════════════════════════════
  const navL = new THREE.PointLight(0xff0000, 1.5, 8, 2);
  navL.position.set(-2.8, 0.3, -0.6);
  group.add(navL);
  const navR = new THREE.PointLight(0x00ff00, 1.5, 8, 2);
  navR.position.set(2.8, 0.3, -0.6);
  group.add(navR);
  const tailLight = new THREE.PointLight(0x0088ff, 1, 6, 2);
  tailLight.position.set(0, 0.2, -3.0);
  group.add(tailLight);

  return group;
}

/** Enemy ship — high-detail sculpted fighter.
 *  LatheGeometry fuselage with chin, LERX root extensions, airfoil wings,
 *  framed canopy, canted V-tail, engine intake lips, nozzle petals,
 *  nav lights, ventral detail. Looks good from every angle. */
export function createEnemyShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ═══════════════════════════════════════════════════════════
  // FUSELAGE — smooth LatheGeometry with 18-point profile
  // ═══════════════════════════════════════════════════════════
  const profile: [number, number][] = [
    [0.00,  4.2],  // nose tip
    [0.06,  4.0],  // nose point
    [0.18,  3.6],  // radome
    [0.32,  3.1],  // forward taper
    [0.50,  2.5],  // ahead of canopy
    [0.68,  1.8],  // canopy area
    [0.90,  1.0],  // shoulder — wider
    [1.15,  0.3],  // widest forward — bulkier
    [1.20,  0.0],  // max beam — much wider
    [1.20, -0.5],  // hold width longer
    [1.18, -1.0],  // aft of center — wider
    [1.10, -1.5],  // aft taper start — wider
    [0.95, -2.0],  // wing trailing edge area
    [0.78, -2.5],  // aft body
    [0.62, -3.0],  // engine fairing — stretched back
    [0.52, -3.3],  // engine mount
    [0.50, -3.5],  // between engines
  ];
  const lathePoints = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const fuseGeo = new THREE.LatheGeometry(lathePoints, 28);
  const fp = fuseGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const z = fp.getZ(i);
    const y = fp.getY(i);
    // Flatten to oval cross-section + slight chin bulge on bottom
    const chinBias = z < 0 ? 0.08 : 0;
    fp.setZ(i, z * 0.5 - chinBias);
  }
  fuseGeo.computeVertexNormals();
  const fuselage = new THREE.Mesh(fuseGeo);
  fuselage.name = 'hull';
  fuselage.rotation.x = -Math.PI / 2;
  group.add(fuselage);



  // ═══════════════════════════════════════════════════════════
  // COCKPIT CANOPY — dome glass + frame rails
  // ═══════════════════════════════════════════════════════════
  const canopyGeo = new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
  canopyGeo.scale(1.56, 1.25, 2.5);
  const canopy = new THREE.Mesh(canopyGeo);
  canopy.name = 'cockpit';
  canopy.position.set(0, 0.22, 1.2);
  group.add(canopy);



  // ═══════════════════════════════════════════════════════════
  // WINGS — extruded airfoil, swept & tapered
  // ═══════════════════════════════════════════════════════════
  const wingProfile = new THREE.Shape();
  wingProfile.moveTo(0, 0);
  wingProfile.bezierCurveTo(-1.0, -0.04, -2.2, -0.06, -2.8, -0.03);
  wingProfile.quadraticCurveTo(-3.0, 0.03, -2.7, 0.10);
  wingProfile.bezierCurveTo(-2.0, 0.12, -0.9, 0.09, 0, 0.025);
  wingProfile.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingProfile, { depth: 3.9, bevelEnabled: false });
  const wPos = wingGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const d = wPos.getZ(i);
    const t = d / 3.9;
    const taper = 1 - t * 0.55; // sharper taper toward tips
    wPos.setX(i, wPos.getX(i) * taper);
    wPos.setY(i, wPos.getY(i) * taper);
    // Scimitar sweep: curved backward sweep at tips
    if (wPos.getX(i) < -0.2) {
      wPos.setX(i, wPos.getX(i) + t * t * 1.2);
    }
  }
  wingGeo.computeVertexNormals();

  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'hull';
  leftWing.rotation.y = Math.PI / 2;
  leftWing.rotation.z = -0.02;
  leftWing.position.set(-0.4, -0.06, -0.1);
  group.add(leftWing);

  const rightWingGeo = wingGeo.clone();
  const rwPos = rightWingGeo.attributes.position;
  for (let i = 0; i < rwPos.count; i++) rwPos.setZ(i, -rwPos.getZ(i));
  // Flip triangle winding after mirroring so normals point outward
  const idx = rightWingGeo.index;
  if (idx) {
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    idx.needsUpdate = true;
  }
  rightWingGeo.computeVertexNormals();
  const rightWing = new THREE.Mesh(rightWingGeo);
  rightWing.name = 'hull';
  rightWing.rotation.y = Math.PI / 2;
  rightWing.rotation.z = 0.02;
  rightWing.position.set(0.4, -0.06, -0.1);
  group.add(rightWing);

  // WING ACCENT LIGHTS — along swept accent line (root-forward → tip-aft)
  for (const side of [-1, 1]) {
    for (const t of [0.15, 0.4, 0.65, 0.9]) {
      const x = (0.8 + t * 2.3) * side;
      const z = 0.6 + t * -1.2;
      const emitterGeo = new THREE.SphereGeometry(0.035, 8, 6);
      const emitter = new THREE.Mesh(emitterGeo);
      emitter.name = 'accent';
      emitter.position.set(x, 0.02, z);
      group.add(emitter);
      const edgeLight = new THREE.PointLight(0xff2200, 0.6, 3, 2);
      edgeLight.position.set(x, 0.04, z);
      group.add(edgeLight);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WINGTIP FINS — grow from wing trailing edge, touching the wing
  // ═══════════════════════════════════════════════════════════
  const finGeo = new THREE.BoxGeometry(0.08, 0.7, 0.8);
  const finPos = finGeo.attributes.position;
  for (let i = 0; i < finPos.count; i++) {
    const y = finPos.getY(i);
    // Taper toward top, widen at base to blend into wing
    if (y > 0) {
      finPos.setZ(i, finPos.getZ(i) * (1 - (y / 0.35) * 0.4));
      finPos.setX(i, finPos.getX(i) * (1 - (y / 0.35) * 0.3));
    }
  }
  finGeo.computeVertexNormals();
  for (const [x, rz] of [[-2.8, -0.12], [2.8, 0.12]] as const) {
    const fin = new THREE.Mesh(finGeo.clone());
    fin.name = 'hull';
    fin.position.set(x, 0.0, -0.4);
    fin.rotation.z = rz;
    group.add(fin);
  }



  // ═══════════════════════════════════════════════════════════
  // NOSE CONE — pointed tip extending from fuselage front
  // ═══════════════════════════════════════════════════════════
  const noseGeo = new THREE.ConeGeometry(0.45, 2.8, 16);
  noseGeo.rotateX(Math.PI / 2);
  // Flatten to match fuselage oval cross-section
  const nosePos = noseGeo.attributes.position;
  for (let i = 0; i < nosePos.count; i++) {
    nosePos.setY(i, nosePos.getY(i) * 0.5);
  }
  noseGeo.computeVertexNormals();
  const nose = new THREE.Mesh(noseGeo);
  nose.name = 'hull';
  nose.position.set(0, -0.02, 3.8);
  group.add(nose);

  // Nose tip — glowing red spike extending beyond the main nose cone
  // Main nose: base radius 0.45, length 2.8, positioned at z:3.8
  // Nose tip (front) is at z: 3.8 + 1.4 = 5.2
  // Shorten main nose slightly so the red tip replaces the very end
  nose.position.set(0, -0.02, 3.6); // pull back 0.2 to avoid overlap
  const tipGeo = new THREE.ConeGeometry(0.09, 0.56, 16);
  tipGeo.rotateX(Math.PI / 2);
  const tipPos = tipGeo.attributes.position;
  for (let i = 0; i < tipPos.count; i++) {
    tipPos.setY(i, tipPos.getY(i) * 0.5);
  }
  tipGeo.computeVertexNormals();
  const tip = new THREE.Mesh(tipGeo);
  tip.name = 'accent';
  tip.position.set(0, -0.02, 5.08);
  group.add(tip);
  const tipLight = new THREE.PointLight(0xff2200, 2, 8, 2);
  tipLight.position.set(0, -0.02, 5.36);
  group.add(tipLight);



  // ═══════════════════════════════════════════════════════════
  // AFT CAP — close the open rear of the fuselage
  // ═══════════════════════════════════════════════════════════
  // Cap is a circle in XY, needs to face aft (-Z direction)
  // Fuselage aft end is now at z=-3.5
  const capGeo = new THREE.CircleGeometry(0.50, 28);
  const capPos = capGeo.attributes.position;
  for (let i = 0; i < capPos.count; i++) {
    capPos.setY(i, capPos.getY(i) * 0.5);
  }
  capGeo.computeVertexNormals();
  const cap = new THREE.Mesh(capGeo);
  cap.name = 'hull';
  cap.position.set(0, 0, -3.5);
  group.add(cap);

  // ═══════════════════════════════════════════════════════════
  // ENGINES — housings, intake lips, cores, petals, nozzles
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const sx = side * 0.82;
    const sy = -0.05;
    const engGroup = new THREE.Group();
    engGroup.position.set(sx, sy, 0);
    engGroup.scale.z = 0.75; // 25% shorter in length

    // Engine housing
    const ehGeo = new THREE.CylinderGeometry(0.705, 0.795, 2.86, 22);
    ehGeo.rotateX(Math.PI / 2);
    const housing = new THREE.Mesh(ehGeo);
    housing.name = 'hull';
    housing.position.set(0, 0, -2.9);
    engGroup.add(housing);

    const eiGeo = new THREE.TorusGeometry(0.72, 0.063, 10, 22);
    const intakeLip = new THREE.Mesh(eiGeo);
    intakeLip.name = 'hull';
    intakeLip.position.set(0, 0, -1.47);
    engGroup.add(intakeLip);

    const fanGeo = new THREE.CircleGeometry(0.66, 18);
    const fan = new THREE.Mesh(fanGeo);
    fan.name = 'armor-dark';
    fan.position.set(0, 0, -1.46);
    engGroup.add(fan);

    const ecGeo = new THREE.CylinderGeometry(0.405, 0.57, 1.3, 16);
    ecGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(ecGeo);
    core.name = 'engine';
    core.position.set(0, 0, -3.8);
    engGroup.add(core);

    const exGeo = new THREE.ConeGeometry(0.315, 0.65, 14);
    exGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exGeo);
    exhaust.name = 'engine';
    exhaust.position.set(0, 0, -4.4);
    engGroup.add(exhaust);

    const noGeo = new THREE.TorusGeometry(0.63, 0.07, 12, 24);
    const nOuter = new THREE.Mesh(noGeo);
    nOuter.name = 'hull';
    nOuter.position.set(0, 0, -4.33);
    engGroup.add(nOuter);

    const ngGeo = new THREE.RingGeometry(0.15, 0.54, 20);
    const nGlow = new THREE.Mesh(ngGeo);
    nGlow.name = 'nozzle';
    nGlow.position.set(0, 0, -4.38);
    engGroup.add(nGlow);

    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      const petalGeo = new THREE.BoxGeometry(0.063, 0.195, 0.273);
      const petal = new THREE.Mesh(petalGeo);
      petal.name = 'hull';
      petal.position.set(
        Math.cos(angle) * 0.60,
        Math.sin(angle) * 0.60,
        -4.38,
      );
      petal.rotation.z = angle;
      engGroup.add(petal);
    }

    // Accent rings — inside engGroup so they scale with the engine
    const a1Geo = new THREE.TorusGeometry(0.75, 0.015, 8, 20);
    const acc1 = new THREE.Mesh(a1Geo);
    acc1.name = 'accent';
    acc1.position.set(0, 0, -1.8);
    engGroup.add(acc1);
    const a2Geo = new THREE.TorusGeometry(0.75, 0.015, 8, 20);
    const acc2 = new THREE.Mesh(a2Geo);
    acc2.name = 'accent';
    acc2.position.set(0, 0, -3.8);
    engGroup.add(acc2);

    group.add(engGroup);
  }



  // ═══════════════════════════════════════════════════════════
  // UNDER-WING LASER CANNONS — sleek glowing red pods
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const wx = side * 1.55;
    const wy = -0.26;

    // Pylon — thin connector from wing to pod
    const pylonGeo = new THREE.BoxGeometry(0.046, 0.16, 0.12);
    const pylon = new THREE.Mesh(pylonGeo);
    pylon.name = 'hull';
    pylon.position.set(wx, wy + 0.07, -0.1);
    group.add(pylon);

    // Barrel housing — sleek octagonal tube (115% diameter)
    const barrelGeo = new THREE.CylinderGeometry(0.162, 0.193, 1.2, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo);
    barrel.name = 'hull';
    barrel.position.set(wx, wy, 0.0);
    group.add(barrel);

    // Energy rings — two glowing red rings around the barrel
    for (const rz of [-0.25, 0.15]) {
      const ringGeo = new THREE.TorusGeometry(0.22, 0.015, 10, 24);
      const ring = new THREE.Mesh(ringGeo);
      ring.name = 'accent';
      ring.position.set(wx, wy, rz);
      group.add(ring);
      const ringLight = new THREE.PointLight(0xff2200, 0.8, 4, 2);
      ringLight.position.set(wx, wy, rz);
      group.add(ringLight);
    }

    // Muzzle tip — glowing red barrel end (115% diameter)
    const muzzleGeo = new THREE.CylinderGeometry(0.081, 0.129, 0.2, 8);
    muzzleGeo.rotateX(Math.PI / 2);
    const muzzle = new THREE.Mesh(muzzleGeo);
    muzzle.name = 'accent';
    muzzle.position.set(wx, wy, 0.7);
    group.add(muzzle);

    // Muzzle glow light
    const muzzleLight = new THREE.PointLight(0xff2200, 1.0, 4, 2);
    muzzleLight.position.set(wx, wy, 0.8);
    group.add(muzzleLight);
  }

  // ═══════════════════════════════════════════════════════════
  // ACCENT LINES — red seams flush on body surface
  // ═══════════════════════════════════════════════════════════
  // Wing accent strip — sweeps aft from root to tip, extends to wingtips
  for (const side of [-1, 1]) {
    const innerX = side * 0.8, innerZ = 0.6;
    const outerX = side * 3.1, outerZ = -0.6;
    const mx = (innerX + outerX) / 2;
    const mz = (innerZ + outerZ) / 2;
    const dx = outerX - innerX;
    const dz = outerZ - innerZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = -Math.atan2(dz, dx);
    const teGeo = new THREE.BoxGeometry(len, 0.03, 0.04);
    const teStrip = new THREE.Mesh(teGeo);
    teStrip.name = 'accent';
    teStrip.position.set(mx, 0.01, mz);
    teStrip.rotation.y = angle;
    group.add(teStrip);
    for (const t of [0.2, 0.5, 0.8]) {
      const edgeLight = new THREE.PointLight(0xff2200, 0.8, 5, 2);
      edgeLight.position.set(innerX + dx * t, -0.02, innerZ + dz * t);
      group.add(edgeLight);
    }
  }
  // Engine accent rings now inside engGroup above

  // Ventral accent lines — downward-facing plane, depthTest:false
  const ventralMat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    side: THREE.FrontSide,
    depthTest: false,
  });
  for (const side of [-1, 1]) {
    const vGeo = new THREE.PlaneGeometry(0.04, 1.5);
    vGeo.rotateX(Math.PI / 2);
    const vLine = new THREE.Mesh(vGeo, ventralMat);
    vLine.name = 'ventral-glow';
    vLine.renderOrder = 999;
    vLine.position.set(side * 0.20, -0.55, -0.2);
    group.add(vLine);
  }

  // VOX text on right wing
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 512; logoCanvas.height = 256;
  const logoCtx = logoCanvas.getContext('2d')!;
  logoCtx.clearRect(0, 0, 512, 256);
  logoCtx.font = 'bold 180px Arial Black, Impact, sans-serif';
  logoCtx.textAlign = 'center';
  logoCtx.textBaseline = 'middle';
  logoCtx.fillStyle = '#111111';
  logoCtx.fillText('VOX', 256, 128);
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const lMat = new THREE.MeshBasicMaterial({
    map: logoTex, transparent: true, alphaTest: 0.1,
    side: THREE.FrontSide, depthTest: false,
  });
  const logoGeo = new THREE.PlaneGeometry(1.4, 0.63);
  logoGeo.rotateX(-Math.PI / 2);
  const logo = new THREE.Mesh(logoGeo, lMat);
  logo.name = 'ventral-glow';
  logo.renderOrder = 998;
  logo.rotation.y = 0.48;
  logo.position.set(1.8, 0.08, 0.4);
  group.add(logo);

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION LIGHTS — red port, green starboard
  // ═══════════════════════════════════════════════════════════
  const navL = new THREE.PointLight(0xff0000, 1.5, 8, 2);
  navL.position.set(-2.8, 0.3, -0.5);
  group.add(navL);
  const navR = new THREE.PointLight(0x00ff00, 1.5, 8, 2);
  navR.position.set(2.8, 0.3, -0.5);
  group.add(navR);

  // Tail warning light
  const tailLight = new THREE.PointLight(0xff2200, 1, 6, 2);
  tailLight.position.set(0, 0.3, -3.5);
  group.add(tailLight);

  // ═══════════════════════════════════════════════════════════
  // ACCENT ILLUMINATION
  // ═══════════════════════════════════════════════════════════
  const accentLight1 = new THREE.PointLight(0xff2200, 1.5, 10, 2);
  accentLight1.position.set(0, 0.5, -0.5);
  group.add(accentLight1);
  const accentLight2 = new THREE.PointLight(0xff2200, 1.0, 8, 2);
  accentLight2.position.set(0, -0.5, -2.2);
  group.add(accentLight2);

  // Additional accent lights at engine bays
  for (const side of [-1, 1]) {
    const engGlow = new THREE.PointLight(0xff2200, 0.8, 6, 2);
    engGlow.position.set(side * 0.82, -0.05, -3.7);
    group.add(engGlow);
  }

  return group;
}
