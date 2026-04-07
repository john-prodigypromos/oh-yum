// ── Procedural Ship Geometry ─────────────────────────────
// Detailed 3D ship models built from code with PBR materials.
// Player ship: sleek fighter with swept wings + dual engines.
// Enemy ship: dark gunmetal with red accent lighting.

import * as THREE from 'three';

/** Player fighter — high-detail sculpted hero ship.
 *  LatheGeometry fuselage, framed cockpit canopy, airfoil wings,
 *  twin canted tails, full engine detail, nav lights. */
export function createPlayerShipGeometry(): THREE.Group {
  const group = new THREE.Group();

  // ═══════════════════════════════════════════════════════════
  // FUSELAGE — smooth LatheGeometry, sleeker than enemy
  // ═══════════════════════════════════════════════════════════
  const profile: [number, number][] = [
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
  for (const [x, rz] of [[-5.4, -0.12], [5.4, 0.12]] as const) {
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
  const rearGeo = new THREE.BoxGeometry(2.6, 0.35, 0.2);
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
  navL.position.set(-5.4, 0.3, -0.6);
  group.add(navL);
  const navR = new THREE.PointLight(0x00ff00, 1.5, 8, 2);
  navR.position.set(5.4, 0.3, -0.6);
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
    [0.82,  1.0],  // shoulder
    [0.92,  0.3],  // widest forward
    [0.96,  0.0],  // max beam
    [0.94, -0.4],  // aft of center
    [0.88, -0.9],  // aft taper start
    [0.80, -1.4],  // wing trailing edge area
    [0.70, -1.9],  // aft body
    [0.58, -2.3],  // engine fairing
    [0.50, -2.6],  // engine mount
    [0.48, -2.8],  // between engines
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
  // DORSAL SPINE — raised ridge along the top
  // ═══════════════════════════════════════════════════════════
  const spineShape = new THREE.Shape();
  spineShape.moveTo(0, 0);
  spineShape.lineTo(-0.08, 0);
  spineShape.lineTo(-0.04, 0.18);
  spineShape.lineTo(0.04, 0.18);
  spineShape.lineTo(0.08, 0);
  spineShape.lineTo(0, 0);
  const spineGeo = new THREE.ExtrudeGeometry(spineShape, { depth: 4.0, bevelEnabled: false });
  spineGeo.rotateX(-Math.PI / 2);
  const spine = new THREE.Mesh(spineGeo);
  spine.name = 'hull';
  spine.position.set(0, 0.42, -1.5);
  group.add(spine);

  // ═══════════════════════════════════════════════════════════
  // COCKPIT CANOPY — dome glass + frame rails
  // ═══════════════════════════════════════════════════════════
  const canopyGeo = new THREE.SphereGeometry(0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
  canopyGeo.scale(1.2, 1.0, 2.0);
  const canopy = new THREE.Mesh(canopyGeo);
  canopy.name = 'cockpit';
  canopy.position.set(0, 0.38, 1.2);
  group.add(canopy);

  // Canopy frame — center rail
  const frameGeo = new THREE.BoxGeometry(0.04, 0.08, 1.6);
  const frameCtr = new THREE.Mesh(frameGeo);
  frameCtr.name = 'hull';
  frameCtr.position.set(0, 0.58, 1.2);
  group.add(frameCtr);
  // Canopy frame — side rails
  for (const side of [-1, 1]) {
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 1.4));
    sideRail.name = 'hull';
    sideRail.position.set(side * 0.38, 0.5, 1.2);
    group.add(sideRail);
  }
  // Canopy frame — cross braces
  for (const zOff of [0.5, 1.2]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.03));
    brace.name = 'hull';
    brace.position.set(0, 0.54, zOff);
    group.add(brace);
  }

  // ═══════════════════════════════════════════════════════════
  // LERX — Leading Edge Root Extensions (wing-body blend)
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const lerxShape = new THREE.Shape();
    lerxShape.moveTo(0, 0);
    lerxShape.lineTo(side * 1.0, -0.08);
    lerxShape.lineTo(side * 0.6, -0.2);
    lerxShape.lineTo(0, -0.1);
    lerxShape.lineTo(0, 0);
    const lerxGeo = new THREE.ExtrudeGeometry(lerxShape, { depth: 1.8, bevelEnabled: false });
    lerxGeo.rotateX(-Math.PI / 2);
    const lerx = new THREE.Mesh(lerxGeo);
    lerx.name = 'hull';
    lerx.position.set(0, 0.02, -0.2);
    group.add(lerx);
  }

  // ═══════════════════════════════════════════════════════════
  // WINGS — extruded airfoil, swept & tapered
  // ═══════════════════════════════════════════════════════════
  const wingProfile = new THREE.Shape();
  wingProfile.moveTo(0, 0);
  wingProfile.lineTo(-1.3, -0.05);
  wingProfile.quadraticCurveTo(-1.45, 0.02, -1.3, 0.12);
  wingProfile.lineTo(-0.8, 0.14);
  wingProfile.quadraticCurveTo(-0.4, 0.12, 0, 0.04);
  wingProfile.lineTo(0, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wingProfile, { depth: 4.5, bevelEnabled: false });
  const wPos = wingGeo.attributes.position;
  for (let i = 0; i < wPos.count; i++) {
    const d = wPos.getZ(i);
    const t = d / 4.5;
    const taper = 1 - t * 0.65; // 35% at tip
    wPos.setX(i, wPos.getX(i) * taper);
    wPos.setY(i, wPos.getY(i) * taper);
    // Sweep: shift leading edge back at tips
    if (wPos.getX(i) < -0.3) {
      wPos.setX(i, wPos.getX(i) + t * 0.4);
    }
  }
  wingGeo.computeVertexNormals();

  const leftWing = new THREE.Mesh(wingGeo);
  leftWing.name = 'hull';
  leftWing.rotation.y = Math.PI / 2;
  leftWing.rotation.z = -0.02;
  leftWing.position.set(-0.7, -0.06, -0.1);
  group.add(leftWing);

  const rightWingGeo = wingGeo.clone();
  const rwPos = rightWingGeo.attributes.position;
  for (let i = 0; i < rwPos.count; i++) rwPos.setZ(i, -rwPos.getZ(i));
  rightWingGeo.computeVertexNormals();
  const rightWing = new THREE.Mesh(rightWingGeo);
  rightWing.name = 'hull';
  rightWing.rotation.y = Math.PI / 2;
  rightWing.rotation.z = 0.02;
  rightWing.position.set(0.7, -0.06, -0.1);
  group.add(rightWing);

  // ═══════════════════════════════════════════════════════════
  // WINGTIP FINS — angled outward
  // ═══════════════════════════════════════════════════════════
  const finGeo = new THREE.BoxGeometry(0.06, 0.9, 1.0);
  const finPos = finGeo.attributes.position;
  for (let i = 0; i < finPos.count; i++) {
    const y = finPos.getY(i);
    if (y > 0) finPos.setZ(i, finPos.getZ(i) * (1 - (y / 0.45) * 0.35));
  }
  finGeo.computeVertexNormals();
  for (const [x, rz] of [[-5.0, -0.15], [5.0, 0.15]] as const) {
    const fin = new THREE.Mesh(finGeo.clone());
    fin.name = 'hull';
    fin.position.set(x, 0.35, -0.8);
    fin.rotation.z = rz;
    group.add(fin);
  }

  // ═══════════════════════════════════════════════════════════
  // V-TAIL — twin canted stabilizers with airfoil section
  // ═══════════════════════════════════════════════════════════
  const stabProfile = new THREE.Shape();
  stabProfile.moveTo(0, 0);
  stabProfile.lineTo(-0.7, -0.02);
  stabProfile.quadraticCurveTo(-0.75, 0.02, -0.7, 0.06);
  stabProfile.lineTo(0, 0.03);
  stabProfile.lineTo(0, 0);
  const stabGeo = new THREE.ExtrudeGeometry(stabProfile, { depth: 1.4, bevelEnabled: false });
  const stPos = stabGeo.attributes.position;
  for (let i = 0; i < stPos.count; i++) {
    const d = stPos.getZ(i);
    const t = d / 1.4;
    stPos.setX(i, stPos.getX(i) * (1 - t * 0.45));
    stPos.setY(i, stPos.getY(i) * (1 - t * 0.45));
  }
  stabGeo.computeVertexNormals();

  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(stabGeo.clone());
    stab.name = 'hull';
    stab.rotation.z = side * -Math.PI / 2 + (side > 0 ? Math.PI : 0);
    stab.rotation.x = side * 0.2;
    stab.position.set(side * 0.6, 0.15, -2.4);
    group.add(stab);
  }

  // Horizontal tail planes
  const htGeo = new THREE.BoxGeometry(2.2, 0.06, 0.8);
  const htPos = htGeo.attributes.position;
  for (let i = 0; i < htPos.count; i++) {
    const x = Math.abs(htPos.getX(i));
    htPos.setY(i, htPos.getY(i) * (1 - (x / 1.1) * 0.6));
  }
  htGeo.computeVertexNormals();
  for (const side of [-1, 1]) {
    const ht = new THREE.Mesh(htGeo.clone());
    ht.name = 'hull';
    ht.position.set(side * 1.2, -0.02, -2.4);
    group.add(ht);
  }

  // ═══════════════════════════════════════════════════════════
  // FORWARD INTAKES — smooth scoops with lips
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    // Intake body
    const intGeo = new THREE.CylinderGeometry(0.22, 0.28, 1.0, 14);
    intGeo.rotateX(-Math.PI / 2);
    const intake = new THREE.Mesh(intGeo);
    intake.name = 'hull';
    intake.position.set(side * 0.55, -0.12, 2.3);
    group.add(intake);
    // Intake lip ring
    const lipGeo = new THREE.TorusGeometry(0.24, 0.035, 8, 16);
    const lip = new THREE.Mesh(lipGeo);
    lip.name = 'hull';
    lip.position.set(side * 0.55, -0.12, 2.82);
    group.add(lip);
    // Inner dark
    const innerGeo = new THREE.CircleGeometry(0.2, 14);
    const inner = new THREE.Mesh(innerGeo);
    inner.name = 'armor-dark';
    inner.position.set(side * 0.55, -0.12, 2.83);
    group.add(inner);
  }

  // ═══════════════════════════════════════════════════════════
  // CANNON BARRELS — twin guns with muzzle detail
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const barrelGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 12);
    barrelGeo.rotateX(-Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo);
    barrel.name = 'hull';
    barrel.position.set(side * 0.28, -0.18, 3.8);
    group.add(barrel);
    // Muzzle ring
    const muzzGeo = new THREE.TorusGeometry(0.065, 0.015, 6, 12);
    const muzzle = new THREE.Mesh(muzzGeo);
    muzzle.name = 'hull';
    muzzle.position.set(side * 0.28, -0.18, 4.8);
    group.add(muzzle);
  }

  // Nose sensor dome
  const sensorGeo = new THREE.SphereGeometry(0.12, 10, 8);
  sensorGeo.scale(1, 0.8, 1.5);
  const sensor = new THREE.Mesh(sensorGeo);
  sensor.name = 'armor-dark';
  sensor.position.set(0, 0.15, 3.9);
  group.add(sensor);

  // ═══════════════════════════════════════════════════════════
  // ENGINES — housings, intake lips, cores, petals, nozzles
  // ═══════════════════════════════════════════════════════════
  for (const side of [-1, 1]) {
    const sx = side * 0.62;
    const sy = -0.05;

    // Engine housing
    const ehGeo = new THREE.CylinderGeometry(0.44, 0.5, 2.2, 22);
    ehGeo.rotateX(Math.PI / 2);
    const housing = new THREE.Mesh(ehGeo);
    housing.name = 'hull';
    housing.position.set(sx, sy, -2.2);
    group.add(housing);

    // Engine intake lip (front ring)
    const eiGeo = new THREE.TorusGeometry(0.46, 0.04, 10, 22);
    const intakeLip = new THREE.Mesh(eiGeo);
    intakeLip.name = 'hull';
    intakeLip.position.set(sx, sy, -1.1);
    group.add(intakeLip);

    // Engine fan face (dark)
    const fanGeo = new THREE.CircleGeometry(0.42, 18);
    const fan = new THREE.Mesh(fanGeo);
    fan.name = 'armor-dark';
    fan.position.set(sx, sy, -1.09);
    group.add(fan);

    // Engine core (glowing)
    const ecGeo = new THREE.CylinderGeometry(0.26, 0.36, 1.0, 16);
    ecGeo.rotateX(Math.PI / 2);
    const core = new THREE.Mesh(ecGeo);
    core.name = 'engine';
    core.position.set(sx, sy, -2.9);
    group.add(core);

    // Exhaust cone
    const exGeo = new THREE.ConeGeometry(0.2, 0.5, 14);
    exGeo.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exGeo);
    exhaust.name = 'engine';
    exhaust.position.set(sx, sy, -3.4);
    group.add(exhaust);

    // Nozzle outer ring
    const noGeo = new THREE.TorusGeometry(0.4, 0.045, 12, 24);
    const nOuter = new THREE.Mesh(noGeo);
    nOuter.name = 'hull';
    nOuter.position.set(sx, sy, -3.3);
    group.add(nOuter);

    // Nozzle glow ring
    const ngGeo = new THREE.RingGeometry(0.1, 0.34, 20);
    const nGlow = new THREE.Mesh(ngGeo);
    nGlow.name = 'nozzle';
    nGlow.position.set(sx, sy, -3.35);
    group.add(nGlow);

    // Nozzle petals — 6 small wedges around the nozzle
    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      const petalGeo = new THREE.BoxGeometry(0.04, 0.12, 0.2);
      const petal = new THREE.Mesh(petalGeo);
      petal.name = 'hull';
      petal.position.set(
        sx + Math.cos(angle) * 0.38,
        sy + Math.sin(angle) * 0.38,
        -3.35,
      );
      petal.rotation.z = angle;
      group.add(petal);
    }

    // Heat shroud plates
    for (const offset of [-0.15, 0.15]) {
      const shGeo = new THREE.BoxGeometry(0.06, 0.55, 1.0);
      const shroud = new THREE.Mesh(shGeo);
      shroud.name = 'hull';
      shroud.position.set(sx + offset + side * 0.22, sy, -2.4);
      group.add(shroud);
    }
  }

  // Engine connecting rear plate
  const rearGeo = new THREE.BoxGeometry(1.6, 0.4, 0.25);
  const rear = new THREE.Mesh(rearGeo);
  rear.name = 'hull';
  rear.position.set(0, -0.05, -1.7);
  group.add(rear);

  // ═══════════════════════════════════════════════════════════
  // VENTRAL DETAIL — keel, weapon bays, pylons, fins
  // ═══════════════════════════════════════════════════════════
  // Ventral keel
  const keelGeo = new THREE.BoxGeometry(0.05, 0.22, 3.2);
  const kPos = keelGeo.attributes.position;
  for (let i = 0; i < kPos.count; i++) {
    const z = kPos.getZ(i);
    const t = Math.abs(z) / 1.6;
    if (t > 0.7) kPos.setY(i, kPos.getY(i) * (1 - (t - 0.7) * 2));
  }
  keelGeo.computeVertexNormals();
  const keel = new THREE.Mesh(keelGeo);
  keel.name = 'hull';
  keel.position.set(0, -0.52, 0.3);
  group.add(keel);

  // Weapon bay doors (recessed panels)
  for (const side of [-1, 1]) {
    const bayGeo = new THREE.BoxGeometry(0.5, 0.03, 1.2);
    const bay = new THREE.Mesh(bayGeo);
    bay.name = 'armor-dark';
    bay.position.set(side * 0.4, -0.48, 0.4);
    group.add(bay);
    // Bay outline accents
    const bayEdge = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.03));
    bayEdge.name = 'accent';
    bayEdge.position.set(side * 0.4, -0.47, 1.0);
    group.add(bayEdge);
    const bayEdge2 = bayEdge.clone();
    bayEdge2.position.z = -0.2;
    group.add(bayEdge2);
  }

  // Weapon pylons under wings
  for (const side of [-1, 1]) {
    const pyGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.9, 10);
    pyGeo.rotateX(-Math.PI / 2);
    const pylon = new THREE.Mesh(pyGeo);
    pylon.name = 'hull';
    pylon.position.set(side * 1.8, -0.2, 0.1);
    group.add(pylon);
    // Missile shape on pylon
    const missGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
    missGeo.rotateX(-Math.PI / 2);
    const missile = new THREE.Mesh(missGeo);
    missile.name = 'hull';
    missile.position.set(side * 1.8, -0.32, 0.1);
    group.add(missile);
    const mTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 8));
    mTip.rotateX(-Math.PI / 2);
    mTip.name = 'hull';
    mTip.position.set(side * 1.8, -0.32, 0.52);
    group.add(mTip);
  }

  // Small ventral fins at rear
  for (const side of [-1, 1]) {
    const vfGeo = new THREE.BoxGeometry(0.04, 0.35, 0.5);
    const vfPos = vfGeo.attributes.position;
    for (let i = 0; i < vfPos.count; i++) {
      if (vfPos.getY(i) < 0) vfPos.setZ(i, vfPos.getZ(i) * 0.6);
    }
    vfGeo.computeVertexNormals();
    const vFin = new THREE.Mesh(vfGeo);
    vFin.name = 'hull';
    vFin.position.set(side * 0.62, -0.4, -2.6);
    vFin.rotation.z = side * 0.1;
    group.add(vFin);
  }

  // ═══════════════════════════════════════════════════════════
  // ACCENT PANEL LINES — red glowing seams
  // ═══════════════════════════════════════════════════════════
  // Dorsal spine lines
  for (const side of [-1, 1]) {
    const aGeo = new THREE.BoxGeometry(0.035, 0.035, 4.5);
    const accent = new THREE.Mesh(aGeo);
    accent.name = 'accent';
    accent.position.set(side * 0.32, 0.44, 0.5);
    group.add(accent);
  }
  // Ventral lines
  for (const side of [-1, 1]) {
    const aGeo = new THREE.BoxGeometry(0.035, 0.035, 2.8);
    const accent = new THREE.Mesh(aGeo);
    accent.name = 'accent';
    accent.position.set(side * 0.45, -0.44, 0.2);
    group.add(accent);
  }
  // Wing leading edge lines
  for (const side of [-1, 1]) {
    const aGeo = new THREE.BoxGeometry(3.5, 0.03, 0.03);
    const accent = new THREE.Mesh(aGeo);
    accent.name = 'accent';
    accent.position.set(side * 2.5, 0.04, 0.9);
    group.add(accent);
  }
  // Engine accent rings
  for (const side of [-1, 1]) {
    const aGeo = new THREE.TorusGeometry(0.5, 0.02, 8, 20);
    const accent = new THREE.Mesh(aGeo);
    accent.name = 'accent';
    accent.position.set(side * 0.62, -0.05, -1.3);
    group.add(accent);
    // Second ring at rear
    const a2 = new THREE.Mesh(aGeo.clone());
    a2.name = 'accent';
    a2.position.set(side * 0.62, -0.05, -2.8);
    group.add(a2);
  }
  // Fuselage cross-seam accents
  for (const z of [1.5, 0.0, -0.8]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.03, 0.03));
    seam.name = 'accent';
    seam.position.set(0, 0.45, z);
    group.add(seam);
  }

  // ═══════════════════════════════════════════════════════════
  // DARK ARMOR PANELS
  // ═══════════════════════════════════════════════════════════
  const armorUnder = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 2.2));
  armorUnder.name = 'armor-dark';
  armorUnder.position.set(0, -0.47, 0.3);
  group.add(armorUnder);

  for (const side of [-1, 1]) {
    const wPanel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.9));
    wPanel.name = 'armor-dark';
    wPanel.position.set(side * 3.0, 0.06, -0.3);
    group.add(wPanel);
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION LIGHTS — red port, green starboard
  // ═══════════════════════════════════════════════════════════
  const navL = new THREE.PointLight(0xff0000, 1.5, 8, 2);
  navL.position.set(-5.0, 0.3, -0.5);
  group.add(navL);
  const navR = new THREE.PointLight(0x00ff00, 1.5, 8, 2);
  navR.position.set(5.0, 0.3, -0.5);
  group.add(navR);

  // Tail warning light
  const tailLight = new THREE.PointLight(0xff2200, 1, 6, 2);
  tailLight.position.set(0, 0.3, -2.8);
  group.add(tailLight);

  // ═══════════════════════════════════════════════════════════
  // ACCENT ILLUMINATION
  // ═══════════════════════════════════════════════════════════
  const accentLight1 = new THREE.PointLight(0xff2200, 2, 15, 2);
  accentLight1.position.set(0, 0.5, 0.8);
  group.add(accentLight1);
  const accentLight2 = new THREE.PointLight(0xff2200, 1.5, 12, 2);
  accentLight2.position.set(0, -0.5, -1.0);
  group.add(accentLight2);

  return group;
}
