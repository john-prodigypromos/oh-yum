# Phase 1: Core Playable Combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the adventure game scaffold with a playable space arena dogfight — a ship you can fly with thrust/rotation physics, laser bolts you can fire, one enemy AI (Rusty) that shoots back, damage/shields/hull, and win/lose conditions.

**Architecture:** Complete rewrite of `src/`. Old adventure code is deleted. New code follows the spec's file structure. Ships use colored placeholder rectangles initially (canvas-rendered HD ships are Phase 2). Physics uses a fixed 60Hz timestep with time-based drag decay. Phaser Arcade Physics handles collision detection.

**Tech Stack:** Phaser 3.80 · TypeScript · Vite (port 3000)

**Spec:** `docs/superpowers/specs/2026-03-28-oh-yum-arena-design.md`

---

## File Map

All paths relative to project root. Every old file under `src/` will be deleted and replaced.

| File | Action | Responsibility |
|------|--------|---------------|
| `src/config.ts` | **Rewrite** | All game constants (physics, weapons, ship stats, dimensions) |
| `src/main.ts` | **Rewrite** | Phaser game config at 1280x720, scene registration |
| `src/state/GameState.ts` | **Rewrite** | Arena-specific state: score, ladder position, settings, save/load |
| `src/scenes/BootScene.ts` | **Rewrite** | Generate placeholder textures (colored shapes for ships, bolts, pickups) |
| `src/scenes/ArenaScene.ts` | **Create** | Core gameplay: spawn ships, run physics loop, handle input, manage combat |
| `src/entities/Ship.ts` | **Create** | Ship entity: hull, shield, velocity, rotation, thrust, i-frames |
| `src/entities/Bolt.ts` | **Create** | Laser bolt projectile: speed, damage, lifetime, owner tracking |
| `src/systems/PhysicsSystem.ts` | **Create** | Fixed-timestep physics: thrust, rotation, drag, velocity cap, wall bounce |
| `src/systems/WeaponSystem.ts` | **Create** | Fire rate limiting, bolt spawning, bolt cleanup |
| `src/systems/DamageSystem.ts` | **Create** | Shield-first damage pipeline, i-frames, knockback, death detection |
| `src/systems/HUDSystem.ts` | **Create** | Deflector/hull bars, target info, weapon status (drawn with Phaser graphics) |
| `src/ai/AIBehavior.ts` | **Create** | Base AI interface: `update(ship, target, delta)` |
| `src/ai/behaviors/RustyBehavior.ts` | **Create** | Simplest AI: slow chase, infrequent firing, poor aim |
| `src/utils/math.ts` | **Create** | clamp, lerp, angleDiff, normalizeAngle |
| `src/utils/StateMachine.ts` | **Keep** | Reusable, no changes needed |

**Files to delete:** `src/scenes/OverworldScene.ts`, `src/scenes/UIScene.ts`, `src/utils/Direction.ts` (replaced by angle-based rotation)

---

## Task 1: Clean Slate — Delete Old Code, Rewrite Config & Main

**Files:**
- Rewrite: `src/config.ts`
- Rewrite: `src/main.ts`
- Delete: `src/scenes/OverworldScene.ts`, `src/scenes/UIScene.ts`, `src/utils/Direction.ts`

- [ ] **Step 1: Delete old adventure files**

```bash
rm src/scenes/OverworldScene.ts src/scenes/UIScene.ts src/utils/Direction.ts
```

- [ ] **Step 2: Rewrite `src/config.ts`**

```ts
// ── OH-YUM Arena — Game Constants ────────────────────────
// All tunable values in one place. Never hardcode in game logic.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PHYSICS = {
  FIXED_TIMESTEP: 1000 / 60,       // 60Hz physics, frame-rate independent
  THRUST: 300,                       // pixels/sec² acceleration
  ROTATION_SPEED: Math.PI,          // radians/sec (~180°/sec)
  DRAG_HALF_LIFE: 1.5,             // seconds — velocity halves every 1.5s
  MAX_VELOCITY: 400,                // pixels/sec cap
  WALL_BOUNCE_FACTOR: 0.6,
  WALL_DAMAGE: 2,
  COLLISION_DAMAGE_MULTIPLIER: 0.1,
} as const;

export const WEAPONS = {
  BLASTER_FIRE_RATE: 150,           // ms between volleys
  BLASTER_BOLT_SPEED: 600,          // pixels/sec
  BLASTER_DAMAGE: 5,
  BLASTER_BOLT_LIFETIME: 2000,      // ms before bolt despawns
  BLASTER_SPREAD: 8,                // px offset for parallel twin bolts
} as const;

export const SHIP = {
  PLAYER_HULL: 100,
  PLAYER_SHIELD: 50,
  SHIELD_REGEN_DELAY: 5000,         // ms before regen starts
  SHIELD_REGEN_RATE: 2,             // per second
  IFRAMES: 500,                      // ms invincibility after hit
  KNOCKBACK_FORCE: 200,             // pixels/sec impulse on hit
  HITBOX_RADIUS: 20,                // px, circular hitbox for collision
} as const;

export const AI = {
  RUSTY_HULL: 60,
  RUSTY_SHIELD: 0,
  RUSTY_SPEED_MULT: 0.5,
  RUSTY_ROTATION_MULT: 0.5,
  RUSTY_AIM_ACCURACY: 0.2,         // 20% chance to lead shots correctly
  RUSTY_FIRE_RATE: 800,            // ms between shots (slow)
  RUSTY_CHASE_RANGE: 500,          // px — how close before chasing
} as const;

// Placeholder colors (used until canvas-rendered ships in Phase 2)
export const COLORS = {
  player: 0x88aacc,       // blue-grey
  enemy: 0xcc4444,        // red
  playerBolt: 0xff3322,   // red laser
  enemyBolt: 0x22cc44,    // green laser
  pickup: 0xffaa22,       // amber
  shield: 0x3399dd,       // blue
  hull: 0xccbb88,         // tan
  arena: 0x0a1220,        // dark blue-black
  wall: 0x334455,         // border hint
} as const;
```

