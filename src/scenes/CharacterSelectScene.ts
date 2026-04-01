import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { CharacterName, CHARACTERS, setCharacter } from '../state/Character';
import { createStarfieldTexture } from '../ui/Starfield';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelect' });
  }

  create(): void {
    // Background
    if (!this.textures.exists('starfield')) {
      createStarfieldTexture(this, 'starfield');
    }
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'starfield');
    this.cameras.main.setBackgroundColor(COLORS.arena);

    // Title
    this.add.text(GAME_WIDTH / 2, 30, 'CHOOSE YOUR PILOT', {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Two character cards side by side
    this.createCharacterCard('owen', GAME_WIDTH * 0.3, 100);
    this.createCharacterCard('william', GAME_WIDTH * 0.7, 100);

    // Footer
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Tap a pilot or press 1 / 2', {
      fontSize: '14px', fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Keyboard shortcuts
    this.input.keyboard!.once('keydown-ONE', () => this.selectCharacter('owen'));
    this.input.keyboard!.once('keydown-TWO', () => this.selectCharacter('william'));
  }

  private createCharacterCard(name: CharacterName, cx: number, top: number): void {
    const cfg = CHARACTERS[name];
    const cardW = 320;
    const cardH = 520;
    const cardX = cx - cardW / 2;

    // Card background — thick bold border
    const gfx = this.add.graphics();
    gfx.fillStyle(0x111822, 0.6);
    gfx.fillRect(cardX, top, cardW, cardH);

    const colorNum = cfg.color;
    gfx.lineStyle(5, colorNum, 0.9);
    gfx.strokeRect(cardX, top, cardW, cardH);

    // Portrait — rendered pixelated
    // Draw the photo into a small canvas, then display scaled up for pixel art effect
    const portraitSize = 300;
    const pixelSize = 64; // Render at this size, then scale up
    const portrait = this.add.image(cx, top + 30 + portraitSize / 2, cfg.imageKey);

    // Scale to fit 300px wide
    const scaleToFit = portraitSize / Math.max(portrait.width, portrait.height);
    portrait.setScale(scaleToFit);

    // Create pixelated version using a render texture
    const rt = this.add.renderTexture(cx, top + 30 + portraitSize / 2, pixelSize, pixelSize);
    rt.setVisible(false);

    // Instead, use CSS-style pixelation via Phaser texture settings
    // Set the texture to use nearest-neighbor filtering (pixelated)
    const tex = this.textures.get(cfg.imageKey);
    if (tex && tex.source[0]) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Remove the initial portrait, recreate with pixel filter active
    portrait.destroy();
    rt.destroy();

    // Create the pixelated portrait
    const pixPortrait = this.add.image(cx, top + 30 + portraitSize / 2, cfg.imageKey);
    const pScale = portraitSize / Math.max(pixPortrait.width, pixPortrait.height);
    pixPortrait.setScale(pScale);

    // To get true pixel art look: draw to a tiny canvas, then display scaled
    this.createPixelPortrait(cfg.imageKey, `${name}_pixel`, pixelSize, (pixKey) => {
      pixPortrait.destroy();
      const pixImg = this.add.image(cx, top + 30 + portraitSize / 2, pixKey);
      const s = portraitSize / Math.max(pixImg.width, pixImg.height);
      pixImg.setScale(s);
      // Force nearest-neighbor on the pixel version too
      const pixTex = this.textures.get(pixKey);
      if (pixTex && pixTex.source[0]) {
        pixTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      pixImg.setScale(s);
    });

    // Character name
    const colorStr = '#' + colorNum.toString(16).padStart(6, '0');
    this.add.text(cx, top + portraitSize + 55, cfg.label, {
      fontSize: '32px', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      color: colorStr, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Tagline
    this.add.text(cx, top + portraitSize + 95, cfg.tagline, {
      fontSize: '16px', fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    // Interactive zone for the whole card
    const zone = this.add.zone(cardX, top, cardW, cardH).setOrigin(0, 0).setInteractive();
    zone.on('pointerover', () => {
      gfx.clear();
      gfx.fillStyle(0x1a2838, 0.7);
      gfx.fillRect(cardX, top, cardW, cardH);
      gfx.lineStyle(6, colorNum, 1);
      gfx.strokeRect(cardX, top, cardW, cardH);
    });
    zone.on('pointerout', () => {
      gfx.clear();
      gfx.fillStyle(0x111822, 0.6);
      gfx.fillRect(cardX, top, cardW, cardH);
      gfx.lineStyle(5, colorNum, 0.9);
      gfx.strokeRect(cardX, top, cardW, cardH);
    });
    zone.on('pointerdown', () => this.selectCharacter(name));
  }

  /**
   * Create a pixelated version of a portrait by drawing it small
   * then registering as a new texture (nearest-neighbor does the rest).
   */
  private createPixelPortrait(
    srcKey: string, destKey: string, tinySize: number,
    onReady: (key: string) => void,
  ): void {
    const srcTex = this.textures.get(srcKey);
    if (!srcTex || !srcTex.source[0]) return;

    const srcImg = srcTex.source[0].image as HTMLImageElement;
    if (!srcImg || !srcImg.complete) return;

    const canvas = document.createElement('canvas');
    canvas.width = tinySize;
    canvas.height = tinySize;
    const ctx = canvas.getContext('2d')!;

    // Disable smoothing for crisp downscale
    ctx.imageSmoothingEnabled = false;

    // Draw the source image into the tiny canvas (this downsamples it)
    const aspect = srcImg.width / srcImg.height;
    let dw = tinySize, dh = tinySize;
    if (aspect > 1) {
      dh = tinySize / aspect;
    } else {
      dw = tinySize * aspect;
    }
    const dx = (tinySize - dw) / 2;
    const dy = (tinySize - dh) / 2;

    // First pass: draw smoothed to get decent downscale
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.drawImage(srcImg, dx, dy, dw, dh);

    // Register as new texture
    if (this.textures.exists(destKey)) this.textures.remove(destKey);
    const newTex = this.textures.addCanvas(destKey, canvas);
    if (newTex) {
      newTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    onReady(destKey);
  }

  private selectCharacter(name: CharacterName): void {
    setCharacter(name);
    this.scene.start('Arena');
  }
}
