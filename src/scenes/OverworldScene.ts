import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, SCALE, TILE_SIZE,
  PLAYER_SPEED, PLAYER_IFRAMES_MS, PLAYER_KNOCKBACK,
  KNOCKBACK_DURATION_MS, ATTACK_HITBOX_DURATION_MS,
  ENEMY_STATS, MIN_DAMAGE, PLAYER_ATTACK,
} from '../config';
import { GameState } from '../state/GameState';
import { Direction, directionToVector, vectorToDirection } from '../utils/Direction';
import { StateMachine } from '../utils/StateMachine';

type PlayerState = 'idle' | 'walk' | 'attack' | 'hurt';

export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private swordHitbox!: Phaser.Physics.Arcade.Sprite;

  private facing: Direction = Direction.DOWN;
  private stateMachine!: StateMachine<PlayerState>;
  private iframesUntil = 0;
  private attackTimer = 0;

  constructor() {
    super({ key: 'Overworld' });
  }

  create(): void {
    // ── Build a simple walled room (replace with Tiled map later) ──
    this.walls = this.physics.add.staticGroup();
    this.buildPlaceholderRoom();

    // ── Player ──
    const cx = (GAME_WIDTH * SCALE) / 2;
    const cy = (GAME_HEIGHT * SCALE) / 2;
    this.player = this.physics.add.sprite(cx, cy, 'player');
    this.player.setScale(SCALE);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);

    // ── Sword hitbox (hidden until attack) ──
    this.swordHitbox = this.physics.add.sprite(-100, -100, 'sword_hitbox');
    this.swordHitbox.setScale(SCALE);
    this.swordHitbox.setVisible(false);
    this.swordHitbox.body!.enable = false;

    // ── Enemies ──
    this.enemies = this.physics.add.group();
    this.spawnSlime(200, 200);
    this.spawnSlime(500, 400);

    // ── Collisions ──
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);

    // Player touches enemy → take damage
    this.physics.add.overlap(this.player, this.enemies, (_p, enemy) => {
      this.handlePlayerHit(enemy as Phaser.Physics.Arcade.Sprite);
    });

    // Sword hits enemy → deal damage
    this.physics.add.overlap(this.swordHitbox, this.enemies, (_s, enemy) => {
      this.handleEnemyHit(enemy as Phaser.Physics.Arcade.Sprite);
    });

    // ── Input ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.attackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ── Player state machine ──
    this.stateMachine = new StateMachine<PlayerState>('idle', {
      idle: {
        update: () => {
          if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.stateMachine.transition('attack');
            return;
          }
          if (this.getMovementVector().x !== 0 || this.getMovementVector().y !== 0) {
            this.stateMachine.transition('walk');
          }
        },
      },
      walk: {
        update: () => {
          if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.stateMachine.transition('attack');
            return;
          }
          const vel = this.getMovementVector();
          if (vel.x === 0 && vel.y === 0) {
            this.stateMachine.transition('idle');
            return;
          }
          this.player.setVelocity(vel.x * PLAYER_SPEED * SCALE, vel.y * PLAYER_SPEED * SCALE);
          this.facing = vectorToDirection(vel.x, vel.y);
        },
        exit: () => { this.player.setVelocity(0, 0); },
      },
      attack: {
        enter: () => {
          this.player.setVelocity(0, 0);
          this.attackTimer = ATTACK_HITBOX_DURATION_MS;
          this.activateSwordHitbox();
        },
        update: (dt: number) => {
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) {
            this.deactivateSwordHitbox();
            this.stateMachine.transition('idle');
          }
        },
        exit: () => { this.deactivateSwordHitbox(); },
      },
      hurt: {
        enter: () => {
          this.player.setTint(0xff0000);
          // Knockback away from facing (hit came from the front)
          const kb = directionToVector(this.facing);
          this.player.setVelocity(-kb.x * PLAYER_KNOCKBACK * SCALE, -kb.y * PLAYER_KNOCKBACK * SCALE);
          this.time.delayedCall(KNOCKBACK_DURATION_MS, () => {
            this.player.clearTint();
            this.player.setVelocity(0, 0);
            this.stateMachine.transition('idle');
          });
        },
      },
    });

    // ── Launch HUD overlay ──
    this.scene.launch('UI');
  }

  update(_time: number, delta: number): void {
    this.stateMachine.update(delta);
    this.updateEnemyAI(delta);

    // Blink during i-frames
    if (this.time.now < this.iframesUntil) {
      this.player.setAlpha(Math.sin(this.time.now * 0.02) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
    }
  }

  // ── Input ──

  private getMovementVector(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.cursors.left.isDown) x -= 1;
    if (this.cursors.right.isDown) x += 1;
    if (this.cursors.up.isDown) y -= 1;
    if (this.cursors.down.isDown) y += 1;
    // Normalize diagonal
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // ── Combat ──

  private activateSwordHitbox(): void {
    const offset = TILE_SIZE * SCALE;
    const dir = directionToVector(this.facing);
    this.swordHitbox.setPosition(
      this.player.x + dir.x * offset,
      this.player.y + dir.y * offset,
    );
    this.swordHitbox.setVisible(true);
    this.swordHitbox.body!.enable = true;
  }

  private deactivateSwordHitbox(): void {
    this.swordHitbox.setPosition(-100, -100);
    this.swordHitbox.setVisible(false);
    this.swordHitbox.body!.enable = false;
  }

  private handlePlayerHit(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (this.time.now < this.iframesUntil) return;
    if (this.stateMachine.state === 'hurt') return;

    const damage = GameState.takeDamage(ENEMY_STATS.slime.attack);
    this.iframesUntil = this.time.now + PLAYER_IFRAMES_MS;
    this.stateMachine.transition('hurt');

    // Emit event so UI scene updates hearts
    this.events.emit('player-damaged', damage);

    if (GameState.isPlayerDead) {
      // TODO: death scene
      console.log('Game Over!');
    }
  }

  private handleEnemyHit(enemy: Phaser.Physics.Arcade.Sprite): void {
    const data = enemy.getData('hp') as number;
    const newHp = data - Math.max(PLAYER_ATTACK - 0, MIN_DAMAGE);
    enemy.setData('hp', newHp);

    // Knockback
    const dir = directionToVector(this.facing);
    enemy.setVelocity(dir.x * PLAYER_KNOCKBACK * SCALE, dir.y * PLAYER_KNOCKBACK * SCALE);
    enemy.setTint(0xff0000);
    this.time.delayedCall(KNOCKBACK_DURATION_MS, () => {
      enemy.clearTint();
      enemy.setVelocity(0, 0);
    });

    if (newHp <= 0) {
      // Death effect — flash and destroy
      this.tweens.add({
        targets: enemy,
        alpha: 0,
        duration: 300,
        onComplete: () => enemy.destroy(),
      });
    }
  }

  // ── Enemy AI ──

  private updateEnemyAI(_delta: number): void {
    this.enemies.getChildren().forEach((obj) => {
      const enemy = obj as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) return;

      const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const chaseRange = 150 * SCALE;

      if (dist < chaseRange) {
        // Chase player
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const speed = ENEMY_STATS.slime.speed * SCALE;
        enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        // Idle wander (simple random movement)
        if (Math.random() < 0.01) {
          const angle = Math.random() * Math.PI * 2;
          const speed = ENEMY_STATS.slime.speed * SCALE * 0.5;
          enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
      }
    });
  }

  // ── Map Building (placeholder) ──

  private buildPlaceholderRoom(): void {
    const cols = Math.floor((GAME_WIDTH * SCALE) / (TILE_SIZE * SCALE));
    const rows = Math.floor((GAME_HEIGHT * SCALE) / (TILE_SIZE * SCALE));

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const isWall = col === 0 || col === cols - 1 || row === 0 || row === rows - 1;
        if (isWall) {
          const x = col * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2;
          const y = row * TILE_SIZE * SCALE + (TILE_SIZE * SCALE) / 2;
          const wall = this.walls.create(x, y, 'wall_tile') as Phaser.Physics.Arcade.Sprite;
          wall.setScale(SCALE);
          wall.refreshBody();
        }
      }
    }
  }

  private spawnSlime(x: number, y: number): void {
    const slime = this.enemies.create(x, y, 'slime') as Phaser.Physics.Arcade.Sprite;
    slime.setScale(SCALE);
    slime.setCollideWorldBounds(true);
    slime.setData('hp', ENEMY_STATS.slime.hp);
    slime.setData('type', 'slime');
    slime.body!.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
  }
}
