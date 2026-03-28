# OH-YUM ADVENTURE — Claude Code Context

## Project Overview
A top-down 2D action-adventure game built with **Phaser 3** (browser-based). Classic top-down adventure style — tile-based overworld, dungeon rooms, real-time combat, items, and puzzles. The player's ultimate goal is to fight through increasingly dangerous dungeons to claim the legendary **Tesla Cybertruck** — the top prize locked behind the final boss.

**Stack:** Phaser 3 · TypeScript · Vite · Tiled (map editor, exports JSON)

---

## Game Narrative

The land of OH-YUM is under siege. Dark forces have stolen the legendary **Cybertruck** and locked it away in the deepest dungeon. The player must explore the overworld, gather items and keys, clear dungeons, defeat bosses, and ultimately reach the final chamber where the Cybertruck awaits. When the final boss is defeated, the `cybertruck_claimed` flag is set, triggering a victory scene with the Cybertruck reveal.

**Key game flags:**
- `has_dungeon1_key` → unlocks Dungeon 1
- `dungeon1_boss_defeated` → opens path to Dungeon 2
- `dungeon2_boss_defeated` → opens path to Final Dungeon
- `final_boss_defeated` → Cybertruck chamber unlocks
- `cybertruck_claimed` → triggers victory/credits scene

---

## Architecture Rules

### Scene Structure
- Each game screen is a Phaser `Scene` (title, overworld, dungeon, inventory, dialog, pause, victory)
- Scenes communicate via Phaser's event emitter or a shared `GameState` singleton
- Never put game logic in scene `create()` — delegate to manager classes
- **VictoryScene** — triggered when `cybertruck_claimed` is set. Shows the Cybertruck prize reveal and end credits.

### Entity Pattern
All game entities (player, enemies, NPCs, items, projectiles) extend a base `Entity` class:
```
Entity (base)
├── Player
├── Enemy (base)
│   ├── Slime
│   ├── Skeleton
│   └── Bat
├── Boss (base)
│   ├── Dungeon1Boss
│   ├── Dungeon2Boss
│   └── FinalBoss (guards the Cybertruck)
├── NPC
├── Projectile
└── Item (pickup)
```
- Every entity has: `hp`, `maxHp`, `speed`, `state` (idle/moving/attacking/hurt/dead)
- State machine pattern for entity behavior — no nested if/else chains
- Hitboxes are separate from sprite bounds (use Phaser physics bodies offset from sprite)

### Tile Maps
- Maps created in **Tiled** editor, exported as JSON
- Standard layers: `ground`, `walls`, `objects`, `collision`, `overhead` (renders above player)
- Collision layer uses a dedicated tileset with invisible collision tiles
- Object layer contains spawn points, doors, triggers, chests, NPCs
- Each map has a companion `.ts` file defining its connections, enemies, and events

### Combat System
- Real-time action combat (not turn-based)
- Player attacks with equipped weapon — hitbox spawns in facing direction for N frames
- Enemies have simple AI states: `idle` → `chase` → `attack` → `cooldown`
- Bosses have multi-phase AI with unique attack patterns
- Damage formula: `baseDamage - defense` (minimum 1)
- Knockback on hit (both player and enemies)
- I-frames (invincibility frames) after taking damage — sprite flashes

### Inventory & Items
- Fixed-slot inventory (sword slot, item slot, passive slots)
- Items defined in a central `items.ts` registry with: `id`, `name`, `description`, `type`, `effect`, `spriteKey`
- Consumables reduce stack count; equipment toggles `equipped` flag
- Key items tracked as boolean flags in `GameState`
- The **Cybertruck Key** is a special key item dropped by the final boss — it opens the Cybertruck chamber

### Room Transitions
- Overworld: camera follows player, scrolls seamlessly
- Dungeons: screen-by-screen transitions (classic snap-scroll)
- Door/exit objects in Tiled trigger scene transitions with fade effect
- Player spawn position set by the `fromDirection` or named spawn point

