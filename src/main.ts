// ── OH-YUM BLASTER 3D — Main Entry Point ────────────────
// Three.js renderer, scene management, animation loop.

import * as THREE from 'three';
import { createRenderer, handleRendererResize, type RendererBundle } from './renderer/SetupRenderer';
import { createSpaceEnvironment, type SpaceEnvironment } from './renderer/Environment';

// ── Globals ──
let bundle: RendererBundle;
let env: SpaceEnvironment;
let clock: THREE.Clock;

function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Missing #game-canvas element');

  // ── Create renderer + scene + camera + composer ──
  bundle = createRenderer(canvas);

  // ── Space environment (stars, nebulae, lighting, envMap) ──
  env = createSpaceEnvironment(bundle.scene, bundle.renderer, bundle.camera);

  // ── Test emissive object to verify bloom + PBR reflections ──
  const testGeo = new THREE.SphereGeometry(3, 32, 32);
  const testMat = new THREE.MeshPhysicalMaterial({
    color: 0x0088ff,
    emissive: 0x0044ff,
    emissiveIntensity: 1.5,
    metalness: 0.95,
    roughness: 0.2,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
  });
  const testSphere = new THREE.Mesh(testGeo, testMat);
  testSphere.name = 'test-sphere';
  bundle.scene.add(testSphere);

  // Position camera to see the sphere + environment
  bundle.camera.position.set(0, 3, 15);
  bundle.camera.lookAt(0, 0, 0);

  // ── Clock ──
  clock = new THREE.Clock();

  // ── Resize ──
  const onResize = () => handleRendererResize(bundle);
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  // ── Start loop ──
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // Slow-rotate test sphere
  const sphere = bundle.scene.getObjectByName('test-sphere');
  if (sphere) {
    sphere.rotation.y += dt * 0.3;
  }

  bundle.composer.render();
}

// ── Bootstrap ──
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}

export { bundle, env };
