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

/** Load the NASA 4K star map as a photorealistic skybox sphere.
 *  Returns a group that should be locked to the camera position each frame. */
function createPhotoSkybox(scene: THREE.Scene): THREE.Group {
  const skyGroup = new THREE.Group();
  skyGroup.renderOrder = -2;
  scene.add(skyGroup);

  const loader = new THREE.TextureLoader();
  loader.load('/textures/starmap_4k.jpg', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.SphereGeometry(5500, 64, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -2;
    skyGroup.add(sky);
  });

  return skyGroup;
}

export function createStarfield(scene: THREE.Scene): THREE.Points {
  // Fewer, dimmer stars on mobile to reduce brightness/clutter
  const isMobile = 'ontouchstart' in window || window.innerWidth < 600;
  const COUNT = isMobile ? 1200 : 3000;
  const SPREAD = 5000;
  const rng = seededRng(42);

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;

    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = SPREAD * (0.3 + rng() * 0.7);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    // Realistic star colors — mostly cool white/blue with spectral variety
    const roll = rng();
    if (roll < 0.04) {
      // Hot blue-white (O/B)
      colors[i3] = 0.65; colors[i3 + 1] = 0.75; colors[i3 + 2] = 1.0;
    } else if (roll < 0.1) {
      // Blue-white (A)
      colors[i3] = 0.8; colors[i3 + 1] = 0.85; colors[i3 + 2] = 1.0;
    } else if (roll < 0.16) {
      // Yellow-white (F)
      colors[i3] = 1.0; colors[i3 + 1] = 0.97; colors[i3 + 2] = 0.88;
    } else if (roll < 0.2) {
      // Yellow (G — sun-like)
      colors[i3] = 1.0; colors[i3 + 1] = 0.92; colors[i3 + 2] = 0.75;
    } else if (roll < 0.23) {
      // Orange (K)
      colors[i3] = 1.0; colors[i3 + 1] = 0.78; colors[i3 + 2] = 0.55;
    } else if (roll < 0.25) {
      // Red (M)
      colors[i3] = 1.0; colors[i3 + 1] = 0.5; colors[i3 + 2] = 0.3;
    } else {
      // Cool white — slight blue tint like real deep space photos
      const b = 0.9 + rng() * 0.1;
      colors[i3] = b - 0.05; colors[i3 + 1] = b - 0.02; colors[i3 + 2] = b;
    }

    // Size: dense field of tiny pinpoints, with rare bright ones
    const sizeRoll = rng();
    if (sizeRoll < 0.8) {
      sizes[i] = 0.4 + rng() * 0.8; // tiny pinpoints — the bulk of the field
    } else if (sizeRoll < 0.95) {
      sizes[i] = 1.2 + rng() * 1.5; // medium
    } else if (sizeRoll < 0.99) {
      sizes[i] = 2.5 + rng() * 3.0; // bright
    } else {
      sizes[i] = 5.0 + rng() * 4.0; // very bright beacon stars (bloom catches these)
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: isMobile ? 1.5 : 2,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: isMobile ? 0.6 : 0.85,
    depthWrite: false,
  });

  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  scene.add(stars);

  // ── Sky color — set via scene background, no sphere needed (eliminates grid artifacts) ──
  // The nebula sprites handle all background color variation.

  return stars;
}

