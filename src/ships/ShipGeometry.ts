// ── Procedural Ship Geometry ─────────────────────────────
// Creates detailed 3D ship models entirely from code.
// Player ship: sleek fighter with swept wings + dual engines.
// Enemy ship: rounder, menacing with angular wings + single engine.

import * as THREE from 'three';

/** Player fighter — ~4K triangles, elongated with swept wings and cockpit dome. */
export function createPlayerShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ── Fuselage ── compact body
  const bodyGeo = new THREE.CylinderGeometry(0.8, 0.5, 1.6, 8, 1);
  bodyGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(bodyGeo);
  fuselage.name = 'fuselage';
  fuselage.position.z = 0;
  group.add(fuselage);

  // ── Nose tip ──
  const noseGeo = new THREE.ConeGeometry(0.5, 0.4, 8);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo);
  nose.name = 'nose';
  nose.position.z = 1.0;
  group.add(nose);

  // ── Cockpit dome ──
  const cockpitGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockpit = new THREE.Mesh(cockpitGeo);
  cockpit.name = 'cockpit';
  cockpit.position.set(0, 0.7, 0);
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

/** Enemy ship — solid, compact fighter. All parts overlap hull for tight look. */
export function createEnemyShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ── Central fuselage — solid core everything attaches to ──
  const fuseGeo = new THREE.BoxGeometry(2.0, 0.7, 3.5);
  const fuse = new THREE.Mesh(fuseGeo);
  fuse.name = 'hull';
  group.add(fuse);

  // ── Nose — tapered front, overlaps fuselage ──
  const noseGeo = new THREE.ConeGeometry(0.8, 2.0, 4);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.rotateZ(Math.PI / 4); // diamond profile
  const nose = new THREE.Mesh(noseGeo);
  nose.name = 'hull';
  nose.position.z = 2.6;
  group.add(nose);

  // ── Cockpit slit — inset into top of fuselage ──
  const cockpitGeo = new THREE.BoxGeometry(0.8, 0.08, 0.6);
  const cockpit = new THREE.Mesh(cockpitGeo);
  cockpit.name = 'cockpit';
  cockpit.position.set(0, 0.36, 0.8);
  group.add(cockpit);

  // ── Wings — flat boxes that extend directly from fuselage sides ──
  const wingGeo = new THREE.BoxGeometry(4.0, 0.12, 2.2);

  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'hull';
  leftWing.position.set(-2.8, 0, -0.3);
  leftWing.rotation.z = -0.04; // very slight anhedral
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo);
  rightWing.name = 'hull';
  rightWing.position.set(2.8, 0, -0.3);
  rightWing.rotation.z = 0.04;
  group.add(rightWing);

  // ── Wing tips — vertical fins, flush with wing edges ──
  const finGeo = new THREE.BoxGeometry(0.12, 0.7, 1.0);

  const leftFin = new THREE.Mesh(finGeo);
  leftFin.name = 'hull';
  leftFin.position.set(-4.7, 0.3, -0.8);
  group.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo);
  rightFin.name = 'hull';
  rightFin.position.set(4.7, 0.3, -0.8);
  group.add(rightFin);

  // ── Cannon barrels — extend from nose, touching fuselage ──
  const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6);
  barrelGeo.rotateX(-Math.PI / 2);

  const leftBarrel = new THREE.Mesh(barrelGeo);
  leftBarrel.name = 'hull';
  leftBarrel.position.set(-0.4, -0.15, 3.2);
  group.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo);
  rightBarrel.name = 'hull';
  rightBarrel.position.set(0.4, -0.15, 3.2);
  group.add(rightBarrel);

  // ── Engines — outer housing (hull-colored) ──
  const engineHousingGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.8, 12);
  engineHousingGeo.rotateX(Math.PI / 2);

  const leftHousing = new THREE.Mesh(engineHousingGeo);
  leftHousing.name = 'hull';
  leftHousing.position.set(-0.7, 0, -2.0);
  group.add(leftHousing);

  const rightHousing = new THREE.Mesh(engineHousingGeo);
  rightHousing.name = 'hull';
  rightHousing.position.set(0.7, 0, -2.0);
  group.add(rightHousing);

  // ── Engine inner core (glowing) ──
  const engineCoreGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.0, 10);
  engineCoreGeo.rotateX(Math.PI / 2);

  const leftCore = new THREE.Mesh(engineCoreGeo);
  leftCore.name = 'engine';
  leftCore.position.set(-0.7, 0, -2.5);
  group.add(leftCore);

  const rightCore = new THREE.Mesh(engineCoreGeo);
  rightCore.name = 'engine';
  rightCore.position.set(0.7, 0, -2.5);
  group.add(rightCore);

  // ── Exhaust cones (inside nozzle) ──
  const exhaustGeo = new THREE.ConeGeometry(0.25, 0.6, 8);
  exhaustGeo.rotateX(Math.PI / 2);

  const leftExhaust = new THREE.Mesh(exhaustGeo);
  leftExhaust.name = 'engine';
  leftExhaust.position.set(-0.7, 0, -3.0);
  group.add(leftExhaust);

  const rightExhaust = new THREE.Mesh(exhaustGeo);
  rightExhaust.name = 'engine';
  rightExhaust.position.set(0.7, 0, -3.0);
  group.add(rightExhaust);

  // ── Nozzle rings — outer rim ──
  const nozzleOuterGeo = new THREE.TorusGeometry(0.45, 0.06, 8, 16);

  const leftNozzleOuter = new THREE.Mesh(nozzleOuterGeo);
  leftNozzleOuter.name = 'hull';
  leftNozzleOuter.position.set(-0.7, 0, -2.9);
  group.add(leftNozzleOuter);

  const rightNozzleOuter = new THREE.Mesh(nozzleOuterGeo);
  rightNozzleOuter.name = 'hull';
  rightNozzleOuter.position.set(0.7, 0, -2.9);
  group.add(rightNozzleOuter);

  // ── Nozzle glow rings — inner ──
  const nozzleGeo = new THREE.RingGeometry(0.15, 0.4, 12);

  const leftNozzle = new THREE.Mesh(nozzleGeo);
  leftNozzle.name = 'nozzle';
  leftNozzle.position.set(-0.7, 0, -2.95);
  group.add(leftNozzle);

  const rightNozzle = new THREE.Mesh(nozzleGeo);
  rightNozzle.name = 'nozzle';
  rightNozzle.position.set(0.7, 0, -2.95);
  group.add(rightNozzle);

  // ── Heat shroud plates — flanking each engine ──
  const shroudGeo = new THREE.BoxGeometry(0.08, 0.6, 1.2);

  const leftShroudL = new THREE.Mesh(shroudGeo);
  leftShroudL.name = 'hull';
  leftShroudL.position.set(-1.0, 0, -2.2);
  group.add(leftShroudL);

  const leftShroudR = new THREE.Mesh(shroudGeo);
  leftShroudR.name = 'hull';
  leftShroudR.position.set(-0.4, 0, -2.2);
  group.add(leftShroudR);

  const rightShroudL = new THREE.Mesh(shroudGeo);
  rightShroudL.name = 'hull';
  rightShroudL.position.set(0.4, 0, -2.2);
  group.add(rightShroudL);

  const rightShroudR = new THREE.Mesh(shroudGeo);
  rightShroudR.name = 'hull';
  rightShroudR.position.set(1.0, 0, -2.2);
  group.add(rightShroudR);

  // ── Rear plate — connects engines visually ──
  const rearGeo = new THREE.BoxGeometry(2.0, 0.5, 0.3);
  const rear = new THREE.Mesh(rearGeo);
  rear.name = 'hull';
  rear.position.set(0, 0, -1.6);
  group.add(rear);

  // ── Top spine — ridge along fuselage for detail ──
  const spineGeo = new THREE.BoxGeometry(0.15, 0.25, 3.0);
  const spine = new THREE.Mesh(spineGeo);
  spine.name = 'hull';
  spine.position.set(0, 0.45, -0.2);
  group.add(spine);

  return group;
}
