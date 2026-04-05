// ── Procedural Ship Geometry ─────────────────────────────
// Creates detailed 3D ship models entirely from code.
// Player ship: sleek fighter with swept wings + dual engines.
// Enemy ship: rounder, menacing with angular wings + single engine.

import * as THREE from 'three';

/** Player fighter — ~4K triangles, elongated with swept wings and cockpit dome. */
export function createPlayerShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ── Fuselage ── short tapered body (60% shorter)
  const bodyGeo = new THREE.CylinderGeometry(0.8, 0.5, 3.2, 8, 1);
  bodyGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(bodyGeo);
  fuselage.name = 'fuselage';
  fuselage.position.z = 0;
  group.add(fuselage);

  // ── Nose tip (stubby) ──
  const noseGeo = new THREE.ConeGeometry(0.5, 0.6, 8);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo);
  nose.name = 'nose';
  nose.position.z = 1.9;
  group.add(nose);

  // ── Cockpit dome ──
  const cockpitGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockpit = new THREE.Mesh(cockpitGeo);
  cockpit.name = 'cockpit';
  cockpit.position.set(0, 0.7, 0.5);
  group.add(cockpit);

  // ── Wings ── swept back, angled
  const wingGeo = new THREE.BoxGeometry(5, 0.12, 2.5);
  // Left wing
  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'wing-left';
  leftWing.position.set(-2.8, 0, -0.5);
  leftWing.rotation.z = -0.05;
  leftWing.rotation.y = -0.15;
  group.add(leftWing);

  // Right wing
  const rightWing = new THREE.Mesh(wingGeo);
  rightWing.name = 'wing-right';
  rightWing.position.set(2.8, 0, -0.5);
  rightWing.rotation.z = 0.05;
  rightWing.rotation.y = 0.15;
  group.add(rightWing);

  // ── Wing tips ── angled up
  const tipGeo = new THREE.BoxGeometry(0.12, 1.0, 1.5);
  const leftTip = new THREE.Mesh(tipGeo);
  leftTip.name = 'tip-left';
  leftTip.position.set(-5.2, 0.4, -1.0);
  group.add(leftTip);

  const rightTip = new THREE.Mesh(tipGeo);
  rightTip.name = 'tip-right';
  rightTip.position.set(5.2, 0.4, -1.0);
  group.add(rightTip);

  // ── Engine nacelles ── two cylinders at rear
  const engineGeo = new THREE.CylinderGeometry(0.4, 0.5, 2, 8);
  engineGeo.rotateX(Math.PI / 2);

  const leftEngine = new THREE.Mesh(engineGeo);
  leftEngine.name = 'engine-left';
  leftEngine.position.set(-1.2, -0.1, -3.5);
  group.add(leftEngine);

  const rightEngine = new THREE.Mesh(engineGeo);
  rightEngine.name = 'engine-right';
  rightEngine.position.set(1.2, -0.1, -3.5);
  group.add(rightEngine);

  // ── Engine nozzle glow rings ──
  const nozzleGeo = new THREE.RingGeometry(0.25, 0.5, 12);
  const leftNozzle = new THREE.Mesh(nozzleGeo);
  leftNozzle.name = 'nozzle-left';
  leftNozzle.position.set(-1.2, -0.1, -4.55);
  group.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo);
  rightNozzle.name = 'nozzle-right';
  rightNozzle.position.set(1.2, -0.1, -4.55);
  group.add(rightNozzle);

  return group;
}

/** Enemy ship — rounder, menacing silhouette with angular wings. */
export function createEnemyShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ── Body ── wider, flatter, more aggressive
  const bodyGeo = new THREE.SphereGeometry(1.2, 10, 8);
  bodyGeo.scale(1, 0.6, 1.5);
  const body = new THREE.Mesh(bodyGeo);
  body.name = 'body';
  group.add(body);

  // ── Forward spike ──
  const spikeGeo = new THREE.ConeGeometry(0.4, 2.5, 6);
  spikeGeo.rotateX(-Math.PI / 2);
  const spike = new THREE.Mesh(spikeGeo);
  spike.name = 'spike';
  spike.position.z = 2.5;
  group.add(spike);

  // ── Angular wings ── V-shaped, menacing
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(4, -0.8);
  wingShape.lineTo(3.5, -1.5);
  wingShape.lineTo(0.5, -0.5);
  wingShape.lineTo(0, 0);

  const wingExtrudeSettings = { depth: 0.1, bevelEnabled: false };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);

  // Left wing
  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'wing-left';
  leftWing.position.set(-0.5, 0, 0);
  leftWing.rotation.y = Math.PI;
  leftWing.rotation.x = -0.1;
  group.add(leftWing);

  // Right wing (mirror)
  const rightWingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  rightWingGeo.scale(-1, 1, 1);
  const rightWing = new THREE.Mesh(rightWingGeo);
  rightWing.name = 'wing-right';
  rightWing.position.set(0.5, 0, 0);
  rightWing.rotation.y = Math.PI;
  rightWing.rotation.x = -0.1;
  group.add(rightWing);

  // ── Single large engine ──
  const engineGeo = new THREE.CylinderGeometry(0.6, 0.7, 1.5, 8);
  engineGeo.rotateX(Math.PI / 2);
  const engine = new THREE.Mesh(engineGeo);
  engine.name = 'engine';
  engine.position.set(0, 0, -2.2);
  group.add(engine);

  // ── Engine nozzle ──
  const nozzleGeo = new THREE.RingGeometry(0.35, 0.7, 12);
  const nozzle = new THREE.Mesh(nozzleGeo);
  nozzle.name = 'nozzle';
  nozzle.position.set(0, 0, -3.0);
  group.add(nozzle);

  return group;
}
