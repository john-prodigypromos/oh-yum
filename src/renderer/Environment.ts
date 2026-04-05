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
  const COUNT = 800;
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
    sizes[i] = i < 700 ? 0.8 + rng() * 1.2 : 2.0 + rng() * 3.5;
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

  // Sun — soft directional (not too bright for metallic ships)
  const sun = new THREE.DirectionalLight(0xfff5e6, 0.8);
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

export function createPlanet(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const rng = seededRng(314);

  // Planet body
  const planetGeo = new THREE.SphereGeometry(300, 48, 36);
  const planetCanvas = document.createElement('canvas');
  planetCanvas.width = 512;
  planetCanvas.height = 256;
  const ctx = planetCanvas.getContext('2d')!;

  // Base color — gas giant bands
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2a4a6a');
  grad.addColorStop(0.15, '#3a6a5a');
  grad.addColorStop(0.25, '#2a5a7a');
  grad.addColorStop(0.35, '#4a6a4a');
  grad.addColorStop(0.5, '#3a5a6a');
  grad.addColorStop(0.6, '#2a6a5a');
  grad.addColorStop(0.7, '#3a4a7a');
  grad.addColorStop(0.85, '#4a5a5a');
  grad.addColorStop(1, '#2a4a6a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Storm swirls and cloud bands
  for (let i = 0; i < 40; i++) {
    const x = rng() * 512;
    const y = rng() * 256;
    const w = 30 + rng() * 80;
    const h = 3 + rng() * 8;
    ctx.fillStyle = `rgba(${150 + rng() * 100}, ${150 + rng() * 100}, ${150 + rng() * 100}, ${0.05 + rng() * 0.1})`;
    ctx.fillRect(x, y, w, h);
  }

  // Storm spot
  const spotX = 300;
  const spotY = 120;
  const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 25);
  spotGrad.addColorStop(0, 'rgba(180, 100, 80, 0.3)');
  spotGrad.addColorStop(1, 'rgba(180, 100, 80, 0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, 30, 15, 0.2, 0, Math.PI * 2);
  ctx.fill();

  const planetTex = new THREE.CanvasTexture(planetCanvas);
  planetTex.wrapS = THREE.RepeatWrapping;

  const planetMat = new THREE.MeshStandardMaterial({
    map: planetTex,
    metalness: 0.0,
    roughness: 0.8,
  });

  const planet = new THREE.Mesh(planetGeo, planetMat);
  group.add(planet);

  // Atmosphere rim glow
  const atmosGeo = new THREE.SphereGeometry(310, 32, 24);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x4488cc,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
  });
  const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
  group.add(atmosphere);

  // Ring system
  const ringGeo = new THREE.RingGeometry(380, 520, 64);
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 256;
  ringCanvas.height = 1;
  const rctx = ringCanvas.getContext('2d')!;
  for (let x = 0; x < 256; x++) {
    const a = (Math.sin(x * 0.1) * 0.5 + 0.5) * 0.3;
    rctx.fillStyle = `rgba(200, 190, 170, ${a})`;
    rctx.fillRect(x, 0, 1, 1);
  }
  const ringTex = new THREE.CanvasTexture(ringCanvas);
  const ringMat = new THREE.MeshBasicMaterial({
    map: ringTex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI * 0.45;
  group.add(ring);

  // Position planet far away to the lower-right
  group.position.set(800, -400, -1500);

  scene.add(group);
  return group;
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
  createPlanet(scene);

  // Generate environment map for PBR reflections
  createEnvironmentMap(renderer, scene, camera);

  return { stars, nebulae, sun, hemisphere };
}
