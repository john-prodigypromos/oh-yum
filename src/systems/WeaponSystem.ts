import Phaser from 'phaser';
import { Bolt } from '../entities/Bolt';
import { Ship } from '../entities/Ship';
import { WEAPONS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class WeaponSystem {
  private bolts: Bolt[] = [];

  fireBlaster(scene: Phaser.Scene, ship: Ship, owner: 'player' | 'enemy'): boolean {
    const now = Date.now();
    if (now - ship.lastFireTime < WEAPONS.BLASTER_FIRE_RATE) return false;

    ship.lastFireTime = now;
    const textureKey = owner === 'player' ? 'bolt_player' : 'bolt_enemy';

    // Twin parallel bolts
    const perpAngle = ship.rotation + Math.PI / 2;
    const offsetX = Math.cos(perpAngle) * WEAPONS.BLASTER_SPREAD / 2;
    const offsetY = Math.sin(perpAngle) * WEAPONS.BLASTER_SPREAD / 2;

    const noseOffset = 25;
    const noseX = Math.cos(ship.rotation) * noseOffset;
    const noseY = Math.sin(ship.rotation) * noseOffset;

    for (const sign of [-1, 1]) {
      const bx = ship.sprite.x + noseX + offsetX * sign;
      const by = ship.sprite.y + noseY + offsetY * sign;

      const bolt = new Bolt(
        scene, bx, by,
        ship.rotation,
        WEAPONS.BLASTER_BOLT_SPEED,
        WEAPONS.BLASTER_DAMAGE,
        owner,
        textureKey,
        WEAPONS.BLASTER_BOLT_LIFETIME,
      );
      this.bolts.push(bolt);
    }

    return true;
  }

  update(): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      if (!bolt.alive || bolt.isExpired() || bolt.isOutOfBounds(GAME_WIDTH, GAME_HEIGHT)) {
        bolt.destroy();
        this.bolts.splice(i, 1);
      }
    }
  }

  getBolts(): Bolt[] {
    return this.bolts;
  }

  clear(): void {
    for (const bolt of this.bolts) bolt.destroy();
    this.bolts = [];
  }
}
