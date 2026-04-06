# OH-YUM BLASTER — Gameplay Overhaul Design

**Date:** 2026-04-06
**Audience:** Ages 8+ (kid-friendly — no gore, no profanity, cartoonishly cocky villains)

---

## Overview

Three-phase upgrade to OH-YUM BLASTER: visual juice, per-level environments, and boss personalities with taunts. Each phase is independently playable and testable. Ship in order: Phase 1 → Phase 2 → Phase 3.

---

## Phase 1 — Juice (Visual & Audio Polish)

### Ship Destruction
When an enemy dies:
- Ship mesh splits into 5-8 tumbling chunks with random spin
- Chunks use the enemy's hull material
- Chunks fade out over 2 seconds
- Bright white flash at point of death
- Expanding shockwave ring (additive blend, fades over 1s)

### Engine Trails
- Thin glowing particle trail behind every ship while thrusting
- Player trail: cyan (`#00ddff`)
- Enemy trail: orange-red (`#ff4422`)
- Trail fades over ~1 second
- Creates visible flight paths during dogfights

### Hull Hit Sparks
- On bolt impact: spawn 8-12 tiny bright particles spraying outward from hit point
- Brief orange flash at hit location
- Particles fade over 0.3-0.5 seconds

### Speed Lines
- When player holds thrust (E key): faint white streaking lines at cockpit view edges
- Intensity scales with velocity
- Fade in/out smoothly with thrust input
- Subtle — enhances speed feel without obstructing view

### Slow-Mo Kill Shot
- When the final enemy in a level dies: time slows to 30% for 1.5 seconds
- Explosion plays in slow motion
- Camera holds steady (no shake during slow-mo)
- Music drops to a low hum
- Normal speed resumes, then victory screen triggers

---

## Phase 2 — Environments

Each level loads a unique environment. The base starfield/skybox persists as a foundation layer. Environments are swapped in `createArenaState()` based on the current level.

### Level 1 — Asteroid Belt
- 20-40 asteroid meshes scattered through the arena
- Low-poly rock geometry (procedural or simple icosahedrons with noise displacement)
- Sizes: small (3-5 unit radius, car-sized) to large (15-25 unit radius, house-sized)
- Slow drift with random rotation
- Collidable: ships bounce off and take minor damage (same as arena wall collision)
- Enemies can crash into them too
- Warm sun lighting (current setup works)
- Current planet/moon remains as backdrop

### Level 2 — Nebula
- Dense colored fog limiting visibility to ~150-200 units
- Implemented as a large semi-transparent sphere or fog effect (teal/purple hue)
- Enemies appear and disappear through the fog
- Occasional lightning flashes: brief white directional light burst + ambient brightening
- Lightning frequency: every 8-15 seconds (random)
- No asteroids — the fog IS the environmental hazard
- Reduced ambient lighting for moodier atmosphere

### Level 3 — Black Hole
- Black hole with glowing orange/yellow accretion disk dominates the skybox
- Accretion disk: large torus with emissive gradient material, slow rotation
- Gravitational pull: constant force toward the black hole center
  - Pull strength increases with proximity
  - Affects player, enemies, bolts, and debris
