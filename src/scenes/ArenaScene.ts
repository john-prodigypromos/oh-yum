import Phaser from 'phaser';
import { Ship, ShipConfig } from '../entities/Ship';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { HUDSystem } from '../systems/HUDSystem';
import { RustyBehavior } from '../ai/behaviors/RustyBehavior';
import { AIBehavior } from '../ai/AIBehavior';
import { GAME_WIDTH, GAME_HEIGHT, SHIP, PHYSICS, COLORS } from '../config';
import { currentDifficulty, DIFFICULTY } from '../state/Difficulty';
import { createStarfieldTexture } from '../ui/Starfield';
import { TouchControls } from '../ui/TouchControls';
import { SoundSystem } from '../systems/SoundSystem';

export class ArenaScene extends Phaser.Scene {
  private player!: Ship;
  private enemy!: Ship;
  private physicsSystem!: PhysicsSystem;
  private weapons!: WeaponSystem;
  private damageSystem!: DamageSystem;
  private hud!: HUDSystem;
  private aiBehavior!: AIBehavior;
  private touchControls!: TouchControls;
  private sound_sys!: SoundSystem;

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

    // Difficulty settings
    const diff = DIFFICULTY[currentDifficulty];

    // Player
    const playerConfig: ShipConfig = {
      hull: diff.playerHull,
      shield: diff.playerShield,
      speedMult: 1,
      rotationMult: 1,
      textureKey: 'ship_player',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.player = new Ship(this, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.7, playerConfig);
    this.player.rotation = -Math.PI / 2;

    // Enemy (Rusty) — scaled by difficulty
    const enemyConfig: ShipConfig = {
      hull: diff.enemyHull,
      shield: diff.enemyShield,
      speedMult: diff.enemySpeedMult,
      rotationMult: diff.enemyRotationMult,
      textureKey: 'ship_enemy',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.enemy = new Ship(this, GAME_WIDTH * 0.7, GAME_HEIGHT * 0.3, enemyConfig);
    this.enemy.rotation = Math.PI / 2;

    // Damage smoke emitters
    this.player.smokeEmitter = this.add.particles(0, 0, 'particle_smoke', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 300, max: 800 },
      tint: [0xff6600, 0x444444, 0x222222],
      emitting: false,
    });
    this.player.smokeEmitter.setDepth(45);

