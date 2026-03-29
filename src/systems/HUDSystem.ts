import Phaser from 'phaser';
import { Ship } from '../entities/Ship';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class HUDSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private shieldLabel: Phaser.GameObjects.Text;
  private hullLabel: Phaser.GameObjects.Text;
  private targetText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '9px',
      fontFamily: '"Courier New", monospace',
    };

    this.shieldLabel = scene.add.text(20, 20, 'DEFLECTOR', {
      ...labelStyle, color: '#3399dd',
    }).setDepth(100).setAlpha(0.5);

    this.hullLabel = scene.add.text(20, 42, 'HULL', {
      ...labelStyle, color: '#ccbb88',
    }).setDepth(100).setAlpha(0.5);

    this.targetText = scene.add.text(GAME_WIDTH - 20, 20, '', {
      fontSize: '10px', fontFamily: '"Courier New", monospace', color: '#ff6644', align: 'right',
    }).setOrigin(1, 0).setDepth(100).setAlpha(0.6);

    this.weaponText = scene.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 30, 'OH-YUM BLASTER', {
      fontSize: '10px', fontFamily: '"Courier New", monospace', color: '#44ccaa',
    }).setOrigin(1, 0.5).setDepth(100).setAlpha(0.5);

    this.scoreText = scene.add.text(20, GAME_HEIGHT - 30, 'SCORE: 0', {
      fontSize: '10px', fontFamily: '"Courier New", monospace', color: '#ccbb88',
    }).setOrigin(0, 0.5).setDepth(100).setAlpha(0.4);
  }

  update(player: Ship, enemy: Ship, score: number): void {
    this.graphics.clear();

    // Shield bar
    this.drawBar(20, 30, 160, 5, player.shield / (player.maxShield || 1), COLORS.shield);
    // Hull bar
    this.drawBar(20, 52, 160, 5, player.hull / player.maxHull, COLORS.hull);

    // Target info
    if (enemy.alive) {
      const hullPct = Math.round((enemy.hull / enemy.maxHull) * 100);
      this.targetText.setText(`TGT: RUSTY\nHULL: ${hullPct}%`);
    } else {
      this.targetText.setText('TGT: DESTROYED');
    }

    // Score
    this.scoreText.setText(`SCORE: ${score.toLocaleString()}`);

    // Targeting brackets
    if (enemy.alive) {
      this.drawTargetBrackets(enemy.sprite.x, enemy.sprite.y, 40);
    }
  }

  private drawBar(x: number, y: number, w: number, h: number, pct: number, color: number): void {
    // Background
    this.graphics.fillStyle(color, 0.06);
    this.graphics.fillRect(x, y, w, h);
    this.graphics.lineStyle(0.5, color, 0.15);
    this.graphics.strokeRect(x, y, w, h);
    // Fill
    const fillWidth = w * Math.max(0, Math.min(1, pct));
    if (fillWidth > 0) {
      this.graphics.fillStyle(color, 0.8);
      this.graphics.fillRect(x + 0.5, y + 0.5, fillWidth - 1, h - 1);
    }
  }

  private drawTargetBrackets(cx: number, cy: number, size: number): void {
    const s = size;
    const c = s * 0.35;
    this.graphics.lineStyle(1.2, 0xff6644, 0.35);

    const corners: [number, number, number, number, number, number][] = [
      [-s, -s, c, 0, 0, c],
      [s, -s, -c, 0, 0, c],
      [-s, s, c, 0, 0, -c],
      [s, s, -c, 0, 0, -c],
    ];
    for (const [ox, oy, dx1, dy1, dx2, dy2] of corners) {
      this.graphics.beginPath();
      this.graphics.moveTo(cx + ox + dx1, cy + oy + dy1);
      this.graphics.lineTo(cx + ox, cy + oy);
      this.graphics.lineTo(cx + ox + dx2, cy + oy + dy2);
      this.graphics.strokePath();
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.shieldLabel.destroy();
    this.hullLabel.destroy();
    this.targetText.destroy();
    this.weaponText.destroy();
    this.scoreText.destroy();
  }
}
