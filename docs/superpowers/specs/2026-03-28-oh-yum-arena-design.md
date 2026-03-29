# OH-YUM ARENA — Game Design Specification

## Overview

A top-down 2D arena dogfight game built with Phaser 3, TypeScript, and Vite. The player is a pilot from Utah, USA, Earth who competes in the OH-YUM Arena — the galaxy's most legendary combat tournament — to reclaim the stolen Tesla Cybertruck.

**Genre:** Arena dogfight, solo vs AI, arcade combat
**Platform:** Browser (desktop)
**Stack:** Phaser 3 · TypeScript · Vite

---

## Visual Direction

Star Wars-inspired cinematic blockbuster aesthetic:

- **Ships:** Weathered mechanical hulls with panel seams, rivet rows, greeble blocks, scorch marks, and specular highlights. Canvas-rendered at boot, converted to Phaser sprite sheets (hybrid approach).
- **Weapons:** Discrete red/green laser bolts (not beams). Homing missiles with orange smoke trails. Plasma lances. Screen-clearing bomb shockwaves.
- **Explosions:** Fiery orange-amber with billowing smoke, hot shrapnel, flying sparks, fire tendrils. Not clean energy bursts.
- **Engines:** Warm orange-yellow thruster flames with heat distortion ripples.
- **Space:** Deep dark void, subtle nebula, dense procedural starfield with diffraction spikes on bright stars.
- **HUD:** Targeting computer style — deflector/hull bars, target info with class/range/bearing, weapon readout, radar scope. Monospace font, amber/cyan palette, subtle flicker.
- **Resolution:** High-detail canvas rendering. Ships drawn with layered geometry, not simple polygons. Target: visually impressive at 1080p+.

---

## Game Structure & Progression

### The Ladder

16 named AI opponents in linear progression. Beat opponent N to unlock N+1.

### Match Structure

- 1v1 fights in a tight single-screen arena
- Win: reduce enemy hull to 0
- Lose: your hull hits 0 → retry that opponent (no permadeath)
- Weapon pickups spawn randomly mid-fight on a timer (every 8-12 seconds)
- Target match duration: 60-120 seconds

### Between Fights

Hangar screen showing:
- Your ship with Utah flag decal
- Next opponent's dossier (name, ship, homeworld, fighting style description)
- Weapon loadout preview
- Comms from your mechanic back in Utah

### Scoring

- Points for damage dealt, pickups collected, time bonus for fast wins
- Running total across the ladder
- Per-opponent high score tracking
- No currency or upgrade system — pure skill + pickup luck

---

## Physics & Ship Controls

### Movement

- Newtonian thrust: force applied in facing direction
- Rotation: left/right at ~180°/sec
- Light drag: 0.98 velocity dampening per frame (arcade, not simulation)
- Max velocity cap
- Controls: WASD or arrow keys. Thrust = W/Up, Rotate = A/D or Left/Right, Fire = Space, Special Weapon = Shift

### Arena

- Hard walls — bounce off with spark effect and minor hull damage
- Roughly 1.5x screen width/height, camera fixed showing entire arena
- Subtle border: faint grid lines or asteroid ring

### Collision

- Ship-to-ship: both take damage proportional to relative velocity, knockback applied
- Hitboxes: simplified convex polygons, not pixel-perfect

### Feel Targets

- Rotation: fast, responsive (~180°/sec)
- Thrust: cross arena in ~2 seconds at full burn
- Goal: "arcade fighter pilot" — nimble and dangerous

---

## Weapons & Pickups

### Starting Loadout (every fight)

**OH-YUM Blaster** — quad laser, unlimited ammo, moderate fire rate, red bolts.

### Pickup Weapons (timed spawn, limited ammo)

| Weapon | Behavior | Ammo | Visual |
|--------|----------|------|--------|
| OH-YUM Homing Missiles | Lock-on, tracks target | 4 | Orange smoke trail |
| OH-YUM Scatter Shot | Wide 5-bolt spread, short range | 8 | Red bolt fan |
| OH-YUM Plasma Lance | Powerful single beam, pierces shields | 2 | Bright cyan beam |
| OH-YUM Bomb | Screen-clearing shockwave | 1 | Expanding white ring |

### Defensive Pickup

**OH-YUM Shield Boost** — restores 25% deflector shield. Rarer spawn.

### Pickup Rules

- Pickups materialize at random arena positions every 8-12 seconds
- Floating crate with a glow — fly through to collect
- Only one special weapon held at a time (replaces previous)
- HUD shows current special + ammo count

---

## AI Opponents & the Ladder

### Rounds 1-4: Rookie Tier

1. **Rusty** — Slow, predictable, barely fires. Tutorial fight.
2. **Flicker** — Erratic movement, poor aim. Teaches dodging.
3. **Needles** — Fast but fragile. Teaches leading shots.
4. **Brickwall** — Tanky, slow, heavy hitter. Teaches kiting.

### Rounds 5-8: Contender Tier

