// ── Renderer Factory ─────────────────────────────────────
// Creates WebGLRenderer + EffectComposer pipeline.
// All post-processing (bloom, AA, tonemapping) configured here.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export interface RendererBundle {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bloomPass: UnrealBloomPass;
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function createRenderer(canvas: HTMLCanvasElement): RendererBundle {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // ── WebGL Renderer ──
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // SMAA handles AA via post-processing
    powerPreference: 'high-performance',
  });
  // Cap pixel ratio at 2× for all devices — prevents 9× pixel load on retina
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9; // slightly brighter exposure for cinematic space look
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ── Scene ──
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010208); // near-black with barely perceptible blue

  // ── Camera ──
  const camera = new THREE.PerspectiveCamera(75, w / h, 1, 3000000);
  camera.position.set(0, 0, 0);

  // ── Post-Processing ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Bloom — reduced on mobile for performance
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(isMobile ? w / 2 : w, isMobile ? h / 2 : h),
    isMobile ? 0.3 : 0.55,   // strength
    isMobile ? 0.3 : 0.5,    // radius
    isMobile ? 0.9 : 0.82,   // threshold — higher on mobile = fewer pixels caught
  );
  composer.addPass(bloomPass);

  // Anti-aliasing — skip on mobile
  if (!isMobile) {
    composer.addPass(new SMAAPass());
  }

  // Final output (applies tonemapping + color space)
  composer.addPass(new OutputPass());

  return { renderer, composer, scene, camera, bloomPass };
}

export function handleRendererResize(bundle: RendererBundle): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  bundle.camera.aspect = w / h;
  bundle.camera.updateProjectionMatrix();
  bundle.renderer.setSize(w, h);
  bundle.composer.setSize(w, h);
}
