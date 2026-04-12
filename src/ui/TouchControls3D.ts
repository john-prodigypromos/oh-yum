// ── Touch Controls for 3D ────────────────────────────────
// Virtual joystick (left) for pitch/yaw + fire button (right).
// Uses native touch events on a canvas overlay.
// Viewport-relative sizing for mobile compatibility.

export interface TouchInput3D {
  yaw: number;    // -1 to 1
  pitch: number;  // -1 to 1
  thrust: number; // -1 to 1
  fire: boolean;
}

// Y-axis: up joystick = nose up, always. No invert option.

export class TouchControls3D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private enabled: boolean;

  // Joystick state
  private joystickCenter: { x: number; y: number };
  private joystickRadius: number;
  private joystickPointerID: number | null = null;
  private joystickDelta = { x: 0, y: 0 };

  // Fire button state
  private fireCenter: { x: number; y: number };
  private fireRadius: number;
  private firePressed = false;

  // Thrust button state
  private thrustCenter: { x: number; y: number };
  private thrustRadius: number;
  private thrustPressed = false;

  // Reverse button state
  private reverseCenter: { x: number; y: number };
  private reverseRadius: number;
  private reversePressed = false;

  constructor() {
    // Create overlay canvas for touch visualization
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'touch-overlay';
    this.canvas.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      z-index:25;pointer-events:auto;touch-action:none;
    `;
    document.getElementById('ui-overlay')!.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    this.enabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    const ref = Math.min(w, h);
    this.joystickRadius = Math.round(ref * 0.14);
    this.fireRadius = Math.round(ref * 0.12);
    this.thrustRadius = Math.round(ref * 0.09);
    this.reverseRadius = Math.round(ref * 0.09);

    // Right-side button cluster:
    // THRUST (green) = bottom-right
    // REVERSE (red) = same row, left of THRUST
    // FIRE (blue) = above THRUST, slightly more spacing than the horizontal gap
    const rMargin = Math.round(ref * 0.18);          // right edge inset
    const bMargin = Math.round(ref * 0.18);           // bottom edge inset
    const hGap = this.thrustRadius + this.reverseRadius + Math.round(ref * 0.06); // horizontal gap
    const vGap = this.thrustRadius + this.fireRadius + Math.round(ref * 0.1);     // vertical gap (a bit more)

    this.thrustCenter  = { x: w - rMargin, y: h - bMargin };
    this.reverseCenter = { x: w - rMargin - hGap, y: h - bMargin };
    this.fireCenter    = { x: w - rMargin, y: h - bMargin - vGap };

    const joystickBottomMargin = Math.round(ref * 0.35);
    const joystickLeftMargin = Math.round(ref * 0.22);
    this.joystickCenter = { x: joystickLeftMargin, y: h - joystickBottomMargin };

    if (this.enabled) {
      this.setupTouch();
    } else {
      // On desktop, hide the touch overlay entirely so it doesn't block mouse
      this.canvas.style.display = 'none';
    }

    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    const ref = Math.min(w, h);
    this.joystickRadius = Math.round(ref * 0.14);
    this.fireRadius = Math.round(ref * 0.12);
    this.thrustRadius = Math.round(ref * 0.09);
    this.reverseRadius = Math.round(ref * 0.09);

    const rMargin = Math.round(ref * 0.18);
    const bMargin = Math.round(ref * 0.18);
    const hGap = this.thrustRadius + this.reverseRadius + Math.round(ref * 0.06);
    const vGap = this.thrustRadius + this.fireRadius + Math.round(ref * 0.1);

    this.thrustCenter  = { x: w - rMargin, y: h - bMargin };
    this.reverseCenter = { x: w - rMargin - hGap, y: h - bMargin };
    this.fireCenter    = { x: w - rMargin, y: h - bMargin - vGap };

    const joystickBottomMargin = Math.round(ref * 0.35);
    const joystickLeftMargin = Math.round(ref * 0.22);
    this.joystickCenter = { x: joystickLeftMargin, y: h - joystickBottomMargin };
  }

  private setupTouch(): void {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        const x = touch.clientX;
        const y = touch.clientY;

        // Fire button?
        if (this.dist(x, y, this.fireCenter.x, this.fireCenter.y) < this.fireRadius * 1.5) {
          this.firePressed = true;
          continue;
        }

        // Thrust button?
        if (this.dist(x, y, this.thrustCenter.x, this.thrustCenter.y) < this.thrustRadius * 1.5) {
          this.thrustPressed = true;
          continue;
        }

        // Reverse button?
        if (this.dist(x, y, this.reverseCenter.x, this.reverseCenter.y) < this.reverseRadius * 1.5) {
          this.reversePressed = true;
          continue;
        }

        // Left half → joystick
        if (x < window.innerWidth / 2 && this.joystickPointerID === null) {
          this.joystickPointerID = touch.identifier;
          this.updateJoystick(x, y);
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.joystickPointerID) {
          this.updateJoystick(touch.clientX, touch.clientY);
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.joystickPointerID) {
          this.joystickPointerID = null;
          this.joystickDelta = { x: 0, y: 0 };
        }
      }
      // Check if any fire/thrust touch is still held
      const active = Array.from(e.touches);
      this.firePressed = active.some(t =>
        this.dist(t.clientX, t.clientY, this.fireCenter.x, this.fireCenter.y) < this.fireRadius * 1.5
      );
      this.thrustPressed = active.some(t =>
        this.dist(t.clientX, t.clientY, this.thrustCenter.x, this.thrustCenter.y) < this.thrustRadius * 1.5
      );
      this.reversePressed = active.some(t =>
        this.dist(t.clientX, t.clientY, this.reverseCenter.x, this.reverseCenter.y) < this.reverseRadius * 1.5
      );
    });
  }

  private updateJoystick(x: number, y: number): void {
    const dx = x - this.joystickCenter.x;
    const dy = y - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, this.joystickRadius);
    const angle = Math.atan2(dy, dx);
    this.joystickDelta = {
      x: (Math.cos(angle) * clamped) / this.joystickRadius,
      y: (Math.sin(angle) * clamped) / this.joystickRadius,
    };
  }

  private dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  getInput(): TouchInput3D {
    if (!this.enabled) return { yaw: 0, pitch: 0, thrust: 0, fire: false };

    return {
      yaw: Math.abs(this.joystickDelta.x) > 0.15 ? this.joystickDelta.x : 0,
      pitch: Math.abs(this.joystickDelta.y) > 0.15 ? this.joystickDelta.y : 0,
      thrust: (this.thrustPressed ? 1 : 0) + (this.reversePressed ? -1 : 0),
      fire: this.firePressed,
    };
  }

  draw(): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Joystick base
    ctx.strokeStyle = 'rgba(136,170,204,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.joystickCenter.x, this.joystickCenter.y, this.joystickRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Joystick thumb
    const thumbX = this.joystickCenter.x + this.joystickDelta.x * this.joystickRadius;
    const thumbY = this.joystickCenter.y + this.joystickDelta.y * this.joystickRadius;
    ctx.fillStyle = 'rgba(136,170,204,0.3)';
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, this.joystickRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Consistent modern font for all button labels
    const labelFont = '600 13px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Thrust button — green, bottom-right
    ctx.fillStyle = this.thrustPressed ? 'rgba(68,255,68,0.5)' : 'rgba(68,255,68,0.25)';
    ctx.beginPath();
    ctx.arc(this.thrustCenter.x, this.thrustCenter.y, this.thrustRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(68,255,68,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(68,255,68,0.8)';
    ctx.font = labelFont;
    ctx.fillText('THRUST', this.thrustCenter.x, this.thrustCenter.y);

    // Reverse button — red, left of thrust
    ctx.fillStyle = this.reversePressed ? 'rgba(255,68,68,0.5)' : 'rgba(255,68,68,0.25)';
    ctx.beginPath();
    ctx.arc(this.reverseCenter.x, this.reverseCenter.y, this.reverseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,68,68,0.5)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,68,68,0.8)';
    ctx.font = labelFont;
    ctx.fillText('REVERSE', this.reverseCenter.x, this.reverseCenter.y);

    // Fire button — cyan, above thrust
    ctx.fillStyle = this.firePressed ? 'rgba(0,221,255,0.5)' : 'rgba(0,221,255,0.25)';
    ctx.beginPath();
    ctx.arc(this.fireCenter.x, this.fireCenter.y, this.fireRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,221,255,0.5)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,221,255,0.8)';
    ctx.font = '600 15px "Rajdhani", sans-serif';
    ctx.fillText('FIRE', this.fireCenter.x, this.fireCenter.y);
  }

  isEnabled(): boolean { return this.enabled; }

  show(): void { this.canvas.style.display = 'block'; }
  hide(): void { this.canvas.style.display = 'none'; }

  destroy(): void { this.canvas.remove(); }
}