    this.enemy.smokeEmitter = this.add.particles(0, 0, 'particle_smoke', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: { min: 300, max: 800 },
      tint: [0xff6600, 0x444444, 0x222222],
      emitting: false,
    });
    this.enemy.smokeEmitter.setDepth(45);

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

    // Sound system (init on first user interaction)
    this.sound_sys = new SoundSystem();
    this.input.once('pointerdown', () => this.sound_sys.init());
    this.input.keyboard!.once('keydown', () => this.sound_sys.init());

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
      const fired = this.weapons.fireBlaster(this, this.player, 'player', now);
      if (fired) this.sound_sys.playerShoot();
    }

    // Engine thrust sound
    if (thrust > 0) {
      this.sound_sys.startThrust();
    } else {
      this.sound_sys.stopThrust();
    }

    // Draw touch controls overlay
    this.touchControls.draw();

    // AI (track bolt count to detect enemy firing)
    const boltsBefore = this.weapons.getBolts().length;
    this.aiBehavior.update(this.enemy, this.player, delta, this, this.weapons, this.physicsSystem, now);
    if (this.weapons.getBolts().length > boltsBefore) {
      this.sound_sys.enemyShoot();
    }

    // Physics (returns wall hits for damage)
    const { wallHits } = this.physicsSystem.update(delta, ships, now);
    for (const ship of wallHits) {
      if (!ship.isInvincible(now)) {
        ship.applyDamage(PHYSICS.WALL_DAMAGE, false, now);
        this.sound_sys.wallBounce();
      }
    }

    // Bolt lifecycle
    this.weapons.update(now, delta);

    // Damage: bolts vs ships
    const bolts = this.weapons.getBolts();

    const enemyHits = this.damageSystem.checkBoltHits(bolts, this.enemy, 'enemy', now);
    for (const bolt of enemyHits) {
      const hadShield = this.enemy.shield > 0;
      this.damageSystem.applyBoltDamage(this.enemy, bolt, now);
      const hullDamage = hadShield && this.enemy.shield >= 0 ? 0 : bolt.damage;
      this.score += hullDamage > 0 ? 10 : 0;
      hadShield && this.enemy.shield > 0 ? this.sound_sys.shieldHit() : this.sound_sys.hullHit();
      bolt.destroy();
    }

    const playerHits = this.damageSystem.checkBoltHits(bolts, this.player, 'player', now);
    for (const bolt of playerHits) {
      const hadShield = this.player.shield > 0;
      this.damageSystem.applyBoltDamage(this.player, bolt, now);
      hadShield && this.player.shield > 0 ? this.sound_sys.shieldHit() : this.sound_sys.hullHit();
      bolt.destroy();
    }

    // Ship collision
    const collided = this.damageSystem.checkShipCollision(this.player, this.enemy, now);
    if (collided) this.sound_sys.shipCollision();

    // Shield regen
    this.player.updateShieldRegen(now);
    this.enemy.updateShieldRegen(now);

    // Damage visuals (tint, warp, smoke)
    this.player.updateDamageVisuals(now);
    this.enemy.updateDamageVisuals(now);

    // I-frame flicker (alpha only — damage tint applied above)
    this.player.sprite.setAlpha(this.player.isInvincible(now) ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);
    this.enemy.sprite.setAlpha(this.enemy.isInvincible(now) ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);

    // Win/Lose
    if (!this.enemy.alive) {
      this.spawnExplosion(this.enemy.sprite.x, this.enemy.sprite.y);
      this.sound_sys.explosion();
      this.sound_sys.stopThrust();
      this.endMatch('win', now);
    } else if (!this.player.alive) {
      this.spawnExplosion(this.player.sprite.x, this.player.sprite.y);
      this.sound_sys.explosion();
      this.sound_sys.stopThrust();
      this.endMatch('lose', now);
    }

    // HUD
    this.hud.update(this.player, this.enemy, this.score);
  }

  private spawnExplosion(x: number, y: number): void {
    const emitter = this.add.particles(x, y, 'particle_explosion', {
      speed: { min: 80, max: 350 },
      scale: { start: 1.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 1200 },
      quantity: 60,
      tint: [0xff3300, 0xff8800, 0xffcc00, 0xffffff],
      emitting: false,
    });
    emitter.setDepth(150);
    emitter.explode();

    // Screen shake for impact
    this.cameras.main.shake(400, 0.02);

    // Clean up after particles finish
    this.time.delayedCall(1500, () => emitter.destroy());
  }

  private endMatch(result: 'win' | 'lose', now: number): void {
    this.matchOver = true;

    // Victory/defeat jingle (delayed slightly so explosion plays first)
    this.time.delayedCall(600, () => {
      result === 'win' ? this.sound_sys.victory() : this.sound_sys.defeat();
    });

    // Scoring bonuses on win
    if (result === 'win') {
      const elapsedSec = Math.floor((now - this.matchStartTime) / 1000);
      const timeBonus = Math.max(0, 5000 - elapsedSec * 50);
      const winBonus = 1000;
      this.score += timeBonus + winBonus;
    }

    // Full-screen overlay
    const bannerBg = this.add.graphics();
    bannerBg.setDepth(199);

    if (result === 'lose') {
      // Dark overlay for Kip's face
      bannerBg.fillStyle(0x000000, 0.8);
      bannerBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Kip's face — large and menacing
      const kipFace = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'villain_kip');
      const kipScale = 280 / Math.max(kipFace.width, kipFace.height);
      kipFace.setScale(kipScale);
      kipFace.setDepth(200);
      kipFace.setAlpha(0);

      // Red border around Kip
      const kipBorder = this.add.graphics();
      kipBorder.setDepth(199);
      kipBorder.lineStyle(3, 0xff2200, 0.8);
      kipBorder.strokeRect(
        GAME_WIDTH / 2 - 145, GAME_HEIGHT / 2 - 60 - 145,
        290, 290
      );

      // Fade Kip in dramatically
      this.tweens.add({
        targets: kipFace,
        alpha: 1,
        scale: kipScale * 1.05,
        duration: 800,
        ease: 'Power2',
      });

      // Evil laugh after a beat
      this.time.delayedCall(400, () => {
        this.sound_sys.evilLaugh();
      });
    } else {
      bannerBg.fillStyle(0x000000, 0.7);
      bannerBg.fillRect(0, GAME_HEIGHT / 2 - 90, GAME_WIDTH, 180);
      const bannerColor = 0x00ff66;
      bannerBg.lineStyle(3, bannerColor, 1);
      bannerBg.lineBetween(0, GAME_HEIGHT / 2 - 90, GAME_WIDTH, GAME_HEIGHT / 2 - 90);
      bannerBg.lineBetween(0, GAME_HEIGHT / 2 + 90, GAME_WIDTH, GAME_HEIGHT / 2 + 90);
    }

    const headline = result === 'win'
      ? 'YOU WON!\nHUMANITY HAS BEEN SAVED!'
      : 'YOU LOST!\nTRY AGAIN LOSER!';

    const textY = result === 'lose' ? GAME_HEIGHT / 2 + 130 : GAME_HEIGHT / 2 - 30;
    this.add.text(GAME_WIDTH / 2, textY, headline, {
      fontSize: '28px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: result === 'win' ? '#00ff66' : '#ff4444',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(200);

    const subline = result === 'win'
      ? `SCORE: ${this.score.toLocaleString()}`
      : '';

    if (subline) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, subline, {
        fontSize: '20px',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        color: '#ffff00',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0.5).setDepth(200);
    }

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'Press ENTER for menu', {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(200);

    // Return to title on ENTER or tap
    const goToTitle = () => {
      this.weapons.clear();
      this.hud.destroy();
      this.touchControls.destroy();
      this.sound_sys.stopThrust();
      this.scene.start('Title');
    };
    this.input.keyboard!.once('keydown-ENTER', goToTitle);
    this.input.once('pointerdown', goToTitle);
  }
}
