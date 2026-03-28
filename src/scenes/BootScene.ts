import Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '../config';

/**
 * BootScene — generates placeholder graphics and loads assets.
 * Replace texture generation with real sprite loading as art becomes available.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // ── Generate placeholder textures ──
    // These let us build gameplay without waiting for art.
    // Swap them out for real sprites later.

    this.generateRect('player', TILE_SIZE, TILE_SIZE, COLORS.player);
    this.generateRect('slime', TILE_SIZE, TILE_SIZE, COLORS.slime);
    this.generateRect('skeleton', TILE_SIZE, TILE_SIZE, COLORS.skeleton);
    this.generateRect('bat', TILE_SIZE - 4, TILE_SIZE - 4, COLORS.bat);
    this.generateRect('sword_hitbox', TILE_SIZE * 0.75, TILE_SIZE * 0.4, COLORS.sword);
    this.generateRect('heart', 8, 8, COLORS.heart);
    this.generateRect('heart_empty', 8, 8, COLORS.heartEmpty);
    this.generateRect('rupee', 6, 10, COLORS.rupee);
    this.generateRect('wall_tile', TILE_SIZE, TILE_SIZE, COLORS.wall);
    this.generateRect('floor_tile', TILE_SIZE, TILE_SIZE, COLORS.floor);
    this.generateRect('door_tile', TILE_SIZE, TILE_SIZE, COLORS.door);

    // ── Load real assets here as they become available ──
    // this.load.spritesheet('player_sheet', 'assets/player.png', { frameWidth: 16, frameHeight: 16 });
    // this.load.tilemapTiledJSON('overworld', 'assets/maps/overworld.json');
    // this.load.image('tileset', 'assets/tileset.png');
  }

  create(): void {
    this.scene.start('Overworld');
  }

  /** Helper: generate a solid-color rectangle texture */
  private generateRect(key: string, w: number, h: number, color: number): void {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, w, h);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }
}
