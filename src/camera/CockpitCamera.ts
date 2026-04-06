// ── Cockpit Camera ───────────────────────────────────────
// First-person camera attached to the player ship.
// Sits slightly behind/above ship center so the nose is visible.
// Smooth roll on turns, dampened pitch follow, screen shake.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';

export class CockpitCamera {
  camera: THREE.PerspectiveCamera;
  private targetRoll = 0;
  private currentRoll = 0;
  private shakeIntensity = 0;
  private shakeDecay = 3; // per second — slower decay for heavier impact feel

  // Camera high up, looking forward — minimal ship visible at bottom edge
  private offset = new THREE.Vector3(0, 2.0, 0.5);

  // Temp vectors to avoid GC
  private _worldPos = new THREE.Vector3();
  private _worldOffset = new THREE.Vector3();
  private _lookTarget = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Call every frame after physics. Attaches camera to player ship. */
  update(player: Ship3D, dt: number, yawInput: number): void {
    // Calculate world-space camera position
    this._worldOffset.copy(this.offset);
    this._worldOffset.applyQuaternion(player.quaternion);
    this._worldPos.copy(player.position).add(this._worldOffset);

    // Tight follow — near-instant position tracking
    this.camera.position.lerp(this._worldPos, Math.min(1, dt * 30));

    // Look target — slightly ahead of ship
    const forward = player.getForward();
    this._lookTarget.copy(player.position).addScaledVector(forward, 20);
    this.camera.lookAt(this._lookTarget);

    // No roll — keep horizon stable for cockpit feel

    // ── Screen shake ──
    if (this.shakeIntensity > 0.01) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
    } else {
      this.shakeIntensity = 0;
    }
  }

  /** Trigger screen shake (e.g., on hit or explosion). */
  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /** Set camera offset from ship center. */
  setOffset(x: number, y: number, z: number): void {
    this.offset.set(x, y, z);
  }
}