- [ ] **Step 3: Rewrite `src/main.ts`**

```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { ArenaScene } from './scenes/ArenaScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a1220',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: true,
    },
  },
  scene: [BootScene, ArenaScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
```

- [ ] **Step 4: Create stub `src/scenes/ArenaScene.ts`**

```ts
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
```

- [ ] **Step 5: Rewrite `src/scenes/BootScene.ts` to launch Arena**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    this.scene.start('Arena');
  }
}
```

- [ ] **Step 6: Verify it compiles and runs**

Run: `cd "/Users/johnpriday/Claude Local/OH-YUM-GAME" && npx tsc --noEmit`
Expected: No errors. Then open browser at http://localhost:3000 — should see "OH-YUM ARENA" text centered on dark background.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: clean slate — rewrite scaffold for OH-YUM Arena dogfight"
```

---

## Task 2: Math Utilities

**Files:**
- Rewrite: `src/utils/math.ts`

- [ ] **Step 1: Write `src/utils/math.ts`**

```ts
/** Clamp value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest signed angle difference between two angles (radians) */
export function angleDiff(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Normalize angle to [-PI, PI] */
export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Calculate drag multiplier per frame from half-life */
export function dragPerStep(halfLife: number, dt: number): number {
  return Math.pow(0.5, dt / halfLife);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/math.ts && git commit -m "feat: add math utilities (clamp, lerp, angleDiff, drag)"
```

---

## Task 3: Ship Entity

**Files:**
- Create: `src/entities/Ship.ts`

- [ ] **Step 1: Write `src/entities/Ship.ts`**

```ts
import Phaser from 'phaser';
import { SHIP } from '../config';

export interface ShipConfig {
  hull: number;
  shield: number;
  speedMult: number;
  rotationMult: number;
  textureKey: string;
  hitboxRadius: number;
}

export class Ship {
  sprite: Phaser.Physics.Arcade.Sprite;
  hull: number;
  maxHull: number;
  shield: number;
  maxShield: number;
  speedMult: number;
  rotationMult: number;
  rotation: number;          // radians, the facing angle
  velocityX: number;
  velocityY: number;
  iframesUntil: number;
  lastDamageTime: number;
  alive: boolean;
  lastFireTime: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ShipConfig) {
    this.sprite = scene.physics.add.sprite(x, y, config.textureKey);
    this.sprite.setCircle(config.hitboxRadius);
    this.sprite.setOffset(
      this.sprite.width / 2 - config.hitboxRadius,
      this.sprite.height / 2 - config.hitboxRadius,
    );

    this.hull = config.hull;
    this.maxHull = config.hull;
    this.shield = config.shield;
    this.maxShield = config.shield;
    this.speedMult = config.speedMult;
    this.rotationMult = config.rotationMult;
    this.rotation = -Math.PI / 2; // facing up
    this.velocityX = 0;
    this.velocityY = 0;
    this.iframesUntil = 0;
    this.lastDamageTime = 0;
    this.alive = true;
    this.lastFireTime = 0;
  }

  get isInvincible(): boolean {
    return Date.now() < this.iframesUntil;
  }

  applyDamage(amount: number, pierceShield: boolean, time: number): number {
    if (!this.alive) return 0;

    let remaining = amount;

    if (!pierceShield && this.shield > 0) {
      const shieldAbsorb = Math.min(this.shield, remaining);
      this.shield -= shieldAbsorb;
      remaining -= shieldAbsorb;
    }

    if (remaining > 0) {
      this.hull = Math.max(0, this.hull - remaining);
    }

    this.lastDamageTime = time;

    if (this.hull <= 0) {
      this.alive = false;
    }

    return amount;
  }

  updateShieldRegen(time: number): void {
    if (this.shield >= this.maxShield) return;
    if (this.maxShield === 0) return;
    if (time - this.lastDamageTime < SHIP.SHIELD_REGEN_DELAY) return;

    this.shield = Math.min(
      this.maxShield,
      this.shield + SHIP.SHIELD_REGEN_RATE / 60, // per-step at 60Hz
    );
  }

  syncSpritePosition(): void {
    this.sprite.setPosition(this.sprite.x, this.sprite.y);
    this.sprite.setRotation(this.rotation + Math.PI / 2); // Phaser 0 = right, we use 0 = up
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entities/Ship.ts && git commit -m "feat: add Ship entity with hull/shield/damage model"
```

