import Phaser from 'phaser';
import { COLORS } from '../config';
import { generateShipSpriteSheet, stampLogoOnSpriteSheet } from '../ships/ShipSpriteGenerator';
import { drawPlayerShip, PLAYER_FRAME_SIZE } from '../ships/PlayerShipRenderer';
import { drawEnemyShip, ENEMY_FRAME_SIZE } from '../ships/EnemyShipRenderer';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // Character portraits
    this.load.image('portrait_owen', 'assets/owen.jpg');
    this.load.image('portrait_william', 'assets/william.jpg');
    this.load.image('logo_player', 'assets/prodigy.png');
    this.load.image('logo_enemy', 'assets/vox.png');
    this.load.image('villain_kip', 'assets/kip.jpg');
  }

  create(): void {
    // HD canvas-rendered ship sprite sheets (36 rotation frames each)
    generateShipSpriteSheet(this, 'ship_player', drawPlayerShip, PLAYER_FRAME_SIZE, 42);
    generateShipSpriteSheet(this, 'ship_enemy', drawEnemyShip, ENEMY_FRAME_SIZE, 137);

    // Stamp logos onto ship bodies
    stampLogoOnSpriteSheet(this, 'ship_player', 'logo_player', PLAYER_FRAME_SIZE, 28, 5);
    stampLogoOnSpriteSheet(this, 'ship_enemy', 'logo_enemy', ENEMY_FRAME_SIZE, 28, 5);

    // Bolts are now drawn as Graphics objects — no textures needed

    // Explosion particle (small bright circle)
    this.generateCircle('particle_explosion', 6, 0xffaa33);

    // Smoke particle for damage trails
    this.generateCircle('particle_smoke', 8, 0x888888);

    this.scene.start('Title');
  }

  private generateRect(key: string, w: number, h: number, color: number): void {
    const gfx = this.make.graphics({}, false);
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, w, h);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private createBoltTexture(key: string, w: number, h: number, cssColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, w, h);
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.addCanvas(key, canvas);
    // Explicitly add frame 0 so physics.add.sprite can find it
    tex!.add(0, 0, 0, 0, w, h);
    tex!.add('__BASE', 0, 0, 0, w, h);
  }

  /** Replace white/near-white pixels with dark space background */
  private replaceWhiteWithBlack(key: string): void {
    const tex = this.textures.get(key);
    if (!tex || !tex.source[0]) return;

    const img = tex.source[0].image as HTMLImageElement;
    if (!img || !img.complete) return;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Space background: #0a1220 → RGB(10, 18, 32)
    const threshold = 200; // pixels with R,G,B all above this are "white"
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
        data[i] = 10;      // R
        data[i + 1] = 18;  // G
        data[i + 2] = 32;  // B
        // Keep alpha as-is
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Replace the texture
    this.textures.remove(key);
    const newTex = this.textures.addCanvas(key, canvas);
    if (newTex) {
      newTex.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
    }
  }

  private generateCircle(key: string, radius: number, color: number): void {
    const gfx = this.make.graphics({}, false);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(radius, radius, radius);
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();
  }
}
