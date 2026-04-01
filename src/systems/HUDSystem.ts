import Phaser from 'phaser';
import { Ship } from '../entities/Ship';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { currentCharacter, CHARACTERS } from '../state/Character';

export class HUDSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private bannerGraphics: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private titleJP: Phaser.GameObjects.Text;
  private shieldLabel: Phaser.GameObjects.Text;
  private hullLabel: Phaser.GameObjects.Text;
  private targetText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private studioText: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image;
  private portraitBorder: Phaser.GameObjects.Graphics;
  private pilotName: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);

    // ── Title text (no background) ──
    this.bannerGraphics = scene.add.graphics();
    this.bannerGraphics.setDepth(99);

    this.titleText = scene.add.text(GAME_WIDTH / 2, 4, 'OH-YUM BLASTER', {
      fontSize: '36px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(100);

    this.titleJP = scene.add.text(GAME_WIDTH / 2, 42, 'オー・ヤム ブラスター', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(100);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
    };

    this.shieldLabel = scene.add.text(20, 16, 'DEFLECTOR', {
      ...labelStyle, color: '#00eeff',
      stroke: '#000000', strokeThickness: 1,
    }).setDepth(100);

    this.hullLabel = scene.add.text(20, 50, 'HULL', {
      ...labelStyle, color: '#44ff44',
      stroke: '#000000', strokeThickness: 1,
    }).setDepth(100);

    this.targetText = scene.add.text(0, 0, '', {
      fontSize: '1px',
    }).setVisible(false);

    this.weaponText = scene.add.text(0, 0, '', {
      fontSize: '1px',
    }).setVisible(false);

    this.scoreText = scene.add.text(20, GAME_HEIGHT - 30, 'SCORE: 0', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold', color: '#000000',
      stroke: '#ffff00', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(100);

    this.studioText = scene.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, 'PRIDAY LABS', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      color: '#00ff66',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 1).setDepth(100);

    // ── Pilot portrait (top right) ──
    const cfg = CHARACTERS[currentCharacter];
    const portraitSize = 70;
    const px = GAME_WIDTH - 20 - portraitSize / 2;
    const py = 20 + portraitSize / 2;

    // Use the pixel version if available, otherwise original
    const pixKey = `${currentCharacter}_pixel`;
    const imgKey = scene.textures.exists(pixKey) ? pixKey : cfg.imageKey;

    this.portraitBorder = scene.add.graphics();
    this.portraitBorder.setDepth(99);
    const colorNum = cfg.color;
    this.portraitBorder.lineStyle(4, colorNum, 1);
    this.portraitBorder.strokeRect(
      px - portraitSize / 2 - 4, py - portraitSize / 2 - 4,
      portraitSize + 8, portraitSize + 8
    );

    this.portrait = scene.add.image(px, py, imgKey);
    const pScale = portraitSize / Math.max(this.portrait.width, this.portrait.height);
    this.portrait.setScale(pScale);
    this.portrait.setDepth(100);

    // Pilot name under portrait
    this.pilotName = scene.add.text(px, py + portraitSize / 2 + 10, cfg.label, {
      fontSize: '12px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5, 0).setDepth(100);
  }

  update(player: Ship, enemy: Ship, score: number): void {
    this.graphics.clear();

    // Shield bar
    const shieldPct = player.shield / (player.maxShield || 1);
    this.drawBar(20, 32, 260, 14, shieldPct, COLORS.shield);
    // Hull bar
    const hullPct = player.hull / player.maxHull;
    this.drawBar(20, 66, 260, 14, hullPct, COLORS.hull);

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
    // Dark background
    this.graphics.fillStyle(0x000000, 0.5);
    this.graphics.fillRect(x, y, w, h);
    // Border
    this.graphics.lineStyle(2, color, 1);
    this.graphics.strokeRect(x, y, w, h);
    // Fill
    const clamped = Math.max(0, Math.min(1, pct));
    const fillWidth = w * clamped;
    if (fillWidth > 0) {
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRect(x + 1, y + 1, fillWidth - 2, h - 2);
    }
  }

  private drawTargetBrackets(cx: number, cy: number, size: number): void {
    const s = size;
    const c = s * 0.35;
    this.graphics.lineStyle(1.5, 0xff4444, 0.7);

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
    this.bannerGraphics.destroy();
    this.titleText.destroy();
    this.titleJP.destroy();
    this.shieldLabel.destroy();
    this.hullLabel.destroy();
    this.targetText.destroy();
    this.weaponText.destroy();
    this.scoreText.destroy();
    this.studioText.destroy();
    this.portrait.destroy();
    this.portraitBorder.destroy();
    this.pilotName.destroy();
  }
}