5. **Viper** — Balanced, uses pickups aggressively.
6. **Sideswipe** — Rams deliberately, high collision damage.
7. **Ghost** — Constant strafing, hard to pin down.
8. **Barrage** — Fires in bursts, favors scatter shot.

### Rounds 9-12: Elite Tier

9. **Sigma-7** — Precise aim, hangs at range with plasma lance.
10. **Havoc** — Chaotic, uses bombs, unpredictable patterns.
11. **Mirage** — Feints approach then flanks, smart positioning.
12. **Ironclad** — Heavy shields, absorbs punishment, counter-attacks.

### Rounds 13-15: Champion Tier

13. **Eclipse** — Near-perfect aim, fast rotation, aggressive.
14. **Nemesis** — Adapts to player's style mid-fight.
15. **Void** — Uses arena edges, traps player in corners.

### Round 16: Final Boss

16. **The Warden** — Guards the Tesla Cybertruck.
    - Phase 1: Standard combat, balanced stats.
    - Phase 2 (50% hull): Deploys drone wingmen.
    - Phase 3 (20% hull): Berserk — rapid-fire + homing missiles simultaneously.
    - Defeat → Cybertruck unlocked.

### AI Architecture

Each opponent has a behavior tree with weighted states:
- `idle` → `chase` → `attack` → `evade` → `seekPickup`
- State weights and transition triggers differ per opponent personality
- Higher-tier opponents have faster decision cycles, better aim prediction, and use more states

---

## Narrative & Setting

### Backstory

The player is a pilot from Utah, USA, Earth, Milky Way Galaxy. The OH-YUM Arena is the galaxy's most legendary combat tournament. The Tesla Cybertruck — a mythical vehicle from Earth — was stolen by arena champions and locked behind The Warden. Winning it back is personal.

### OH-YUM Branding Touchpoints

- **Title screen:** "OH-YUM ARENA" — tagline: "From Utah to the Stars"
- **Hangar screen:** OH-YUM Hangar, Utah Sector, Earth. Ship has Utah flag decal.
- **Pre-fight dossiers:** Player origin listed as "Utah, Earth, Milky Way"
- **Mechanic comms:** Utah-based mechanic radios encouragement between fights
- **Arena announcer:** References player as "The Utah Kid" or "Earth's Champion"
- **All weapons prefixed** with "OH-YUM" (OH-YUM Blaster, OH-YUM Homing Missiles, etc.)
- **Victory scene:** "Utah's own — OH-YUM Arena Champion"
- **Credits:** "A pilot from Utah conquered the stars. The OH-YUM legend lives on."

### The Cybertruck Prize

- Defeating The Warden triggers the OH-YUM Victory Sequence
- Screen fades to black → Tesla Cybertruck rotates center-screen, canvas-rendered in full angular detail
- Typewriter text: "CONGRATULATIONS, PILOT. YOU HAVE CONQUERED THE OH-YUM ARENA."
- Then: "THE LEGENDARY CYBERTRUCK IS YOURS."
- Victory fanfare music
- Credits roll over star field
- Post-game: Cybertruck replaces player ship in hangar. Exhibition matches can be fought piloting the Cybertruck (cosmetic only, same stats).

---

## Technical Architecture

### Rendering (Hybrid Approach)

1. Ships drawn to offscreen HTML5 canvases at boot using layered draw functions (hull, panels, rivets, greebles, weathering, canopy, engines, etc.)
2. Each ship rendered at 72 rotation angles (5° increments) × damage variants → output as Phaser sprite sheets
3. Runtime: Phaser sprites for ships, Phaser particle emitters for thrusters/bolts/explosions/pickups
4. Starfield + nebula rendered once to a static background texture

### Scene Graph

```
BootScene        → generates ship sprite sheets, loads audio, shows loading bar
TitleScene       → "OH-YUM ARENA" logo, "From Utah to the Stars", start/continue
HangarScene      → ship view, opponent dossier, weapon preview, Utah comms
ArenaScene       → the fight: physics, AI, weapons, pickups, HUD, all gameplay
VictoryScene     → Cybertruck reveal, typewriter text, credits
```

### Systems

| System | Responsibility |
|--------|---------------|
| ShipRenderer | Canvas draw functions per ship design, outputs sprite sheets at boot |
| PhysicsSystem | Thrust, rotation, drag, velocity cap, wall bounce, collision detection |
| WeaponSystem | Bolt spawning, homing logic, spread patterns, bomb shockwave, ammo tracking |
| PickupSystem | Timed spawns, crate entities, collection detection, weapon replacement |
| AISystem | Per-opponent behavior trees, state selection, aim prediction |
| DamageSystem | Hull/shield tracking, i-frames, knockback, hit sparks, death |
| HUDSystem | Deflector/hull bars, target info, weapon status, radar, targeting brackets |
| LadderSystem | Progression state, unlock tracking, score, save/load |

### Game State

```ts
interface GameState {
  currentOpponent: number;      // 0-15 ladder position
  score: number;
  highScores: number[];         // per-opponent best, length 16
  ladderDefeated: boolean[];    // which opponents beaten, length 16
  cybertruckUnlocked: boolean;
  settings: {
    sfxVolume: number;
    musicVolume: number;
    screenShake: boolean;
  };
}
```

