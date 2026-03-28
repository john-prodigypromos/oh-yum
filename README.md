# OH-YUM Adventure Game

A top-down 2D action-adventure game built with Phaser 3, TypeScript, and Vite.

The ultimate quest: fight through dungeons, defeat bosses, and claim the legendary **Tesla Cybertruck** — the top prize hidden in the final dungeon.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (opens browser automatically)
npm run dev
```

## Controls

| Key | Action |
|-----|--------|
| Arrow keys | Move (4-direction) |
| Space | Sword attack |

## What's Included

This starter kit gives you a working foundation:

- **Player movement** — 4-direction with diagonal normalization
- **Sword combat** — Directional hitbox, knockback, i-frames with blinking
- **Enemy AI** — Slimes that wander and chase when player is close
- **HUD** — Heart display that updates on damage, rupee counter
- **Game state** — Singleton state manager with save/load support
- **State machine** — Reusable FSM for player and enemy behavior
- **Placeholder graphics** — Colored rectangles so you can code without waiting for art

## Build Order (What to Add Next)

1. ~~Scaffold~~ ✅
2. ~~Player movement~~ ✅
3. ~~Combat basics~~ ✅
4. ~~HUD~~ ✅
5. **Tile maps** — Install Tiled, create a real map, load JSON
6. **Room transitions** — Doors that change scenes
7. **Items** — Pickups (rupees, hearts, keys)
8. **Inventory screen** — Pause menu
9. **NPC dialog** — Typewriter text boxes
10. **Dungeon logic** — Locked doors, room clearing
11. **More enemies** — Skeleton, Bat
12. **Save/load** — Save points or auto-save
13. **Boss fight** — Final boss guarding the Cybertruck
14. **Cybertruck victory** — Prize reveal scene, end credits
15. **Polish** — Particles, screen shake, sound, music

## Project Structure

```
src/
├── main.ts              # Phaser game config
├── config.ts            # All constants (speeds, damage, colors)
├── state/GameState.ts   # Persistent game state singleton
├── scenes/
│   ├── BootScene.ts     # Asset loading + placeholder generation
│   ├── OverworldScene.ts # Main gameplay scene
│   └── UIScene.ts       # HUD overlay
└── utils/
    ├── StateMachine.ts  # Reusable finite state machine
    └── Direction.ts     # Direction enum + vector helpers
```

## Using with Claude Code

The `CLAUDE.md` file contains full architectural context. Claude Code will read it automatically and understand the project conventions, file structure, and what to build next.

Workflow: pick the next item from the build order → ask Claude Code to implement it → test in browser → commit → repeat.
