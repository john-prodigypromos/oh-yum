// ── OH-YUM Arena — Game Constants ────────────────────────
// All tunable values in one place. Never hardcode in game logic.

export const GAME_HEIGHT = 720;
/** Mutable game width — updated at startup based on screen aspect ratio */
export const runtime = { GAME_WIDTH: 1280 };

// ── 3D Arena ──
export const ARENA = {
  RADIUS: 500,            // sphere boundary radius
  BOUNDARY_WARN: 450,     // distance at which HUD warns player
} as const;

export const PHYSICS = {
  FIXED_TIMESTEP: 1000 / 60,
  THRUST: 80,  // gentle forward drift — enemies can keep up
  ROTATION_SPEED: Math.PI * 0.4,  // slower turning for cockpit feel
  DRAG_HALF_LIFE: 1.5,
  MAX_VELOCITY: 100,  // slow enough that enemies stay in view
  WALL_BOUNCE_FACTOR: 0.6,
  WALL_DAMAGE: 2,
  COLLISION_DAMAGE_MULTIPLIER: 0.1,
} as const;

export const WEAPONS = {
  BLASTER_FIRE_RATE: 150,
  BLASTER_BOLT_SPEED: 150,  // slow enough to not skip through enemies
  BLASTER_DAMAGE: 10,  // enemies die in ~5-8 hits depending on difficulty
  BLASTER_BOLT_LIFETIME: 2000,
  BLASTER_SPREAD: 2,  // tight spread for accurate aiming
} as const;

export const SHIP = {
  PLAYER_HULL: 100,
  PLAYER_SHIELD: 50,
  SHIELD_REGEN_DELAY: 5000,
  SHIELD_REGEN_RATE: 2,
  IFRAMES: 100,  // short i-frames so rapid fire works
  KNOCKBACK_FORCE: 200,
  HITBOX_RADIUS: 12,  // generous hitbox — bolts visibly hit enemies
} as const;

export const AI = {
  RUSTY_HULL: 60,
  RUSTY_SHIELD: 0,
  RUSTY_SPEED_MULT: 0.6,
  RUSTY_ROTATION_MULT: 0.6,
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