---

## Task 4: Physics System

**Files:**
- Create: `src/systems/PhysicsSystem.ts`

- [ ] **Step 1: Write `src/systems/PhysicsSystem.ts`**

```ts
import { Ship } from '../entities/Ship';
import { PHYSICS, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { clamp, dragPerStep } from '../utils/math';

export class PhysicsSystem {
  private accumulator = 0;
  private readonly dt = PHYSICS.FIXED_TIMESTEP / 1000; // seconds per step

  update(delta: number, ships: Ship[]): void {
    this.accumulator += delta;

    while (this.accumulator >= PHYSICS.FIXED_TIMESTEP) {
      this.accumulator -= PHYSICS.FIXED_TIMESTEP;

      for (const ship of ships) {
        if (!ship.alive) continue;
        this.stepShip(ship);
      }
    }
  }

  private stepShip(ship: Ship): void {
    // Apply drag (time-based exponential decay)
    const drag = dragPerStep(PHYSICS.DRAG_HALF_LIFE, this.dt);
    ship.velocityX *= drag;
    ship.velocityY *= drag;

    // Clamp velocity
    const speed = Math.sqrt(ship.velocityX ** 2 + ship.velocityY ** 2);
    const maxSpeed = PHYSICS.MAX_VELOCITY * ship.speedMult;
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      ship.velocityX *= scale;
      ship.velocityY *= scale;
    }

    // Move
    const newX = ship.sprite.x + ship.velocityX * this.dt;
    const newY = ship.sprite.y + ship.velocityY * this.dt;

    // Wall bounce
    const r = ship.sprite.width / 2;
    let finalX = newX;
    let finalY = newY;

    if (newX - r < 0) {
      finalX = r;
      ship.velocityX = Math.abs(ship.velocityX) * PHYSICS.WALL_BOUNCE_FACTOR;
    } else if (newX + r > GAME_WIDTH) {
      finalX = GAME_WIDTH - r;
      ship.velocityX = -Math.abs(ship.velocityX) * PHYSICS.WALL_BOUNCE_FACTOR;
    }

    if (newY - r < 0) {
      finalY = r;
      ship.velocityY = Math.abs(ship.velocityY) * PHYSICS.WALL_BOUNCE_FACTOR;
    } else if (newY + r > GAME_HEIGHT) {
      finalY = GAME_HEIGHT - r;
      ship.velocityY = -Math.abs(ship.velocityY) * PHYSICS.WALL_BOUNCE_FACTOR;
    }

    ship.sprite.setPosition(finalX, finalY);
    ship.sprite.setRotation(ship.rotation + Math.PI / 2);
  }

  applyThrust(ship: Ship, amount: number): void {
    const thrust = PHYSICS.THRUST * ship.speedMult * amount;
    ship.velocityX += Math.cos(ship.rotation) * thrust * this.dt;
    ship.velocityY += Math.sin(ship.rotation) * thrust * this.dt;
  }

  applyRotation(ship: Ship, direction: number): void {
    const rotSpeed = PHYSICS.ROTATION_SPEED * ship.rotationMult;
    ship.rotation += rotSpeed * direction * this.dt;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/PhysicsSystem.ts && git commit -m "feat: add fixed-timestep physics with drag, thrust, wall bounce"
```

---

## Task 5: Bolt Entity & Weapon System

**Files:**
- Create: `src/entities/Bolt.ts`
- Create: `src/systems/WeaponSystem.ts`

- [ ] **Step 1: Write `src/entities/Bolt.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/systems/WeaponSystem.ts`**

