// ── Ship PBR Materials ───────────────────────────────────
// Metallic materials with procedural normal + roughness maps,
// environment reflections, and emissive engines.

import * as THREE from 'three';
import { createNormalMap, createRoughnessMap } from '../renderer/ProceduralTextures';

// Shared textures (created once, reused)
let normalMap: THREE.CanvasTexture | null = null;
let roughnessMap: THREE.CanvasTexture | null = null;

function getSharedTextures() {
  if (!normalMap) normalMap = createNormalMap(512, 101);
  if (!roughnessMap) roughnessMap = createRoughnessMap(512, 202);
  return { normalMap, roughnessMap };
}

export interface ShipMaterialSet {
  hull: THREE.MeshPhysicalMaterial;
  cockpit: THREE.MeshPhysicalMaterial;
  engine: THREE.MeshStandardMaterial;
  nozzle: THREE.MeshBasicMaterial;
  engineLight: THREE.PointLight;
}

/** Player ship materials — blue-steel metallic with cyan engine glow. */
export function createPlayerMaterials(characterColor?: number): ShipMaterialSet {
  const { normalMap, roughnessMap } = getSharedTextures();
  const baseColor = characterColor ?? 0x88aacc;

  const hull = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: 0.6,
    roughness: 0.6,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
  });

  const cockpit = new THREE.MeshPhysicalMaterial({
    color: 0x112244,
    metalness: 0.1,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.5,
    ior: 1.5,
  });

  const engine = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.5,
    emissive: 0x0088ff,
    emissiveIntensity: 2.0,
  });

  const nozzle = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const engineLight = new THREE.PointLight(0x0088ff, 5, 80, 2);

  return { hull, cockpit, engine, nozzle, engineLight };
}

/** Enemy ship materials — dark red metallic with orange engine glow. */
export function createEnemyMaterials(): ShipMaterialSet {
  const { normalMap, roughnessMap } = getSharedTextures();

  const hull = new THREE.MeshPhysicalMaterial({
    color: 0xcc4444,
    emissive: 0x331111,
    emissiveIntensity: 0.8,
    metalness: 0.7,
    roughness: 0.5,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  });

  const cockpit = new THREE.MeshPhysicalMaterial({
    color: 0xff2222,
    emissive: 0x440000,
    emissiveIntensity: 1.0,
    metalness: 0.2,
    roughness: 0.15,
    transmission: 0.3,
    thickness: 0.5,
  });

  const engine = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.85,
    roughness: 0.4,
    emissive: 0x993300,
    emissiveIntensity: 0.8,
  });

  const nozzle = new THREE.MeshBasicMaterial({
    color: 0xcc6622,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });

  const engineLight = new THREE.PointLight(0xcc5500, 4, 60, 2);

  return { hull, cockpit, engine, nozzle, engineLight };
}

/** Apply materials to a ship geometry group by mesh name. */
export function applyMaterials(group: THREE.Group, mats: ShipMaterialSet): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const name = child.name;
    if (name === 'cockpit') {
      child.material = mats.cockpit;
    } else if (name.startsWith('nozzle')) {
      child.material = mats.nozzle;
    } else if (name.startsWith('engine')) {
      child.material = mats.engine;
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