### Game State (Singleton)
```ts
interface GameState {
  player: { hp: number; maxHp: number; rupees: number; keys: number; }
  inventory: InventorySlot[];
  flags: Record<string, boolean>;  // "dungeon1_boss_defeated", "cybertruck_claimed", etc.
  currentMap: string;
  dungeonState: Record<string, DungeonRoomState>;  // tracks cleared rooms, opened chests
}
```
- Persists across scene changes
- Save/load via `localStorage` JSON serialization
- Flags drive world changes (NPCs say different things, doors open, Cybertruck chamber unlocks, etc.)

---

## File Structure
```
src/
├── main.ts                  # Phaser game config, scene registration
├── config.ts                # Constants (tile size, speeds, damage values)
├── state/
│   └── GameState.ts         # Singleton game state manager
├── scenes/
│   ├── BootScene.ts         # Asset preloading
│   ├── TitleScene.ts        # Title screen / main menu
│   ├── OverworldScene.ts    # Main overworld
│   ├── DungeonScene.ts      # Generic dungeon room handler
│   ├── UIScene.ts           # HUD overlay (hearts, rupees, items)
│   ├── InventoryScene.ts    # Pause menu / inventory screen
│   ├── DialogScene.ts       # Text boxes for NPC dialog
│   └── VictoryScene.ts      # Cybertruck reveal + end credits
├── entities/
│   ├── Entity.ts            # Base entity class
│   ├── Player.ts            # Player controller + animations
│   ├── enemies/
│   │   ├── Enemy.ts         # Base enemy class
│   │   ├── Slime.ts
│   │   ├── Skeleton.ts
│   │   └── Bat.ts
│   ├── bosses/
│   │   ├── Boss.ts          # Base boss class (multi-phase AI)
│   │   └── FinalBoss.ts     # Guards the Cybertruck
│   ├── NPC.ts
│   └── Projectile.ts
├── systems/
│   ├── CombatSystem.ts      # Damage calc, knockback, i-frames
│   ├── DialogSystem.ts      # Typewriter text, choices
│   ├── DungeonManager.ts    # Room clearing logic, locked doors, keys
│   └── SaveSystem.ts        # localStorage save/load
├── items/
│   ├── ItemRegistry.ts      # All item definitions (including Cybertruck Key)
│   └── ItemEffects.ts       # What happens when items are used
├── maps/
│   ├── overworld.json       # Tiled export
│   ├── overworld.ts         # Map metadata (connections, spawns)
│   ├── dungeon1-room1.json
│   ├── dungeon1-room1.ts
│   ├── final-dungeon-boss.json
│   └── cybertruck-chamber.json  # The prize room
├── ui/
│   ├── HealthBar.ts         # Heart display
│   ├── TextBox.ts           # Dialog rendering
│   └── MiniMap.ts           # Optional minimap
└── utils/
    ├── StateMachine.ts      # Generic finite state machine
    ├── Direction.ts          # UP/DOWN/LEFT/RIGHT enum + helpers
    └── math.ts              # Clamp, lerp, random range
```

---

## Art & Assets Strategy

### Sprites
- Use a free tileset to start (e.g., top-down adventure tilesets from itch.io or OpenGameArt)
- 16×16 pixel tiles, scaled 3× in-game (48px rendered)
- Player sprite sheet: 4 directions × (idle, walk 4-frame, attack 4-frame, hurt)
- Enemy sprites: minimum idle + move + attack + death per enemy type
- **Cybertruck sprite**: a pixel-art top-down Cybertruck (angular, silver/steel, ~32×48 pixels). Placeholder: a large steel-colored rectangle.
- Keep all sprite references in `config.ts` so swapping art later is trivial