```ts
import Phaser from 'phaser';
import { Bolt } from '../entities/Bolt';
import { Ship } from '../entities/Ship';
import { WEAPONS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class WeaponSystem {
  private bolts: Bolt[] = [];

  fireBlaster(scene: Phaser.Scene, ship: Ship, owner: 'player' | 'enemy'): boolean {
    const now = Date.now();
    const fireRate = owner === 'player' ? WEAPONS.BLASTER_FIRE_RATE : WEAPONS.BLASTER_FIRE_RATE;
    if (now - ship.lastFireTime < fireRate) return false;

    ship.lastFireTime = now;
    const textureKey = owner === 'player' ? 'bolt_player' : 'bolt_enemy';

    // Twin parallel bolts (offset perpendicular to facing direction)
    const perpAngle = ship.rotation + Math.PI / 2;
    const offsetX = Math.cos(perpAngle) * WEAPONS.BLASTER_SPREAD / 2;
    const offsetY = Math.sin(perpAngle) * WEAPONS.BLASTER_SPREAD / 2;

    const noseOffset = 25; // spawn bolts ahead of ship center
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
```

- [ ] **Step 3: Commit**

```bash
git add src/entities/Bolt.ts src/systems/WeaponSystem.ts && git commit -m "feat: add bolt entity and weapon system with twin blaster"
```

---

## Task 6: Damage System

**Files:**
- Create: `src/systems/DamageSystem.ts`

- [ ] **Step 1: Write `src/systems/DamageSystem.ts`**

```ts
import { Ship } from '../entities/Ship';
import { Bolt } from '../entities/Bolt';
import { SHIP, PHYSICS } from '../config';

export class DamageSystem {
  /** Check bolt hits against a target ship. Returns bolts that hit. */
  checkBoltHits(bolts: Bolt[], target: Ship, owner: 'player' | 'enemy'): Bolt[] {
    if (!target.alive || target.isInvincible) return [];

    const hits: Bolt[] = [];
    const hitRadius = SHIP.HITBOX_RADIUS;

    for (const bolt of bolts) {
      if (!bolt.alive) continue;
      if (bolt.owner === owner) continue; // friendly fire check — skip if same owner as target

      // Wait, we need opposite logic: bolt.owner should NOT match the target's side
      // Actually: if bolt.owner === 'player', it should hit 'enemy' targets
      // The caller passes the target's owner, so skip if bolt.owner === owner (same side)

      const dx = bolt.sprite.x - target.sprite.x;
      const dy = bolt.sprite.y - target.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius + 4) { // 4px bolt radius
        hits.push(bolt);
      }
    }

    return hits;
  }

  applyBoltDamage(target: Ship, bolt: Bolt, time: number): void {
    if (target.isInvincible) return;

    target.applyDamage(bolt.damage, false, time);
    target.iframesUntil = time + SHIP.IFRAMES;

    // Knockback in bolt's travel direction
    const angle = bolt.sprite.rotation - Math.PI / 2;
    target.velocityX += Math.cos(angle) * SHIP.KNOCKBACK_FORCE;
    target.velocityY += Math.sin(angle) * SHIP.KNOCKBACK_FORCE;
  }

  checkShipCollision(a: Ship, b: Ship, time: number): boolean {
    if (!a.alive || !b.alive) return false;

    const dx = a.sprite.x - b.sprite.x;
    const dy = a.sprite.y - b.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = SHIP.HITBOX_RADIUS * 2;

    if (dist >= minDist) return false;

    // Relative velocity for damage calc
    const relVx = a.velocityX - b.velocityX;
    const relVy = a.velocityY - b.velocityY;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
    const damage = Math.max(1, Math.floor(relSpeed * PHYSICS.COLLISION_DAMAGE_MULTIPLIER));

    if (!a.isInvincible) {
      a.applyDamage(damage, false, time);
      a.iframesUntil = time + SHIP.IFRAMES;
    }
    if (!b.isInvincible) {
      b.applyDamage(damage, false, time);
      b.iframesUntil = time + SHIP.IFRAMES;
    }

    // Push apart
    const overlap = minDist - dist;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    a.sprite.x += nx * overlap / 2;
    a.sprite.y += ny * overlap / 2;
    b.sprite.x -= nx * overlap / 2;
    b.sprite.y -= ny * overlap / 2;

    // Bounce velocities
    a.velocityX += nx * SHIP.KNOCKBACK_FORCE;
    a.velocityY += ny * SHIP.KNOCKBACK_FORCE;
    b.velocityX -= nx * SHIP.KNOCKBACK_FORCE;
    b.velocityY -= ny * SHIP.KNOCKBACK_FORCE;

    return true;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/DamageSystem.ts && git commit -m "feat: add damage system with shield pipeline, bolt hits, ship collision"
```

---

## Task 7: Rusty AI Behavior

**Files:**
- Create: `src/ai/AIBehavior.ts`
- Create: `src/ai/behaviors/RustyBehavior.ts`

- [ ] **Step 1: Write `src/ai/AIBehavior.ts`**

```ts
import Phaser from 'phaser';
import { Ship } from '../entities/Ship';
import { WeaponSystem } from '../systems/WeaponSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';

export interface AIBehavior {
  update(
    ship: Ship,
    target: Ship,
    delta: number,
    scene: Phaser.Scene,
    weapons: WeaponSystem,
    physics: PhysicsSystem,
  ): void;
}
```

