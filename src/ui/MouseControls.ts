// ── Mouse/Trackpad Controls ──────────────────────────────
// Mouse position relative to screen center drives yaw/pitch.
// No click-to-steer — just move the mouse/trackpad to aim.
// Left click or Space fires.

export interface MouseInput {
  yaw: number;      // -1 to 1 (left/right turn)
  verticalMove: number; // -1 to 1 (up/down movement)
}

export class MouseControls {
  private mouseX = 0;
  private mouseY = 0;
  private enabled: boolean;

  // Dead zone in center (fraction of screen half-width/height)
  private deadZone = 0.05;
  // Sensitivity — how far from center = full turn (fraction of screen)
  private sensitivity = 0.4;

  constructor() {
    // Only enable on non-touch devices
    this.enabled = !('ontouchstart' in window) || navigator.maxTouchPoints === 0;

    if (this.enabled) {
      window.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
      });
    }
  }

  getInput(): MouseInput {
    if (!this.enabled) return { yaw: 0, verticalMove: 0 };

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    // Normalized offset from center (-1 to 1)
    const rawX = (this.mouseX - cx) / (cx * this.sensitivity);
    const rawY = (this.mouseY - cy) / (cy * this.sensitivity);

    const yaw = Math.abs(rawX) > this.deadZone
      ? Math.max(-1, Math.min(1, rawX))
      : 0;
    const verticalMove = Math.abs(rawY) > this.deadZone
      ? Math.max(-1, Math.min(1, -rawY)) // mouse up = ship goes up
      : 0;

    return { yaw, verticalMove };
  }

  isEnabled(): boolean { return this.enabled; }
}
