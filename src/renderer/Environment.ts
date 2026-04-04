// ── Space Environment ────────────────────────────────────
// Starfield (8K points), nebula sprites, procedural envMap,
// hemisphere + directional lighting. Creates an immersive
// deep space backdrop for the arena.

import * as THREE from 'three';

// Seeded RNG for deterministic starfield
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function createStarfield(scene: THREE.Scene): THREE.Points {
  const COUNT = 8000;
  const SPREAD = 4000;
  const rng = seededRng(42);

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;

    // Distribute on a large sphere shell so stars surround the arena
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = SPREAD * (0.5 + rng() * 0.5);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    // Star colors: mostly white-blue, some warm yellow, rare red
    const roll = rng();
    if (roll < 0.05) {
      // Warm orange
      colors[i3] = 1.0; colors[i3 + 1] = 0.8; colors[i3 + 2] = 0.6;
    } else if (roll < 0.1) {
      // Cool blue
      colors[i3] = 0.7; colors[i3 + 1] = 0.8; colors[i3 + 2] = 1.0;
    } else if (roll < 0.12) {
      // Red giant
      colors[i3] = 1.0; colors[i3 + 1] = 0.5; colors[i3 + 2] = 0.3;
    } else {
      // White-ish
      colors[i3] = 0.9; colors[i3 + 1] = 0.92; colors[i3 + 2] = 1.0;
    }

    // Vary brightness via size — most dim, some bright
    sizes[i] = i < 7000 ? 0.8 + rng() * 1.2 : 2.0 + rng() * 3.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false; // always visible
  scene.add(stars);
  return stars;
}

export function createNebulae(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  const nebulaConfigs = [
    { pos: [-800, 200, -2000], color: [0.3, 0.1, 0.5], scale: 800, opacity: 0.08 },
    { pos: [600, -300, -1800], color: [0.1, 0.2, 0.5], scale: 1000, opacity: 0.1 },
    { pos: [-200, 500, -2500], color: [0.1, 0.4, 0.3], scale: 600, opacity: 0.06 },
    { pos: [900, 100, -1500], color: [0.4, 0.15, 0.3], scale: 700, opacity: 0.07 },
    { pos: [-500, -400, -2200], color: [0.15, 0.1, 0.4], scale: 900, opacity: 0.05 },
  ];

  // Create soft cloud texture procedurally
  const cloudTexture = createCloudTexture();

  for (const cfg of nebulaConfigs) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTexture,
      color: new THREE.Color(cfg.color[0], cfg.color[1], cfg.color[2]),
      transparent: true,
      opacity: cfg.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    sprite.scale.set(cfg.scale, cfg.scale, 1);
    group.add(sprite);
  }

  scene.add(group);
  return group;
}

function createCloudTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Radial gradient — soft cloud puff
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.2)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Layer noise blobs for organic shape
  const rng = seededRng(777);
  for (let i = 0; i < 12; i++) {
    const ox = cx + (rng() - 0.5) * size * 0.4;
    const oy = cy + (rng() - 0.5) * size * 0.4;
    const r = size * (0.1 + rng() * 0.2);
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, `rgba(255,255,255,${0.2 + rng() * 0.3})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createLighting(scene: THREE.Scene): {
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
} {
  // Hemisphere — subtle ambient fill (cool sky, dark ground)
  const hemisphere = new THREE.HemisphereLight(0x222244, 0x000000, 0.2);
  scene.add(hemisphere);

  // Sun — main directional (warm white, dramatic)
  const sun = new THREE.DirectionalLight(0xfff5e6, 3.0);
  sun.position.set(200, 150, 100);
  scene.add(sun);

  return { sun, hemisphere };
}

export function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): THREE.CubeTexture {
  // Render the starfield + nebulae to a cube render target for PBR reflections
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });

  const cubeCamera = new THREE.CubeCamera(1, 10000, cubeRenderTarget);
  cubeCamera.position.copy(camera.position);
  cubeCamera.update(renderer, scene);

  scene.environment = cubeRenderTarget.texture;
  return cubeRenderTarget.texture;
}

export interface SpaceEnvironment {
  stars: THREE.Points;
  nebulae: THREE.Group;
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
}

export function createSpaceEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): SpaceEnvironment {
  const stars = createStarfield(scene);
  const nebulae = createNebulae(scene);
  const { sun, hemisphere } = createLighting(scene);

  // Generate environment map for PBR reflections
  createEnvironmentMap(renderer, scene, camera);

  return { stars, nebulae, sun, hemisphere };
}
