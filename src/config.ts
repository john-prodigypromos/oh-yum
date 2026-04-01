// ── OH-YUM Arena — Game Constants ────────────────────────
// All tunable values in one place. Never hardcode in game logic.

export let GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PHYSICS = {
  FIXED_TIMESTEP: 1000 / 60,
  THRUST: 300,
  ROTATION_SPEED: Math.PI,
  DRAG_HALF_LIFE: 1.5,
  MAX_VELOCITY: 400,
  WALL_BOUNCE_FACTOR: 0.6,
  WALL_DAMAGE: 2,
  COLLISION_DAMAGE_MULTIPLIER: 0.1,
} as const;

export const WEAPONS = {
  BLASTER_FIRE_RATE: 150,
  BLASTER_BOLT_SPEED: 600,
  BLASTER_DAMAGE: 5,
  BLASTER_BOLT_LIFETIME: 2000,
  BLASTER_SPREAD: 8,
} as const;

export const SHIP = {
  PLAYER_HULL: 100,
  PLAYER_SHIELD: 50,
  SHIELD_REGEN_DELAY: 5000,
  SHIELD_REGEN_RATE: 2,
  IFRAMES: 500,
  KNOCKBACK_FORCE: 200,
  HITBOX_RADIUS: 20,
} as const;

export const AI = {
  RUSTY_HULL: 60,
  RUSTY_SHIELD: 0,
  RUSTY_SPEED_MULT: 0.5,
  RUSTY_ROTATION_MULT: 0.5,
  RUSTY_AIM_ACCURACY: 0.2,
  RUSTY_FIRE_RATE: 800,
  RUSTY_CHASE_RANGE: 500,
} as const;

export const COLORS = {
  player: 0x88aacc,
  enemy: 0xcc4444,
  playerBolt: 0x00ddff,
  enemyBolt: 0xff3322,
  pickup: 0xffaa22,
  shield: 0x00ccff,
  hull: 0x44ff44,
  arena: 0x0a1220,
  wall: 0x334455,
} as const;