- [ ] **Step 2: Write `src/ai/behaviors/RustyBehavior.ts`**

```ts
import Phaser from 'phaser';
import { AIBehavior } from '../AIBehavior';
import { Ship } from '../../entities/Ship';
import { WeaponSystem } from '../../systems/WeaponSystem';
import { PhysicsSystem } from '../../systems/PhysicsSystem';
import { AI } from '../../config';
import { angleDiff } from '../../utils/math';

/**
 * Rusty — the easiest opponent.
 * Slowly rotates toward player, thrusts when roughly facing them,
 * fires infrequently with poor aim.
 */
export class RustyBehavior implements AIBehavior {
  update(
    ship: Ship,
    target: Ship,
    _delta: number,
    scene: Phaser.Scene,
    weapons: WeaponSystem,
    physics: PhysicsSystem,
  ): void {
    if (!ship.alive || !target.alive) return;

    const dx = target.sprite.x - ship.sprite.x;
    const dy = target.sprite.y - ship.sprite.y;
    const angleToTarget = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Rotate toward player (slowly)
    const diff = angleDiff(ship.rotation, angleToTarget);
    if (Math.abs(diff) > 0.05) {
      physics.applyRotation(ship, Math.sign(diff));
    }

    // Thrust when roughly facing player and within chase range
    if (Math.abs(diff) < 0.5 && dist > 100) {
      physics.applyThrust(ship, 1);
    }

    // Fire when facing player (with poor accuracy — add random angle error)
    if (Math.abs(diff) < 0.3 && dist < AI.RUSTY_CHASE_RANGE) {
      // Override fire rate for Rusty
      const now = Date.now();
      if (now - ship.lastFireTime >= AI.RUSTY_FIRE_RATE) {
        ship.lastFireTime = now;

        // Poor aim: only lead shots 20% of the time
        // For now, just fire straight ahead (leading is a Phase 2 AI improvement)
        weapons.fireBlaster(scene, ship, 'enemy');
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ai/AIBehavior.ts src/ai/behaviors/RustyBehavior.ts && git commit -m "feat: add AI behavior interface and Rusty (simplest opponent)"
```

---

## Task 8: HUD System

**Files:**
- Create: `src/systems/HUDSystem.ts`

- [ ] **Step 1: Write `src/systems/HUDSystem.ts`**

```ts
import Phaser from 'phaser';
import { Ship } from '../entities/Ship';
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';

export class HUDSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private targetText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(100);

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '11px',
      fontFamily: '"Courier New", monospace',
      color: '#88aacc',
    };

    this.targetText = scene.add.text(GAME_WIDTH - 20, 20, '', {
      ...textStyle, color: '#ff6644', align: 'right',
    }).setOrigin(1, 0).setDepth(100);

    this.weaponText = scene.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 30, 'OH-YUM BLASTER', {
      ...textStyle, color: '#44ccaa',
    }).setOrigin(1, 0.5).setDepth(100);

    this.scoreText = scene.add.text(20, GAME_HEIGHT - 30, 'SCORE: 0', {
      ...textStyle, color: '#ccbb88',
    }).setOrigin(0, 0.5).setDepth(100);
  }

  update(player: Ship, enemy: Ship, score: number): void {
    this.graphics.clear();

    // ── Player shield bar ──
    this.drawBar(20, 20, 160, 5, player.shield / player.maxShield, COLORS.shield, 'DEFLECTOR');
    // ── Player hull bar ──
    this.drawBar(20, 42, 160, 5, player.hull / player.maxHull, COLORS.hull, 'HULL');

    // ── Target info ──
    if (enemy.alive) {
      const hullPct = Math.round((enemy.hull / enemy.maxHull) * 100);
      this.targetText.setText(`TGT: RUSTY\nHULL: ${hullPct}%`);
      this.targetText.setAlpha(0.6);
    } else {
      this.targetText.setText('TGT: DESTROYED');
      this.targetText.setAlpha(0.4);
    }

    // ── Score ──
    this.scoreText.setText(`SCORE: ${score.toLocaleString()}`);

    // ── Targeting brackets around enemy ──
    if (enemy.alive) {
      this.drawTargetBrackets(enemy.sprite.x, enemy.sprite.y, 40);
    }
  }

  private drawBar(x: number, y: number, w: number, h: number, pct: number, color: number, label: string): void {
    // Label
    this.graphics.fillStyle(color, 0.5);
    // Background
    this.graphics.fillStyle(color, 0.06);
    this.graphics.fillRect(x, y + 14, w, h);
    this.graphics.lineStyle(0.5, color, 0.15);
    this.graphics.strokeRect(x, y + 14, w, h);
    // Fill
    this.graphics.fillStyle(color, 0.8);
    this.graphics.fillRect(x + 0.5, y + 14.5, w * Math.max(0, pct) - 1, h - 1);

    // Label text (drawn as graphics text would be expensive — use simple approach)
    // We'll use the graphics to draw a small label area
    this.graphics.fillStyle(color, 0.4);
    // Using a simple rectangle as label indicator for now
  }

  private drawTargetBrackets(cx: number, cy: number, size: number): void {
    const s = size;
    const c = s * 0.35;
    this.graphics.lineStyle(1.2, 0xff6644, 0.35);

    // Corner brackets
    const corners = [
      [-s, -s, c, 0, 0, c],
      [s, -s, -c, 0, 0, c],
      [-s, s, c, 0, 0, -c],
      [s, s, -c, 0, 0, -c],
    ];
    for (const [ox, oy, dx1, dy1, dx2, dy2] of corners) {
      this.graphics.beginPath();
      this.graphics.moveTo(cx + ox + dx1, cy + oy + dy1);
      this.graphics.lineTo(cx + ox, cy + oy);
      this.graphics.lineTo(cx + ox + dx2, cy + oy + dy2);
      this.graphics.strokePath();
    }
  }

  destroy(): void {
    this.graphics.destroy();
    this.targetText.destroy();
    this.weaponText.destroy();
    this.scoreText.destroy();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/systems/HUDSystem.ts && git commit -m "feat: add HUD system with shield/hull bars, target info, brackets"
```

