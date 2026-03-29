import Phaser from 'phaser';

export class ArenaScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Arena' });
  }

  create(): void {
    this.add.text(640, 360, 'OH-YUM ARENA', {
      fontSize: '48px', color: '#88aacc', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }
}
