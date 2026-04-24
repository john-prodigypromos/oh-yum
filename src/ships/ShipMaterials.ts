// ── Ship PBR Materials ───────────────────────────────────
// Metallic materials with procedural normal + roughness maps,
// environment reflections, and emissive engines.

import * as THREE from 'three';
import { createNormalMap, createRoughnessMap } from '../renderer/ProceduralTextures';

// Shared textures (created once, reused)
let normalMap: THREE.CanvasTexture | null = null;
let roughnessMap: THREE.CanvasTexture | null = null;

function getSharedTextures() {
  if (!normalMap) normalMap = createNormalMap(1024, 101);
  if (!roughnessMap) roughnessMap = createRoughnessMap(1024, 202);
  return { normalMap, roughnessMap };
}

export interface ShipMaterialSet {
  hull: THREE.Material;                // PlayerMaterials still uses MeshPhysicalMaterial, enemy uses MeshLambert
  cockpit: THREE.Material;
  engine: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshBasicMaterial;
  engineLight: THREE.PointLight;
  accent?: THREE.MeshStandardMaterial;  // red accent strip lighting
  armorDark?: THREE.Material;           // darker armor panels
}

/** Player ship materials — brushed steel hull with character-colored accent lighting. */
export function createPlayerMaterials(characterColor?: number): ShipMaterialSet {
  const { normalMap, roughnessMap } = getSharedTextures();
  const accentColor = characterColor ?? 0x00aaff;

  // Brushed metal texture — directional grain for steel look
  const brushedMap = createBrushedMetalMap(1024, 303);

  const hull = new THREE.MeshPhysicalMaterial({
    color: 0xeef0f4,          // bright silver
    metalness: 0.95,
    roughness: 0.15,
    normalMap: normalMap,
    roughnessMap: brushedMap,
    clearcoat: 0.7,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });

  const cockpit = new THREE.MeshPhysicalMaterial({
    color: 0x0a1828,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.6,
    thickness: 0.5,
    ior: 1.5,
  });

  const engine = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.92,
    roughness: 0.4,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 2.0,
  });

  const nozzle = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const engineLight = new THREE.PointLight(accentColor, 5, 80, 2);

  // Character-colored accent strips — the pilot's signature glow
  const accent = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 1.8,
    metalness: 0.2,
    roughness: 0.3,
  });

  return { hull, cockpit, engine, nozzle, engineLight, accent };
}

/** Generates a brushed metal roughness map — directional grain streaks for steel texture. */
function createBrushedMetalMap(size: number, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let s = seed;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  // Base: moderate roughness (0.35) = rgb(89, 89, 89)
  ctx.fillStyle = 'rgb(89, 89, 89)';
  ctx.fillRect(0, 0, size, size);

  // Horizontal brush strokes — the signature "brushed steel" look
  ctx.lineWidth = 1;
  for (let i = 0; i < 800; i++) {
    const y = rng() * size;
    const x = rng() * size * 0.3;
    const len = 40 + rng() * 200;
    const bright = 70 + Math.floor(rng() * 50);  // roughness variation
    ctx.strokeStyle = `rgba(${bright}, ${bright}, ${bright}, ${0.15 + rng() * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rng() - 0.5) * 3); // nearly horizontal
    ctx.stroke();
  }

  // Finer grain — tighter, shorter strokes
  for (let i = 0; i < 1200; i++) {
    const y = rng() * size;
    const x = rng() * size;
    const len = 8 + rng() * 30;
    const bright = 75 + Math.floor(rng() * 40);
    ctx.strokeStyle = `rgba(${bright}, ${bright}, ${bright}, ${0.08 + rng() * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rng() - 0.5) * 1.5);
    ctx.stroke();
  }

  // Worn patches — areas where the brushing is more polished (lower roughness)
  for (let i = 0; i < 15; i++) {
    const wx = rng() * size, wy = rng() * size;
    const wr = 15 + rng() * 40;
    const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
    g.addColorStop(0, 'rgba(55, 55, 55, 0.4)');   // shinier center
    g.addColorStop(1, 'rgba(89, 89, 89, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
  }

  // Panel line grooves — rougher
  ctx.strokeStyle = 'rgb(140, 140, 140)';
  ctx.lineWidth = 3;
  const panelSize = size / 8;
  for (let x = panelSize; x < size; x += panelSize + rng() * 15 - 7) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  for (let y = panelSize; y < size; y += panelSize + rng() * 15 - 7) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Enemy ship materials — simplified flat-shaded Lambert for cheap rendering.
 *  Dropped clearcoat / normalMap / roughnessMap from PhysicalMaterial → huge
 *  shader-compile + per-pixel savings. The ship reads as "dark grey armored
 *  fighter" visually, just without the showroom-car gloss. */
export function createEnemyMaterials(): ShipMaterialSet {
  // Main hull — Pantone Warm Grey 3C, no textures, no clearcoat
  const hull = new THREE.MeshLambertMaterial({
    color: 0xc7b9ab,
    emissive: 0x251f1a,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  });

  // Armor panels — darker warm grey
  const armorDark = new THREE.MeshLambertMaterial({
    color: 0x8a7e74,
    emissive: 0x1d1815,
    emissiveIntensity: 0.1,
  });

  // Cockpit — dark lambert with subtle emissive, no transmission/clearcoat
  const cockpit = new THREE.MeshLambertMaterial({
    color: 0x1a1e25,
    emissive: 0x0a0e15,
    emissiveIntensity: 0.3,
  });

  // Red accent strip material — subtle edge lighting
  const accent = new THREE.MeshStandardMaterial({
    color: 0x110000,
    emissive: 0xff2200,
    emissiveIntensity: 1.5,
    metalness: 0.2,
    roughness: 0.3,
  });

  // Engine core — subdued orange glow
  const engine = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.3,
    emissive: 0xff6622,
    emissiveIntensity: 1.2,
  });

  // Nozzle — dimmer exhaust
  const nozzle = new THREE.MeshBasicMaterial({
    color: 0xff8844,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  // Engine light — subtle cast, not blinding
  const engineLight = new THREE.PointLight(0xff4400, 3, 80, 2);

  return { hull, cockpit, engine, nozzle, engineLight, accent, armorDark };
}

/** Apply materials to a ship geometry group by mesh name. */
export function applyMaterials(group: THREE.Group, mats: ShipMaterialSet): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const name = child.name;
    if (name === 'ventral-glow') return; // has its own depthTest:false material
    if (name === 'cockpit') {
      child.material = mats.cockpit;
    } else if (name.startsWith('nozzle')) {
      child.material = mats.nozzle;
    } else if (name.startsWith('engine')) {
      child.material = mats.engine;
    } else if (name.startsWith('accent') && mats.accent) {
      child.material = mats.accent;
    } else if (name.startsWith('armor-dark') && mats.armorDark) {
      child.material = mats.armorDark;
    } else {
      child.material = mats.hull;
    }
  });

  // Attach engine point light
  const engineMesh = group.children.find(c => c.name === 'engine-left' || c.name === 'engine');
  if (engineMesh) {
    const light = mats.engineLight;
    light.position.copy(engineMesh.position);
    light.position.z -= 1; // behind the engine
    group.add(light);
  }
}