### Audio
- Phaser handles Web Audio API
- Sound effects: sword swing, hit, pickup, door, menu select
- Background music: one track per area (overworld, dungeon, boss, title)
- **Victory fanfare**: special music for the Cybertruck reveal scene
- Use royalty-free assets from itch.io, OpenGameArt, or Freesound

---

## Build Order (Iterative Layers)

Build and commit each layer before moving to the next:

1. **Scaffold** — Vite + Phaser + TypeScript, empty scene renders, camera works
2. **Player movement** — 4-direction movement, sprite animation, collision with walls
3. **Tile map** — Load a Tiled JSON map, render layers, collision detection
4. **Combat basics** — Sword attack hitbox, one enemy (Slime), damage + knockback
5. **HUD** — Hearts display, rupee counter, current item
6. **Room transitions** — Door objects trigger scene changes with fade
7. **Items** — Pickup items from ground, rupees, hearts, key items
8. **Inventory screen** — Pause → view items → equip
9. **NPC dialog** — Typewriter text box, triggered by interaction
10. **Dungeon logic** — Locked doors, keys, room clearing, boss room
11. **More enemies** — Skeleton, Bat with unique AI behaviors
12. **Save/load** — localStorage persistence, save points or auto-save
13. **Boss fights** — Patterns, phases, special mechanics (final boss guards the Cybertruck)
14. **Cybertruck prize** — Final chamber, Cybertruck reveal scene, victory fanfare, end credits
15. **Polish** — Screen shake, particles, sound effects, music, title screen

---

## Claude Code Workflow Tips

- **Commit after every working layer.** Use git as your rollback net.
- **`npm run dev` keeps Vite hot-reloading** — you'll see changes instantly in the browser.
- **Test in browser after every change.** Visual bugs are obvious; logic bugs hide.
- **When adding a new enemy:** copy an existing one, rename, change the AI states. Don't build from scratch.
- **If the codebase feels tangled:** run `/compact`, re-read this file, refocus on one system at a time.
- **Sprite placeholder trick:** use colored rectangles first, swap in real sprites later. Don't let art block development.

---

## Constants Reference (config.ts)

```ts
export const TILE_SIZE = 16;
export const SCALE = 3;
export const SCALED_TILE = TILE_SIZE * SCALE;  // 48px

export const GAME_WIDTH = 256;   // 16 tiles wide (native)
export const GAME_HEIGHT = 224;  // 14 tiles tall (native)

export const PLAYER_SPEED = 100;
export const PLAYER_MAX_HP = 6;  // 3 hearts (each heart = 2 HP)
export const PLAYER_ATTACK = 2;
export const PLAYER_IFRAMES = 1000;  // ms of invincibility after hit

export const ENEMY_SPEEDS = {
  slime: 40,
  skeleton: 60,
  bat: 80,
};

// Cybertruck placeholder color (steel silver)
export const CYBERTRUCK_COLOR = 0xc0c8d0;
```

---

## The Cybertruck (Top Prize)

The Tesla Cybertruck is the ultimate reward for completing the game. Design notes:

- **In-world representation:** A large angular sprite sitting on a pedestal in the final chamber
- **Access:** The chamber door only opens when `final_boss_defeated` flag is true
- **Interaction:** Player walks up and presses interact → `cybertruck_claimed` flag set → VictoryScene launches
- **VictoryScene:** Dramatic reveal — screen fades to black, Cybertruck sprite zooms in center screen, victory fanfare plays, congratulations text typewriters in, credits roll
- **Post-game:** After credits, player returns to overworld. NPCs have new dialog acknowledging the victory. The Cybertruck appears parked in the town square as a permanent world change.

---

## Do NOT
- Use React or DOM manipulation for game rendering — Phaser handles all rendering
- Put game logic in `update()` without delta-time scaling
- Hardcode map layouts in code — always use Tiled JSON
- Skip the state machine pattern — nested if/else AI becomes unmaintainable fast
- Build multiple features simultaneously — finish one, commit, then start the next