Persisted via `localStorage` JSON serialization.

### File Structure

```
src/
├── main.ts                         # Phaser game config, scene registration
├── config.ts                       # Constants (physics, damage, timing)
├── state/
│   └── GameState.ts                # Singleton state manager, save/load
├── scenes/
│   ├── BootScene.ts                # Ship generation, asset loading
│   ├── TitleScene.ts               # OH-YUM ARENA title screen
│   ├── HangarScene.ts              # Between-fight: dossier, loadout, comms
│   ├── ArenaScene.ts               # Core gameplay
│   └── VictoryScene.ts             # Cybertruck reveal + credits
├── ships/
│   ├── ShipRenderer.ts             # Canvas draw + sprite sheet generation
│   ├── ShipDefinitions.ts          # Data for all 17 ships (player + 16 enemies)
│   ├── ShipDrawHelpers.ts          # Shared: panels, rivets, greebles, weathering
│   └── CybertruckRenderer.ts      # Cybertruck canvas draw for victory + post-game
├── systems/
│   ├── PhysicsSystem.ts
│   ├── WeaponSystem.ts
│   ├── PickupSystem.ts
│   ├── AISystem.ts
│   ├── DamageSystem.ts
│   ├── HUDSystem.ts
│   └── LadderSystem.ts
├── entities/
│   ├── Ship.ts                     # Player + enemy ship entity
│   ├── Bolt.ts                     # Laser bolt projectile
│   ├── Missile.ts                  # Homing missile
│   ├── Pickup.ts                   # Weapon/shield crate
│   └── Explosion.ts                # Explosion particle controller
├── ai/
│   ├── AIBehavior.ts               # Base behavior interface
│   ├── behaviors/                  # One file per opponent personality
│   │   ├── RustyBehavior.ts
│   │   ├── ViperBehavior.ts
│   │   ├── TheWardenBehavior.ts
│   │   └── ...                     # 16 total
│   └── AIDirector.ts               # Selects behavior based on opponent index
├── ui/
│   ├── HealthBar.ts
│   ├── TargetBrackets.ts
│   ├── WeaponIndicator.ts
│   └── Radar.ts
└── utils/
    ├── math.ts                     # clamp, lerp, angleDiff, randomRange
    └── CanvasUtils.ts              # Drawing helpers: gradients, glow, noise
```

### Build Order

1. Scaffold — update Vite + Phaser config, empty scenes render
2. Ship renderer — canvas draw for player ship, generate sprite sheet, display in scene
3. Physics — thrust, rotation, drag, wall bounce in ArenaScene
4. Basic combat — OH-YUM Blaster bolts, one enemy (Rusty), damage + knockback
5. HUD — deflector/hull bars, weapon status, targeting brackets
6. Pickups — crate spawning, collection, weapon switching
7. All weapons — homing missiles, scatter shot, plasma lance, bomb
8. AI framework — behavior tree system, implement 4 rookie opponents
9. Hangar screen — dossier, comms, pre-fight flow
10. Ladder system — progression, save/load, unlock tracking
11. Remaining 12 opponents — contender, elite, champion tier behaviors + ship designs
12. The Warden — multi-phase final boss, drone spawning
13. Cybertruck — renderer, victory scene, post-game exhibition mode
14. Title screen — OH-YUM ARENA branding, "From Utah to the Stars"
15. Polish — screen shake, particles, sound effects, music, juice

---

## Constants Reference

```ts
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PHYSICS = {
  THRUST: 300,
  ROTATION_SPEED: Math.PI,          // ~180°/sec
  DRAG: 0.98,
  MAX_VELOCITY: 400,
  WALL_BOUNCE_FACTOR: 0.6,
  WALL_DAMAGE: 2,
  COLLISION_DAMAGE_MULTIPLIER: 0.1, // per unit relative velocity
};

export const WEAPONS = {
  BLASTER_FIRE_RATE: 150,           // ms between shots
  BLASTER_BOLT_SPEED: 600,
  BLASTER_DAMAGE: 5,
  MISSILE_SPEED: 250,
  MISSILE_TURN_RATE: 3,
  MISSILE_DAMAGE: 20,
  SCATTER_SPREAD: 0.4,              // radians total spread
  SCATTER_DAMAGE: 4,
  PLASMA_DAMAGE: 40,
  BOMB_DAMAGE: 60,
  BOMB_RADIUS: 400,
};

export const SHIP = {
  PLAYER_HULL: 100,
  PLAYER_SHIELD: 50,
  SHIELD_REGEN_DELAY: 5000,         // ms before shield starts regenerating
  SHIELD_REGEN_RATE: 2,             // per second
  IFRAMES: 500,                      // ms invincibility after hit
};

export const PICKUP = {
  SPAWN_INTERVAL_MIN: 8000,
  SPAWN_INTERVAL_MAX: 12000,
  SHIELD_BOOST: 0.25,               // fraction of max shield
};

export const ROTATION_FRAMES = 72;   // 5° per frame for sprite sheets
```