---

## Task 9: Rewrite GameState for Arena

**Files:**
- Rewrite: `src/state/GameState.ts`

- [ ] **Step 1: Rewrite `src/state/GameState.ts`**

```ts
export interface ArenaState {
  currentOpponent: number;
  score: number;
  highScores: number[];
  ladderDefeated: boolean[];
  cybertruckUnlocked: boolean;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    screenShake: boolean;
  };
}

const DEFAULT_STATE: ArenaState = {
  currentOpponent: 0,
  score: 0,
  highScores: new Array(16).fill(0),
  ladderDefeated: new Array(16).fill(false),
  cybertruckUnlocked: false,
  settings: {
    sfxVolume: 0.7,
    musicVolume: 0.5,
    screenShake: true,
  },
};

class GameStateManager {
  private data: ArenaState;

  constructor() {
    this.data = structuredClone(DEFAULT_STATE);
  }

  get state(): ArenaState { return this.data; }

  get currentOpponent(): number { return this.data.currentOpponent; }
  get score(): number { return this.data.score; }

  addScore(points: number): void {
    this.data.score += points;
  }

  recordVictory(opponentIndex: number, matchScore: number): void {
    this.data.ladderDefeated[opponentIndex] = true;
    if (matchScore > this.data.highScores[opponentIndex]) {
      this.data.highScores[opponentIndex] = matchScore;
    }
    if (opponentIndex < 15) {
      this.data.currentOpponent = opponentIndex + 1;
    }
    if (opponentIndex === 15) {
      this.data.cybertruckUnlocked = true;
    }
  }

  save(): void {
    localStorage.setItem('ohyum_arena_save', JSON.stringify(this.data));
  }

  load(): boolean {
    const raw = localStorage.getItem('ohyum_arena_save');
    if (!raw) return false;
    try {
      this.data = JSON.parse(raw) as ArenaState;
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.data = structuredClone(DEFAULT_STATE);
  }
}

export const GameState = new GameStateManager();
```

- [ ] **Step 2: Commit**

```bash
git add src/state/GameState.ts && git commit -m "feat: rewrite GameState for arena ladder progression"
```

---

## Task 10: Wire It All Together — BootScene + ArenaScene

**Files:**
- Rewrite: `src/scenes/BootScene.ts`
- Rewrite: `src/scenes/ArenaScene.ts`

- [ ] **Step 1: Rewrite `src/scenes/BootScene.ts` with placeholder textures**

```ts
import Phaser from 'phaser';
import { COLORS, SHIP } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create(): void {
    // Player ship placeholder — triangle pointing up
    this.generateTriangle('ship_player', 40, 50, COLORS.player);
    // Enemy ship placeholder
    this.generateTriangle('ship_enemy', 36, 44, COLORS.enemy);
    // Bolts
    this.generateRect('bolt_player', 3, 14, COLORS.playerBolt);
    this.generateRect('bolt_enemy', 3, 14, COLORS.enemyBolt);

    this.scene.start('Arena');
  }

  private generateTriangle(key: string, w: number, h: number, color: number): void {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(color, 1);
    gfx.fillTriangle(w / 2, 0, 0, h, w, h);
    // Outline
    gfx.lineStyle(1, 0xffffff, 0.15);
    gfx.strokeTriangle(w / 2, 0, 0, h, w, h);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }

  private generateRect(key: string, w: number, h: number, color: number): void {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, w, h);
    gfx.generateTexture(key, w, h);
    gfx.destroy();
  }
}
```

