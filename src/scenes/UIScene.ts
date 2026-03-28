import Phaser from 'phaser';
import { SCALE, PLAYER_MAX_HP } from '../config';
import { GameState } from '../state/GameState';

/**
 * UIScene — HUD overlay that runs on top of the game scene.
 * Shows hearts, rupee count, and current item.
 */
export class UIScene extends Phaser.Scene {
  private hearts: Phaser.GameObjects.Sprite[] = [];
  private rupeeText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UI' });
  }

  create(): void {
    const padding = 12;
    const heartSize = 8 * SCALE;
    const heartSpacing = heartSize + 4;

    // ── Hearts ──
    const totalHearts = PLAYER_MAX_HP / 2; // Each heart = 2 HP
    for (let i = 0; i < totalHearts; i++) {
      const heart = this.add.sprite(
        padding + i * heartSpacing + heartSize / 2,
        padding + heartSize / 2,
        'heart',
      );
      heart.setScale(SCALE);
      this.hearts.push(heart);
    }

    // ── Rupees ──
    this.rupeeText = this.add.text(padding, padding + heartSize + 8, '0', {
      fontSize: `${14 * SCALE}px`,
      color: '#22dd44',
      fontFamily: 'monospace',
    });

    // ── Listen for damage events from game scene ──
    const overworldScene = this.scene.get('Overworld');
    overworldScene.events.on('player-damaged', () => this.refreshHearts());

    this.refreshHearts();
    this.refreshRupees();
  }

  update(): void {
    this.refreshRupees();
  }

  private refreshHearts(): void {
    const hp = GameState.player.hp;
    const totalHearts = GameState.player.maxHp / 2;

    for (let i = 0; i < totalHearts; i++) {
      const heartHp = Math.max(0, Math.min(2, hp - i * 2));
      if (heartHp >= 2) {
        this.hearts[i].setTexture('heart');
        this.hearts[i].setAlpha(1);
      } else if (heartHp === 1) {
        this.hearts[i].setTexture('heart');
        this.hearts[i].setAlpha(0.5); // Half heart — swap for real half-heart sprite later
      } else {
        this.hearts[i].setTexture('heart_empty');
        this.hearts[i].setAlpha(1);
      }
    }
  }

  private refreshRupees(): void {
    this.rupeeText.setText(`${GameState.player.rupees}`);
  }
}
