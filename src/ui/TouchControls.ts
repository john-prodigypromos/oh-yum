// ── Touch Controls for iPad/Mobile ─────────────────────
// Virtual joystick (left) + fire button (right)
// Auto-detected: only shown when touch input is available.

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

export interface TouchInput {
  rotateDir: number;  // -1, 0, or 1
  thrust: number;     // 0 or 1
  fire: boolean;
}

export class TouchControls {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private enabled: boolean;

  // Joystick state
  private joystickCenter: { x: number; y: number };
  private joystickRadius = 50;
  private joystickOuterRadius = 70;
  private joystickPointer: Phaser.Input.Pointer | null = null;
  private joystickAngle = 0;
  private joystickDistance = 0;

  // Fire button state
  private fireCenter: { x: number; y: number };
  private fireRadius = 40;
  private firePressed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(200).setAlpha(0.5);
    this.enabled = scene.sys.game.device.input.touch;

    // Position: joystick bottom-left, fire button bottom-right
    this.joystickCenter = { x: 120, y: GAME_HEIGHT - 120 };
    this.fireCenter = { x: GAME_WIDTH - 100, y: GAME_HEIGHT - 120 };

    if (this.enabled) {
      this.setupTouchListeners();
    }
  }

  private setupTouchListeners(): void {
    this.scene.input.addPointer(2); // Support up to 3 simultaneous touches

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if this touch is on the fire button
      const fdx = pointer.x - this.fireCenter.x;
      const fdy = pointer.y - this.fireCenter.y;
      if (Math.sqrt(fdx * fdx + fdy * fdy) < this.fireRadius * 1.5) {
        this.firePressed = true;
        return;
      }

      // Check if this touch is on the left half (joystick area)
      if (pointer.x < GAME_WIDTH / 2) {
        this.joystickPointer = pointer;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.updateJoystick(pointer);
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickPointer && pointer.id === this.joystickPointer.id) {
        this.joystickPointer = null;
        this.joystickAngle = 0;
        this.joystickDistance = 0;
      }
      // Check if any fire touch is still held
      const activePointers = [
        this.scene.input.pointer1,
        this.scene.input.pointer2,
        this.scene.input.pointer3,
      ];
      const anyFireHeld = activePointers.some(p => {
        if (!p || !p.isDown) return false;
        const dx = p.x - this.fireCenter.x;
        const dy = p.y - this.fireCenter.y;
        return Math.sqrt(dx * dx + dy * dy) < this.fireRadius * 1.5;
      });
      if (!anyFireHeld) this.firePressed = false;
    });
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.joystickCenter.x;
    const dy = pointer.y - this.joystickCenter.y;
    this.joystickDistance = Math.min(Math.sqrt(dx * dx + dy * dy), this.joystickOuterRadius);
    this.joystickAngle = Math.atan2(dy, dx);
  }

  getInput(): TouchInput {
    if (!this.enabled) return { rotateDir: 0, thrust: 0, fire: false };

    let rotateDir = 0;
    let thrust = 0;

    if (this.joystickPointer && this.joystickDistance > 15) {
      // Use horizontal component for rotation
      const horizontal = Math.cos(this.joystickAngle);
      if (Math.abs(horizontal) > 0.3) {
        rotateDir = horizontal > 0 ? 1 : -1;
      }

      // Use vertical component for thrust (push up = thrust)
      const vertical = Math.sin(this.joystickAngle);
      if (vertical < -0.3) {
        thrust = 1;
      }
    }

    return { rotateDir, thrust, fire: this.firePressed };
  }

  draw(): void {
    if (!this.enabled) return;

    this.graphics.clear();

    // ── Joystick base ring ──
    this.graphics.lineStyle(2, 0x88aacc, 0.3);
    this.graphics.strokeCircle(this.joystickCenter.x, this.joystickCenter.y, this.joystickOuterRadius);

    // Inner dead zone circle
    this.graphics.lineStyle(1, 0x88aacc, 0.15);
    this.graphics.strokeCircle(this.joystickCenter.x, this.joystickCenter.y, 15);

    // Joystick thumb position
    if (this.joystickPointer && this.joystickDistance > 5) {
      const thumbX = this.joystickCenter.x + Math.cos(this.joystickAngle) * this.joystickDistance;
      const thumbY = this.joystickCenter.y + Math.sin(this.joystickAngle) * this.joystickDistance;
      this.graphics.fillStyle(0x88aacc, 0.4);
      this.graphics.fillCircle(thumbX, thumbY, 18);
      this.graphics.lineStyle(1.5, 0x88aacc, 0.5);
      this.graphics.strokeCircle(thumbX, thumbY, 18);
    } else {
      // Resting position
      this.graphics.fillStyle(0x88aacc, 0.2);
      this.graphics.fillCircle(this.joystickCenter.x, this.joystickCenter.y, 18);
    }

    // Direction labels
    this.drawLabel('THRUST', this.joystickCenter.x, this.joystickCenter.y - this.joystickOuterRadius - 14);
    this.drawLabel('L', this.joystickCenter.x - this.joystickOuterRadius - 10, this.joystickCenter.y);
    this.drawLabel('R', this.joystickCenter.x + this.joystickOuterRadius + 10, this.joystickCenter.y);

    // ── Fire button ──
    const fireColor = this.firePressed ? 0xff4422 : 0xff6644;
    const fireAlpha = this.firePressed ? 0.5 : 0.25;
    this.graphics.fillStyle(fireColor, fireAlpha);
    this.graphics.fillCircle(this.fireCenter.x, this.fireCenter.y, this.fireRadius);
    this.graphics.lineStyle(2, fireColor, 0.5);
    this.graphics.strokeCircle(this.fireCenter.x, this.fireCenter.y, this.fireRadius);

    // Fire label
    this.drawLabel('FIRE', this.fireCenter.x, this.fireCenter.y - this.fireRadius - 14);

    // Crosshair inside fire button
    this.graphics.lineStyle(1.5, fireColor, 0.4);
    this.graphics.beginPath();
    this.graphics.moveTo(this.fireCenter.x - 12, this.fireCenter.y);
    this.graphics.lineTo(this.fireCenter.x + 12, this.fireCenter.y);
    this.graphics.strokePath();
    this.graphics.beginPath();
    this.graphics.moveTo(this.fireCenter.x, this.fireCenter.y - 12);
    this.graphics.lineTo(this.fireCenter.x, this.fireCenter.y + 12);
    this.graphics.strokePath();
  }

  private drawLabel(text: string, x: number, y: number): void {
    // Using graphics since adding text objects every frame is expensive
    // Labels are drawn once and stay static — but for simplicity we
    // just skip them in graphics-only mode. The UI is self-explanatory.
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