- [ ] **Step 2: Write full `src/scenes/ArenaScene.ts`**

```ts
import Phaser from 'phaser';
import { Ship, ShipConfig } from '../entities/Ship';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { WeaponSystem } from '../systems/WeaponSystem';
import { DamageSystem } from '../systems/DamageSystem';
import { HUDSystem } from '../systems/HUDSystem';
import { RustyBehavior } from '../ai/behaviors/RustyBehavior';
import { AIBehavior } from '../ai/AIBehavior';
import { GAME_WIDTH, GAME_HEIGHT, SHIP, AI, COLORS } from '../config';

export class ArenaScene extends Phaser.Scene {
  private player!: Ship;
  private enemy!: Ship;
  private physics!: PhysicsSystem;
  private weapons!: WeaponSystem;
  private damage!: DamageSystem;
  private hud!: HUDSystem;
  private aiBehavior!: AIBehavior;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private wasd!: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key };

  private score = 0;
  private matchOver = false;
  private matchResult: 'win' | 'lose' | null = null;
  private resultText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'Arena' });
  }

  create(): void {
    // ── Arena background ──
    this.cameras.main.setBackgroundColor(COLORS.arena);
    // Border hint
    const border = this.add.graphics();
    border.lineStyle(1, COLORS.wall, 0.15);
    border.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);

    // ── Systems ──
    this.physics = new PhysicsSystem();
    this.weapons = new WeaponSystem();
    this.damage = new DamageSystem();

    // ── Player ship ──
    const playerConfig: ShipConfig = {
      hull: SHIP.PLAYER_HULL,
      shield: SHIP.PLAYER_SHIELD,
      speedMult: 1,
      rotationMult: 1,
      textureKey: 'ship_player',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.player = new Ship(this, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.7, playerConfig);
    this.player.rotation = -Math.PI / 2; // face up

    // ── Enemy ship (Rusty) ──
    const enemyConfig: ShipConfig = {
      hull: AI.RUSTY_HULL,
      shield: AI.RUSTY_SHIELD,
      speedMult: AI.RUSTY_SPEED_MULT,
      rotationMult: AI.RUSTY_ROTATION_MULT,
      textureKey: 'ship_enemy',
      hitboxRadius: SHIP.HITBOX_RADIUS,
    };
    this.enemy = new Ship(this, GAME_WIDTH * 0.7, GAME_HEIGHT * 0.3, enemyConfig);
    this.enemy.rotation = Math.PI / 2; // face down

    // ── AI ──
    this.aiBehavior = new RustyBehavior();

    // ── HUD ──
    this.hud = new HUDSystem(this);

    // ── Input ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.wasd = {
      w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.matchOver = false;
    this.matchResult = null;
  }

  update(_time: number, delta: number): void {
    if (this.matchOver) return;

    const now = Date.now();
    const ships = [this.player, this.enemy];

    // ── Player input ──
    if (this.cursors.left.isDown || this.wasd.a.isDown) {
      this.physics.applyRotation(this.player, -1);
    }
    if (this.cursors.right.isDown || this.wasd.d.isDown) {
      this.physics.applyRotation(this.player, 1);
    }
    if (this.cursors.up.isDown || this.wasd.w.isDown) {
      this.physics.applyThrust(this.player, 1);
    }
    if (this.fireKey.isDown) {
      this.weapons.fireBlaster(this, this.player, 'player');
    }

    // ── AI ──
    this.aiBehavior.update(this.enemy, this.player, delta, this, this.weapons, this.physics);

    // ── Physics ──
    this.physics.update(delta, ships);

    // ── Bolt updates ──
    this.weapons.update();

    // ── Damage: bolts vs ships ──
    const bolts = this.weapons.getBolts();

    // Player bolts hitting enemy
    const enemyHits = this.damage.checkBoltHits(bolts, this.enemy, 'enemy');
    for (const bolt of enemyHits) {
      this.damage.applyBoltDamage(this.enemy, bolt, now);
      this.score += 10; // damage points
      bolt.destroy();
    }

    // Enemy bolts hitting player
    const playerHits = this.damage.checkBoltHits(bolts, this.player, 'player');
    for (const bolt of playerHits) {
      this.damage.applyBoltDamage(this.player, bolt, now);
      bolt.destroy();
    }

    // ── Ship-to-ship collision ──
    this.damage.checkShipCollision(this.player, this.enemy, now);

    // ── Shield regen ──
    this.player.updateShieldRegen(now);
    this.enemy.updateShieldRegen(now);

    // ── I-frame flicker ──
    this.player.sprite.setAlpha(this.player.isInvincible ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);
    this.enemy.sprite.setAlpha(this.enemy.isInvincible ? (Math.sin(now * 0.02) > 0 ? 1 : 0.3) : 1);

    // ── Win/Lose check ──
    if (!this.enemy.alive) {
      this.endMatch('win');
    } else if (!this.player.alive) {
      this.endMatch('lose');
    }

    // ── HUD ──
    this.hud.update(this.player, this.enemy, this.score);
  }

  private endMatch(result: 'win' | 'lose'): void {
    this.matchOver = true;
    this.matchResult = result;

    const msg = result === 'win'
      ? 'OPPONENT DESTROYED\nPress ENTER to continue'
      : 'SHIP DESTROYED\nPress ENTER to retry';

    this.resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, msg, {
      fontSize: '28px',
      fontFamily: '"Courier New", monospace',
      color: result === 'win' ? '#44ccaa' : '#ff6644',
      align: 'center',
    }).setOrigin(0.5).setDepth(200);

    // Listen for restart
    this.input.keyboard!.once('keydown-ENTER', () => {
      this.weapons.clear();
      this.hud.destroy();
      this.scene.restart();
    });
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "/Users/johnpriday/Claude Local/OH-YUM-GAME" && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Test in browser**

Open http://localhost:3000. Expected:
- Dark arena with faint border
- Blue-grey triangle (player) in lower-left area
- Red triangle (enemy, Rusty) in upper-right area
- Arrow keys / WASD rotate and thrust the player ship
- Space fires red bolts in facing direction
- Rusty slowly chases and fires green bolts
- Bolts hitting ships reduce shield → hull (visible in HUD bars)
- Destroying Rusty shows "OPPONENT DESTROYED" message
- Getting destroyed shows "SHIP DESTROYED" message
- ENTER restarts the match

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wire up ArenaScene — playable combat with Rusty AI opponent"
```

