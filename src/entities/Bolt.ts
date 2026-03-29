import Phaser from 'phaser';

export class Bolt {
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  owner: 'player' | 'enemy';
  spawnTime: number;
  lifetime: number;
  alive: boolean;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    angle: number,
    speed: number,
    damage: number,
    owner: 'player' | 'enemy',
    textureKey: string,
    lifetime: number,
  ) {
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setRotation(angle + Math.PI / 2);
    this.sprite.body!.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    );

    this.damage = damage;
    this.owner = owner;
    this.spawnTime = Date.now();
    this.lifetime = lifetime;
    this.alive = true;
  }

  isExpired(): boolean {
    return Date.now() - this.spawnTime > this.lifetime;
  }

  isOutOfBounds(width: number, height: number): boolean {
    const s = this.sprite;
    return s.x < -20 || s.x > width + 20 || s.y < -20 || s.y > height + 20;
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }
}
