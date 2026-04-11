// ── Holographic Guide Path ───────────────────────────────
// Glowing cyan ring corridor that traces the descent path
// from spawn to landing pad. Rings pulse ahead of the player
// and fade behind. Uses InstancedMesh for performance.

import * as THREE from 'three';

const RING_COUNT = 22;
const RING_MAJOR_RADIUS = 50;
const RING_TUBE_RADIUS = 0.8;

export class GuidePath {
  private mesh: THREE.InstancedMesh;
  private curve: THREE.CatmullRomCurve3;
  private ringPositions: THREE.Vector3[];
  private ringQuaternions: THREE.Quaternion[];
  private dummy = new THREE.Object3D();
  private baseColor = new THREE.Color(0x00ffff);

  constructor(scene: THREE.Scene, spawnPos: THREE.Vector3, padPos: THREE.Vector3) {
    // Define descent curve from spawn down to the pad
    this.curve = new THREE.CatmullRomCurve3([
      spawnPos.clone(),
      new THREE.Vector3(
        THREE.MathUtils.lerp(spawnPos.x, padPos.x, 0.2),
        THREE.MathUtils.lerp(spawnPos.y, padPos.y, 0.15),
        THREE.MathUtils.lerp(spawnPos.z, padPos.z, 0.2),
      ),
      new THREE.Vector3(
        THREE.MathUtils.lerp(spawnPos.x, padPos.x, 0.45),
        THREE.MathUtils.lerp(spawnPos.y, padPos.y, 0.35),
        THREE.MathUtils.lerp(spawnPos.z, padPos.z, 0.5),
      ),
      new THREE.Vector3(
        THREE.MathUtils.lerp(spawnPos.x, padPos.x, 0.7),
        THREE.MathUtils.lerp(spawnPos.y, padPos.y, 0.6),
        THREE.MathUtils.lerp(spawnPos.z, padPos.z, 0.75),
      ),
      new THREE.Vector3(
        padPos.x,
        Math.max(padPos.y + 300, spawnPos.y * 0.08),
        padPos.z,
      ),
      new THREE.Vector3(padPos.x, padPos.y + 50, padPos.z),
    ]);

    // Sample positions and tangents along the curve
    this.ringPositions = [];
    this.ringQuaternions = [];

    const up = new THREE.Vector3(0, 1, 0);
    const lookMat = new THREE.Matrix4();

    for (let i = 0; i < RING_COUNT; i++) {
      const t = i / (RING_COUNT - 1);
      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t);

      // Orient ring to face along the curve tangent
      const lookTarget = pos.clone().add(tangent);
      lookMat.lookAt(pos, lookTarget, up);
      const quat = new THREE.Quaternion().setFromRotationMatrix(lookMat);

      this.ringPositions.push(pos);
      this.ringQuaternions.push(quat);
    }

    // Create instanced mesh — single draw call for all rings
    const ringGeo = new THREE.TorusGeometry(RING_MAJOR_RADIUS, RING_TUBE_RADIUS, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(ringGeo, ringMat, RING_COUNT);
    this.mesh.frustumCulled = false; // always render — rings are spread far apart

    // Set initial transforms
    for (let i = 0; i < RING_COUNT; i++) {
      this.dummy.position.copy(this.ringPositions[i]);
      this.dummy.quaternion.copy(this.ringQuaternions[i]);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    scene.add(this.mesh);
  }

  update(playerPos: THREE.Vector3, now: number): void {
    // Find how far the player is along the curve (approximate by altitude fraction)
    const firstY = this.ringPositions[0].y;
    const lastY = this.ringPositions[RING_COUNT - 1].y;
    const playerProgress = Math.max(0, Math.min(1,
      (firstY - playerPos.y) / (firstY - lastY),
    ));

    const playerRingIndex = Math.floor(playerProgress * (RING_COUNT - 1));

    for (let i = 0; i < RING_COUNT; i++) {
      this.dummy.position.copy(this.ringPositions[i]);
      this.dummy.quaternion.copy(this.ringQuaternions[i]);

      // Determine opacity: fade behind player, pulse ahead
      const ringsBehind = i < playerRingIndex - 1;
      const ringsAhead = i - playerRingIndex;

      let opacity: number;
      let scale = 1.0;

      if (ringsBehind) {
        // Already passed — fade out
        opacity = 0.03;
        scale = 0.6;
      } else if (ringsAhead >= 0 && ringsAhead < 3) {
        // Next 3 rings — pulse brightly to beckon the player
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.003 + i * 1.2);
        opacity = 0.2 + pulse * 0.35;
        scale = 1.0 + pulse * 0.1;
      } else {
        // Further ahead — gentle static glow
        opacity = 0.12;
      }

      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // Per-instance color with opacity via color intensity (InstancedMesh doesn't support per-instance opacity)
      // Approximate by dimming the color
      const c = this.baseColor.clone().multiplyScalar(opacity / 0.25);
      this.mesh.setColorAt(i, c);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