---

## Task 11: Starfield Background

**Files:**
- Create: `src/ui/Starfield.ts`
- Modify: `src/scenes/ArenaScene.ts`

- [ ] **Step 1: Write `src/ui/Starfield.ts`**

```ts
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/** Renders a static starfield to a texture once, used as arena background */
export function createStarfieldTexture(scene: Phaser.Scene, key: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background gradient
  const bg = ctx.createRadialGradient(GAME_WIDTH * 0.4, GAME_HEIGHT * 0.45, 0, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.5, GAME_WIDTH * 0.7);
  bg.addColorStop(0, '#0c1828');
  bg.addColorStop(0.5, '#070e1a');
  bg.addColorStop(1, '#020508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Subtle nebula
  const neb = ctx.createRadialGradient(GAME_WIDTH * 0.3, GAME_HEIGHT * 0.5, 0, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.5, GAME_WIDTH * 0.3);
  neb.addColorStop(0, 'rgba(20,40,80,0.12)');
  neb.addColorStop(1, 'transparent');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Stars (seeded for consistency)
  let seed = 42;
  function rng() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  for (let i = 0; i < 500; i++) {
    const x = rng() * GAME_WIDTH;
    const y = rng() * GAME_HEIGHT;
    const size = i < 400 ? 0.3 + rng() * 0.6 : 0.8 + rng() * 1.2;
    const brightness = i < 400 ? 0.1 + rng() * 0.3 : 0.4 + rng() * 0.6;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,230,255,${brightness})`;
    ctx.fill();

    // Glow on bright stars
    if (size > 1.2) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
      glow.addColorStop(0, `rgba(200,220,255,${brightness * 0.15})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
    }
  }

  // Add to Phaser textures
  scene.textures.addCanvas(key, canvas);
}
```

- [ ] **Step 2: Add starfield to ArenaScene**

In `src/scenes/ArenaScene.ts`, in the `create()` method, before the border drawing, add:

```ts
import { createStarfieldTexture } from '../ui/Starfield';

// At the start of create():
createStarfieldTexture(this, 'starfield');
this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'starfield');
```

- [ ] **Step 3: Test in browser**

Expected: Dark space background with stars and subtle nebula instead of flat color.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Starfield.ts src/scenes/ArenaScene.ts && git commit -m "feat: add procedural starfield background"
```

---

## Completion

After all 11 tasks, we have:
- **Playable arena combat** — fly with thrust/rotation, fire twin laser bolts
- **Rusty AI opponent** — chases, fires back, can be destroyed
- **Damage pipeline** — shields absorb first, overflow to hull, i-frames, knockback
- **Win/lose flow** — destroy Rusty to win, get destroyed to lose, ENTER restarts
- **HUD** — shield/hull bars, target info, targeting brackets, score, weapon name
- **Starfield background** — procedural, space-themed

**What comes next (separate plans):**
- Phase 2: Canvas-rendered HD ships (replacing triangle placeholders)
- Phase 3: Pickup system, remaining weapons (missiles, scatter, plasma, bomb)
- Phase 4: Full 16-opponent ladder, hangar screen, all AI behaviors
- Phase 5: Title screen, Cybertruck victory scene, audio, polish