- Visual distortion: subtle lens warp (fragment shader or CSS filter) near the black hole
- Stars near the black hole streak/elongate
- Arena boundary IS the event horizon — crossing it is instant death
- Black hole positioned at a fixed point in the arena (not center — offset so it's a hazard, not the focus)

---

## Phase 3 — Boss Personalities & Taunts

### Villain Roster

| Level | Name | Fighting Style | Personality |
|-------|------|----------------|-------------|
| 1 | **Bolo Tie** | Brute — ram charges, wide turns, slow but hits hard | Cocky brawler |
| 2 | **Bow Tie** | Ghost — hit-and-run from the fog, fast, lower HP | Sneaky trickster |
| 3 | **Bishop** | Mastermind — multi-phase, deploys drones, uses black hole gravity | Cold strategist |

### Bolo Tie (Level 1 Boss)
- **Charge attack:** Telegraphed by a 0.5s engine flare, then rushes straight at the player at 2x normal speed
- **Charge cooldown:** 5 seconds between charges
- **Between charges:** Standard dogfight behavior (cruise/close/attack)
- **Wide turns:** Lower rotation multiplier (0.4x) — easy to outmaneuver
- **Higher HP** than standard enemies
- **Collision damage bonus:** Ram attacks deal 3x normal collision damage

### Bow Tie (Level 2 Boss)
- **Hit-and-run:** Dives in from fog, fires a 2-second burst, retreats into fog
- **Faster than Bolo Tie:** Speed multiplier 1.2x
- **Lower HP** than Bolo Tie — rewards aggression
- **Fog advantage:** During retreat phase, moves to a random position in the fog beyond visibility range
- **Attack windows:** Vulnerable during the 2-second firing burst and briefly after
- **Shorter attack phase:** 3 seconds in close combat, then disappears

### Bishop (Level 3 Boss)
- **Phase 1 (100-50% HP):** Enhanced standard dogfight — faster, tighter turns, higher fire rate
- **Phase 2 (50-20% HP):** Deploys 2 drone minions
  - Drones are small, fast, low HP (1-2 hits to destroy)
  - Drones use standard AI but more aggressive
  - Bishop becomes evasive — longer breakaway phases, shorter dogfight phases
  - Drones respawn after 15 seconds if destroyed
- **Phase 3 (below 20% HP):** Desperation
  - Aggressive charges (like Bolo Tie) + rapid fire
  - Moves closer to the black hole — gravitational pull becomes a factor for both
  - Drones stop respawning
  - Higher risk/reward: closer to the black hole means stronger pull on everyone

### Taunt System

All taunt text lives in `src/config/VillainTaunts.ts`. User (JP) writes all lines. The system just triggers and displays them.

**Config structure:**
```ts
export const VILLAIN_TAUNTS: Record<string, Record<string, string[]>> = {
  'bolo_tie': {
    onSpawn: ["..."],       // Level starts
    onPlayerHit: ["..."],   // They hit the player
    onTakeDamage: ["..."],  // Player hits them
    onLowHP: ["..."],       // Below 25% health
    onDeath: ["..."],       // Destroyed
  },
  'bow_tie': { ... },
  'bishop': { ... },
};
```

**Display:**
- Text popup near the villain's portrait in the HUD
- Typewriter effect, 2-3 seconds visible
- Max one taunt visible at a time (new taunt replaces old)
- Random selection from the array for each trigger
- Cooldown: minimum 5 seconds between taunts (prevents spam)

**Content guidelines:** Kid-friendly (8+). Cocky, silly, cartoonish. No profanity, no threats of real violence. Think Saturday morning cartoon villain energy.

### Dynamic Music

Music intensity shifts based on game state:

| State | Music |
|-------|-------|
| **Cruise phase** | Ambient space soundtrack — low synth pads, atmospheric |
| **Closing/approach** | Drums and bass kick in — building tension |
| **Dogfight** | Full combat intensity — driving beat, layered synths |
| **Boss phase transition** | Brief stinger (cymbal crash / brass hit) + shift to boss variant |
| **Kill shot slow-mo** | Music drops to low hum / reverb tail |
| **Victory** | Fanfare (already exists) |
| **Defeat** | Existing defeat sound |

Implementation: use the existing `SoundSystem.ts` with multiple audio tracks that crossfade based on the current AI phase of the nearest/primary enemy. Boss fights use a separate boss track.

---

## Implementation Order

### Phase 1 — Juice
1. Ship destruction (chunks + flash + shockwave)
2. Engine trails (particle system)
3. Hull hit sparks
4. Speed lines (cockpit overlay effect)
5. Slow-mo kill shot

### Phase 2 — Environments
1. Level-based environment loading system
2. Asteroid belt (Level 1)
3. Nebula fog (Level 2)
4. Black hole with gravity + accretion disk (Level 3)

### Phase 3 — Boss Personalities
1. VillainTaunts config file (JP fills in text)
2. Taunt display system (HUD popup + typewriter)
3. Bolo Tie charge attack behavior
4. Bow Tie hit-and-run behavior
5. Bishop multi-phase behavior + drones
6. Dynamic music system (phase-based crossfade)

---

## Files Affected

**New files:**
- `src/config/VillainTaunts.ts` — all taunt text
- `src/systems/ParticleSystem3D.ts` — engine trails, sparks, debris
- `src/systems/EnvironmentLoader.ts` — per-level environment setup
- `src/ai/behaviors/BoloTieBehavior3D.ts` — Bolo Tie boss AI
- `src/ai/behaviors/BowTieBehavior3D.ts` — Bow Tie boss AI
- `src/ai/behaviors/BishopBehavior3D.ts` — Bishop boss AI + drone spawning

**Modified files:**
- `src/scenes/ArenaLoop.ts` — slow-mo, boss spawning, environment loading
- `src/systems/DamageSystem3D.ts` — destruction chunks, sparks
- `src/systems/SoundSystem.ts` — dynamic music crossfade
- `src/ui/HUD3D.ts` — taunt display, speed lines
- `src/renderer/Environment.ts` — asteroid, nebula, black hole creation
- `src/entities/Ship3D.ts` — engine trail attachment point
- `src/state/LevelState.ts` — boss type per level
- `src/config.ts` — boss-specific constants
