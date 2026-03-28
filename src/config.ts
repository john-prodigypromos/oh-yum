// ── Game Constants ──────────────────────────────────────
// Change values here — never hardcode numbers in game logic.

export const TILE_SIZE = 16;
export const SCALE = 3;
export const SCALED_TILE = TILE_SIZE * SCALE; // 48px rendered

// Native resolution (before scaling)
export const GAME_WIDTH = 256;  // 16 tiles
export const GAME_HEIGHT = 224; // 14 tiles

// Player
export const PLAYER_SPEED = 100;
export const PLAYER_MAX_HP = 6;     // 3 hearts (each heart = 2 HP)
export const PLAYER_ATTACK = 2;
export const PLAYER_DEFENSE = 0;
export const PLAYER_IFRAMES_MS = 1000;
export const PLAYER_KNOCKBACK = 150;

// Enemies
export const ENEMY_STATS = {
  slime: { hp: 2, speed: 40, attack: 1, xp: 5 },
  skeleton: { hp: 4, speed: 60, attack: 2, xp: 10 },
  bat: { hp: 1, speed: 80, attack: 1, xp: 3 },
} as const;

// Combat
export const KNOCKBACK_DURATION_MS = 200;
export const ATTACK_HITBOX_DURATION_MS = 150;
export const MIN_DAMAGE = 1;

// Colors (for placeholder rectangles before real sprites exist)
export const COLORS = {
  player: 0x44aa44,
  slime: 0x55cc55,
  skeleton: 0xcccccc,
  bat: 0x8844aa,
  sword: 0xaaaaaa,
  heart: 0xff2222,
  heartEmpty: 0x442222,
  rupee: 0x22dd44,
  wall: 0x666666,
  floor: 0x3a3a2a,
  door: 0x885522,
  cybertruck: 0xc0c8d0,   // Steel silver — the top prize
  finalBoss: 0xcc2222,
} as const;