export function createNebulae(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();

  const nebulaConfigs = [
    // Large atmospheric washes — very wide, very subtle, creates the "space has color" feel
    { pos: [-400, 0, -3500], color: [0.06, 0.12, 0.2], scale: 3000, opacity: 0.04 },
    { pos: [600, 200, -3200], color: [0.04, 0.1, 0.18], scale: 2800, opacity: 0.035 },
    { pos: [0, -200, -3800], color: [0.08, 0.14, 0.22], scale: 3500, opacity: 0.03 },
    // Mid-field nebulae — teal/blue tints like deep space photography
    { pos: [-800, 300, -2400], color: [0.05, 0.15, 0.2], scale: 1600, opacity: 0.05 },
    { pos: [900, -100, -2000], color: [0.08, 0.1, 0.25], scale: 1400, opacity: 0.06 },
    { pos: [-200, 500, -2800], color: [0.03, 0.12, 0.15], scale: 1200, opacity: 0.04 },
    // Warm dust lane — brownish-orange like the reference image
    { pos: [200, 400, -2600], color: [0.2, 0.1, 0.04], scale: 800, opacity: 0.07 },
    { pos: [100, 500, -2400], color: [0.25, 0.12, 0.05], scale: 600, opacity: 0.06 },
    // Subtle blue accent wisps
    { pos: [-600, -300, -1800], color: [0.06, 0.1, 0.2], scale: 900, opacity: 0.04 },
    { pos: [1200, 200, -2600], color: [0.05, 0.12, 0.22], scale: 1000, opacity: 0.035 },
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
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  // Base radial gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Multi-layer noise blobs — more passes for organic complexity
  const rng = seededRng(777);
  for (let pass = 0; pass < 3; pass++) {
    const blobCount = 10 + pass * 5;
    const spreadFactor = 0.3 + pass * 0.15;
    for (let i = 0; i < blobCount; i++) {
      const ox = cx + (rng() - 0.5) * size * spreadFactor;
      const oy = cy + (rng() - 0.5) * size * spreadFactor;
      const r = size * (0.05 + rng() * 0.15);
      const alpha = (0.15 + rng() * 0.25) / (pass + 1);
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.3})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createLighting(scene: THREE.Scene): {
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
} {
  // Hemisphere — subtle cool ambient fill
  const hemisphere = new THREE.HemisphereLight(0x1a2844, 0x000000, 0.3);
  scene.add(hemisphere);

  // Sun — stronger directional for dramatic ship lighting
  const sun = new THREE.DirectionalLight(0xfff8ee, 1.2);
  sun.position.set(200, 150, 100);
  scene.add(sun);

  // Subtle fill light from opposite side — prevents pure black shadows
  const fillLight = new THREE.DirectionalLight(0x1a2040, 0.15);
  fillLight.position.set(-100, -50, -80);
  scene.add(fillLight);

  return { sun, hemisphere };
}

export function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): THREE.CubeTexture {
  // Render the starfield + nebulae to a cube render target for PBR reflections
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
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

/** Planet config — defines the visual profile of each planet type. */
interface PlanetProfile {
  name: string;
  radius: number;
  color: number;          // fallback color while texture generates
  emissive: number;
  atmosColor: number;
  atmosOpacity: number;
  metalness: number;
  roughness: number;
  position: [number, number, number];
  textureSeed: number;
  textureType: 'venus' | 'ice' | 'desert' | 'ocean' | 'gas';
}

const PLANET_PROFILES: PlanetProfile[] = [
  // 0: Venus — warm brown gas giant (original, loads real texture)
  { name: 'venus', radius: 300, color: 0x886644, emissive: 0x221100,
    atmosColor: 0xcc8844, atmosOpacity: 0.035, metalness: 0.05, roughness: 0.85,
    position: [800, -300, -1200], textureSeed: 100, textureType: 'venus' },
  // 1: Ice giant — pale blue-white with wispy cloud bands
  { name: 'ice', radius: 260, color: 0x8899bb, emissive: 0x0a1520,
    atmosColor: 0x6688cc, atmosOpacity: 0.05, metalness: 0.03, roughness: 0.7,
    position: [800, -300, -1200], textureSeed: 201, textureType: 'ice' },
  // 2: Red desert — rust-orange Mars-like with dark highlands
  { name: 'desert', radius: 220, color: 0x994422, emissive: 0x1a0800,
    atmosColor: 0xcc6633, atmosOpacity: 0.025, metalness: 0.08, roughness: 0.9,
    position: [800, -300, -1200], textureSeed: 302, textureType: 'desert' },
  // 3: Ocean world — deep blue with green-brown landmasses and white clouds
  { name: 'ocean', radius: 280, color: 0x224488, emissive: 0x040810,
    atmosColor: 0x88bbff, atmosOpacity: 0.045, metalness: 0.04, roughness: 0.6,
    position: [800, -300, -1200], textureSeed: 403, textureType: 'ocean' },
  // 4: Gas giant — banded amber/cream Jupiter-like with storm spots
  { name: 'gas', radius: 380, color: 0xaa8855, emissive: 0x181008,
    atmosColor: 0xddaa66, atmosOpacity: 0.04, metalness: 0.02, roughness: 0.75,
    position: [800, -300, -1200], textureSeed: 504, textureType: 'gas' },
];

/** Procedural planet surface texture on canvas. */
function createPlanetTexture(type: PlanetProfile['textureType'], seed: number): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const rng = seededRng(seed);

  switch (type) {
    case 'ice': {
      // Pale blue-white base with wispy cloud bands
      const base = ctx.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0.0, '#b0c8e0');
      base.addColorStop(0.2, '#9ab8d4');
      base.addColorStop(0.4, '#c0d4e8');
      base.addColorStop(0.5, '#88a8c8');
      base.addColorStop(0.6, '#a8c0d8');
      base.addColorStop(0.8, '#90b0cc');
      base.addColorStop(1.0, '#b8d0e4');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      // Horizontal cloud bands
      for (let i = 0; i < 30; i++) {
        const y = rng() * H;
        const h = 3 + rng() * 15;
        const alpha = 0.05 + rng() * 0.1;
        ctx.fillStyle = `rgba(200, 220, 240, ${alpha})`;
        ctx.fillRect(0, y, W, h);
      }
      // Subtle swirl patches
      for (let i = 0; i < 20; i++) {
        const cx = rng() * W, cy = rng() * H, cr = 20 + rng() * 60;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        g.addColorStop(0, `rgba(160, 190, 220, ${0.08 + rng() * 0.08})`);
        g.addColorStop(1, 'rgba(160, 190, 220, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }
      break;
    }
    case 'desert': {
      // Rust-orange base with darker highland regions
      const base = ctx.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0.0, '#c87040');
      base.addColorStop(0.15, '#b06030');
      base.addColorStop(0.3, '#d08848');
      base.addColorStop(0.5, '#a05828');
      base.addColorStop(0.7, '#c07838');
      base.addColorStop(0.85, '#905020');
      base.addColorStop(1.0, '#b86838');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
      // Dark highland patches
      for (let i = 0; i < 40; i++) {
        const cx = rng() * W, cy = rng() * H, cr = 15 + rng() * 80;
        const g = ctx.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
        g.addColorStop(0, `rgba(60, 30, 15, ${0.1 + rng() * 0.2})`);
        g.addColorStop(0.7, `rgba(80, 40, 20, ${0.05 + rng() * 0.08})`);
        g.addColorStop(1, 'rgba(80, 40, 20, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
      }
      // Polar ice caps (white at top/bottom)
      for (const yBase of [0, H - 30]) {
        const capG = ctx.createLinearGradient(0, yBase, 0, yBase + (yBase === 0 ? 40 : -10));
        capG.addColorStop(0, 'rgba(220, 210, 200, 0.4)');
        capG.addColorStop(1, 'rgba(220, 210, 200, 0)');
        ctx.fillStyle = capG;
        ctx.fillRect(0, yBase === 0 ? 0 : H - 40, W, 40);
      }
      // Impact craters
      for (let i = 0; i < 15; i++) {
        const cx = rng() * W, cy = rng() * H, cr = 5 + rng() * 20;
        ctx.strokeStyle = `rgba(60, 30, 10, ${0.15 + rng() * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case 'ocean': {
      // Deep blue ocean base
      ctx.fillStyle = '#1a3868';
      ctx.fillRect(0, 0, W, H);
      // Ocean color variation
      for (let i = 0; i < 25; i++) {
        const cx = rng() * W, cy = rng() * H, cr = 30 + rng() * 100;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        const blue = rng() > 0.5 ? '20, 50, 90' : '15, 40, 80';
        g.addColorStop(0, `rgba(${blue}, ${0.1 + rng() * 0.15})`);
        g.addColorStop(1, `rgba(${blue}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }
      // Continents — green-brown landmasses
      for (let i = 0; i < 8; i++) {
        const cx = rng() * W, cy = H * 0.15 + rng() * H * 0.7;
        ctx.fillStyle = `rgba(${60 + Math.floor(rng() * 40)}, ${70 + Math.floor(rng() * 30)}, ${30 + Math.floor(rng() * 20)}, ${0.5 + rng() * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 8; j++) {
          ctx.quadraticCurveTo(
            cx + (rng() - 0.5) * 180, cy + (rng() - 0.5) * 120,
            cx + (rng() - 0.5) * 160, cy + (rng() - 0.5) * 100,
          );
        }
        ctx.closePath(); ctx.fill();
      }
      // White cloud wisps
      for (let i = 0; i < 35; i++) {
        const cx = rng() * W, cy = rng() * H;
        const cw = 30 + rng() * 120, ch = 5 + rng() * 15;
        ctx.fillStyle = `rgba(240, 245, 255, ${0.08 + rng() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch, rng() * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Polar ice
      for (const yBase of [0, H - 25]) {
        const capG = ctx.createLinearGradient(0, yBase, 0, yBase + (yBase === 0 ? 30 : -5));
        capG.addColorStop(0, 'rgba(230, 240, 255, 0.5)');
        capG.addColorStop(1, 'rgba(230, 240, 255, 0)');
        ctx.fillStyle = capG;
        ctx.fillRect(0, yBase === 0 ? 0 : H - 30, W, 30);
      }
      break;
    }
    case 'gas': {
      // Pixel-level noise-based banding — organic, wavy Jupiter-like bands
      const img = ctx.getImageData(0, 0, W, H);
      const d = img.data;

      // Simple 2D value noise for wavy distortion
      const _h3 = (x: number, y: number) => {
        let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
      };
      const _vn = (x: number, y: number) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = _h3(ix, iy), b = _h3(ix + 1, iy);
        const c = _h3(ix, iy + 1), dd = _h3(ix + 1, iy + 1);
        return (a + (b - a) * sx + (c - a) * sy + (a - b - c + dd) * sx * sy) * 2 - 1;
      };
      const _fbm2 = (x: number, y: number, oct: number) => {
        let v = 0, a = 1, f = 1, n = 0;
        for (let o = 0; o < oct; o++) { v += a * _vn(x * f, y * f); n += a; a *= 0.5; f *= 2.0; }
        return v / n;
      };

      // Band color palette — warm amber/cream tones
      const bandColors = [
        [200, 160, 96], [184, 144, 80], [216, 184, 120], [160, 128, 64],
        [192, 152, 88], [220, 192, 136], [176, 136, 72], [200, 168, 104],
        [168, 136, 72], [208, 176, 112], [184, 152, 88], [200, 160, 96],
        [160, 120, 56], [192, 160, 104],
      ];
      const bandCount = bandColors.length;
      const s = seed + 50;

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const idx = (py * W + px) * 4;
          const u = px / W, v = py / H;

          // Wavy band distortion — shifts the Y lookup with noise
          const warp = _fbm2(u * 6 + s, v * 3 + s * 0.3, 4) * 0.06
                     + _fbm2(u * 12 + s * 2, v * 8 + s, 3) * 0.025;
          const distortedV = v + warp;

          // Which band are we in? Use sine-modulated spacing for irregular widths
          const bandPos = distortedV * bandCount + _vn(u * 2 + s, distortedV * 2) * 0.5;
          const bandIdx = Math.floor(((bandPos % bandCount) + bandCount) % bandCount);
          const nextIdx = (bandIdx + 1) % bandCount;
          const bandFrac = bandPos - Math.floor(bandPos);

          // Smooth blend between adjacent bands
          const smooth = bandFrac * bandFrac * (3 - 2 * bandFrac);
          const c0 = bandColors[bandIdx], c1 = bandColors[nextIdx];
          let r = c0[0] + (c1[0] - c0[0]) * smooth;
          let g = c0[1] + (c1[1] - c0[1]) * smooth;
          let b = c0[2] + (c1[2] - c0[2]) * smooth;

          // Turbulence — swirly detail within each band
          const turb = _fbm2(u * 20 + s, v * 10, 4) * 25;
          r += turb; g += turb * 0.8; b += turb * 0.5;

          // Fine horizontal streaks — atmospheric shear
          const streak = _vn(u * 50 + s, v * 200) * 8;
          r += streak; g += streak * 0.7; b += streak * 0.4;

          d[idx]     = Math.max(0, Math.min(255, r));
          d[idx + 1] = Math.max(0, Math.min(255, g));
          d[idx + 2] = Math.max(0, Math.min(255, b));
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Storm spots — painted on top
      for (let i = 0; i < 4; i++) {
        const cx = rng() * W, cy = H * 0.15 + rng() * H * 0.7;
        const rx = 12 + rng() * 35, ry = 8 + rng() * 18;
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        const stormR = rng() > 0.5;
        gg.addColorStop(0, stormR ? 'rgba(180, 80, 40, 0.5)' : 'rgba(220, 190, 130, 0.45)');
        gg.addColorStop(0.4, stormR ? 'rgba(160, 70, 30, 0.25)' : 'rgba(200, 170, 110, 0.2)');
        gg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rng() * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    default: // venus — not used (loads real texture), but provide fallback
      ctx.fillStyle = '#886644';
      ctx.fillRect(0, 0, W, H);
      break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Create a planet from a profile index (0-4). Exported for viewer use. */
export function createPlanet(scene: THREE.Scene, profileIndex = 0): THREE.Group {
  const prof = PLANET_PROFILES[profileIndex % PLANET_PROFILES.length];
  const group = new THREE.Group();

  const planetGeo = new THREE.SphereGeometry(prof.radius, 128, 96);
  const planetMat = new THREE.MeshStandardMaterial({
    color: prof.color,
    metalness: prof.metalness,
    roughness: prof.roughness,
    emissive: prof.emissive,
    emissiveIntensity: 0.3,
  });

  if (prof.textureType === 'venus') {
    // Venus loads a real texture file
    const loader = new THREE.TextureLoader();
    loader.load('/textures/venus_surface.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      planetMat.map = tex;
      planetMat.emissive.set(0x000000);
      planetMat.emissiveIntensity = 0;
      planetMat.needsUpdate = true;
    });
  } else {
    // Procedural canvas texture
    const tex = createPlanetTexture(prof.textureType, prof.textureSeed);
    planetMat.map = tex;
    planetMat.emissive.set(0x000000);
    planetMat.emissiveIntensity = 0;
  }

  const planet = new THREE.Mesh(planetGeo, planetMat);
  group.add(planet);

  // Atmosphere
  const atmos1Geo = new THREE.SphereGeometry(prof.radius * 1.027, 64, 48);
  const atmos1Mat = new THREE.MeshBasicMaterial({
    color: prof.atmosColor,
    transparent: true,
    opacity: prof.atmosOpacity,
    side: THREE.BackSide,
  });
  group.add(new THREE.Mesh(atmos1Geo, atmos1Mat));

  // Position
  group.position.set(...prof.position);
  group.rotation.y = 0.3;

  scene.add(group);
  return group;
}

/** How many planet types are available. */
export const PLANET_COUNT = PLANET_PROFILES.length;

/** Ice moon — smaller, blue-white with detailed craters and fracture lines */
export function createMoon(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  const rng = seededRng(628);
  const W = 1024;
  const H = 512;

  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = W;
  moonCanvas.height = H;
  const ctx = moonCanvas.getContext('2d')!;

  // Base: icy blue-white surface
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0.0, '#d8e8f0');
  base.addColorStop(0.2, '#c0d8e8');
  base.addColorStop(0.4, '#a8c8d8');
  base.addColorStop(0.6, '#b0d0e0');
  base.addColorStop(0.8, '#c8dce8');
  base.addColorStop(1.0, '#d0e0ec');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Crater features — dark circular shadows
  for (let i = 0; i < 25; i++) {
    const cx = rng() * W;
    const cy = rng() * H;
    const cr = 4 + rng() * 20;
    const cg = ctx.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
    cg.addColorStop(0, `rgba(100, 120, 140, ${0.15 + rng() * 0.15})`);
    cg.addColorStop(0.7, `rgba(80, 100, 120, ${0.05 + rng() * 0.1})`);
    cg.addColorStop(1, 'rgba(80, 100, 120, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ice fracture lines
  ctx.strokeStyle = 'rgba(160, 200, 220, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    ctx.moveTo(rng() * W, rng() * H);
    for (let j = 0; j < 4; j++) {
      ctx.lineTo(rng() * W, rng() * H);
    }
    ctx.stroke();
  }

  const moonFallback = new THREE.CanvasTexture(moonCanvas);
  moonFallback.wrapS = THREE.RepeatWrapping;
  moonFallback.anisotropy = 4;

  const moonGeo = new THREE.SphereGeometry(22, 64, 48);
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonFallback,
    metalness: 0.1,
    roughness: 0.7,
  });

  // Load real 2K ice moon texture
  const moonLoader = new THREE.TextureLoader();
  moonLoader.load('/textures/ice_moon.png', (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    moonMat.map = tex;
    moonMat.needsUpdate = true;
  });
  group.add(new THREE.Mesh(moonGeo, moonMat));

  // Position far from the planet — moons orbit at great distance
  group.position.set(-1800, 500, -2800);

  scene.add(group);
  return group;
}

export interface SpaceEnvironment {
  skybox: THREE.Group;
  stars: THREE.Points;
  nebulae: THREE.Group;
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
  planet: THREE.Group;
  planetRadius: number;
  moon: THREE.Group;
  moonRadius: number;
}

export function createSpaceEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): SpaceEnvironment {
  // Load NASA photo-realistic skybox (replaces procedural background)
  const skybox = createPhotoSkybox(scene);

  const stars = createStarfield(scene);
  const nebulae = createNebulae(scene);
  const { sun, hemisphere } = createLighting(scene);
  const planetIndex = Math.floor(Math.random() * PLANET_COUNT);
  const planet = createPlanet(scene, planetIndex);
  const planetRadius = PLANET_PROFILES[planetIndex % PLANET_PROFILES.length].radius;
  const moon = createMoon(scene);
  const moonRadius = 22;

  // Generate environment map for PBR reflections
  createEnvironmentMap(renderer, scene, camera);

  return { skybox, stars, nebulae, sun, hemisphere, planet, planetRadius, moon, moonRadius };
}
