import Phaser from 'phaser';
import { Ship, ShipConfig } from '../entities/Ship';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { HUDSystem } from '../systems/HUDSystem';
import { RustyBehavior } from '../ai/behaviors/RustyBehavior';
import { AIBehavior } from '../ai/AIBehavior';
import { GAME_WIDTH, GAME_HEIGHT, SHIP, AI, PHYSICS, COLORS } from '../config';
import { createStarfieldTexture } from '../ui/Starfield';
import { TouchControls } from '../ui/TouchControls';

export class ArenaScene extends Phaser.Scene {
  private player!: Ship;
  private enemy!: Ship;
  private physicsSystem!: PhysicsSystem;
  private weapons!: WeaponSystem;
  private damageSystem!: DamageSystem;
  private hud!: HUDSystem;
  private aiBehavior!: AIBehavior;
  private touchControls!: TouchControls;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  private score = 0;
  private matchStartTime = 0;
  private matchOver = false;

  constructor() {
    super({ key: 'Arena' });
  }

  create(): void {
    createStarfieldTexture(this, 'starfield');
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'starfield');

    this.cameras.main.setBackgroundColor(COLORS.arena);

    const border = this.add.graphics();
    border.lineStyle(1, COLORS.wall, 0.15);
    border.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);

    // Systems
    this.physicsSystem = new PhysicsSystem();
    this.weapons = new WeaponSystem();
    this.damageSystem = new DamageSystem();

    // Player
    const playerConfig: ShipConfig = {
      hull: SHIP.PLAYER_HULL,
      shield: SHIP.PLAYER_SHIELD,
      speedMult: 1,
      rotationMult: 1,
      textureKey: 'ship_player',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.player = new Ship(this, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.7, playerConfig);
    this.player.rotation = -Math.PI / 2;

    // Enemy (Rusty)
    const enemyConfig: ShipConfig = {
      hull: AI.RUSTY_HULL,
      shield: AI.RUSTY_SHIELD,
      speedMult: AI.RUSTY_SPEED_MULT,
      rotationMult: AI.RUSTY_ROTATION_MULT,
      textureKey: 'ship_enemy',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.enemy = new Ship(this, GAME_WIDTH * 0.7, GAME_HEIGHT * 0.3, enemyConfig);
    this.enemy.rotation = Math.PI / 2;

    // AI
    this.aiBehavior = new RustyBehavior();

    // HUD
    this.hud = new HUDSystem(this);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Touch controls (auto-detected)
    this.touchControls = new TouchControls(this);

    this.score = 0;
    this.matchStartTime = this.time.now;
    this.matchOver = false;
  }

  update(_time: number, delta: number): void {
    if (this.matchOver) return;

    const now = this.time.now;
    const ships = [this.player, this.enemy];

    // Merge keyboard + touch input
    const touch = this.touchControls.getInput();
    let rotateDir = 0;
    let thrust = 0;
    let fire = false;

    // Keyboard
    if (this.cursors.left.isDown || this.wasd.a.isDown) rotateDir = -1;
    if (this.cursors.right.isDown || this.wasd.d.isDown) rotateDir = 1;
    if (this.cursors.up.isDown || this.wasd.w.isDown) thrust = 1;
    if (this.fireKey.isDown) fire = true;

    // Touch (merge — touch overrides if active)
    if (touch.rotateDir !== 0) rotateDir = touch.rotateDir;
    if (touch.thrust > 0) thrust = touch.thrust;
    if (touch.fire) fire = true;

    this.physicsSystem.setInput(this.player, { rotateDir, thrust });

    if (fire) {
      this.weapons.fireBlaster(this, this.player, 'player', now);
    }

    // Draw touch controls overlay
    this.touchControls.draw();

    // AI
    this.aiBehavior.update(this.enemy, this.player, delta, this, this.weapons, this.physicsSystem, now);

    // Physics (returns wall hits for damage)
    const { wallHits } = this.physicsSystem.update(delta, ships, now);
    for (const ship of wallHits) {
      if (!ship.isInvincible(now)) {
        ship.applyDamage(PHYSICS.WALL_DAMAGE, false, now);
      }
    }

    // Bolt lifecycle
    this.weapons.update(now);

    // Damage: bolts vs ships
    const bolts = this.weapons.getBolts();

    const enemyHits = this.damageSystem.checkBoltHits(bolts, this.enemy, 'enemy', now);
    for (const bolt of enemyHits) {
      this.damageSystem.applyBoltDamage(this.enemy, bolt, now);
      const hullDamage = this.enemy.maxShield > 0 && this.enemy.shield >= bolt.damage ? 0 : bolt.damage;
      this.score += hullDamage > 0 ? 10 : 0;
      bolt.destroy();
    }

    const playerHits = this.damageSystem.checkBoltHits(bolts, this.player, 'player', now);
    for (const bolt of playerHits) {
      this.damageSystem.applyBoltDamage(this.player, bolt, now);
      bolt.destroy();
    }

    // Ship collision
    this.damageSystem.checkShipCollision(this.player, this.enemy, now);

    // Shield regen
    this.player.updateShieldRegen(now);
    this.enemy.updateShieldRegen(now);

    // I-frame flicker
    this.player.sprite.setAlpha(this.player.isInvincible(now) ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);
    this.enemy.sprite.setAlpha(this.enemy.isInvincible(now) ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);

    // Win/Lose
    if (!this.enemy.alive) {
      this.endMatch('win', now);
    } else if (!this.player.alive) {
      this.endMatch('lose', now);
    }

    // HUD
    this.hud.update(this.player, this.enemy, this.score);
  }

  private endMatch(result: 'win' | 'lose', now: number): void {
    this.matchOver = true;

    // Scoring bonuses on win
    if (result === 'win') {
      const elapsedSec = Math.floor((now - this.matchStartTime) / 1000);
      const timeBonus = Math.max(0, 5000 - elapsedSec * 50);
      const winBonus = 1000;
      this.score += timeBonus + winBonus;
    }

    const msg = result === 'win'
      ? `OPPONENT DESTROYED\nSCORE: ${this.score.toLocaleString()}\nPress ENTER to continue`
      : 'SHIP DESTROYED\nPress ENTER to retry';

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, {
      fontSize: '24px',
      fontFamily: '"Courier New", monospace',
      color: result === 'win' ? '#44ccaa' : '#ff6644',
      align: 'center',
    }).setOrigin(0.5).setDepth(200);

    // Restart on ENTER key or screen tap
    this.input.keyboard!.once('keydown-ENTER', () => {
      this.weapons.clear();
      this.hud.destroy();
      this.touchControls.destroy();
      this.scene.restart();
    });
    this.input.once('pointerdown', () => {
      this.weapons.clear();
      this.hud.destroy();
      this.touchControls.destroy();
      this.scene.restart();
    });
  }
}
