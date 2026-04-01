import Phaser from 'phaser';
import { GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { ArenaScene } from './scenes/ArenaScene';

// Calculate game width based on device aspect ratio
// Keep height fixed at 720, scale width to match screen proportions
const aspect = window.innerWidth / window.innerHeight;
const gameWidth = Math.round(GAME_HEIGHT * aspect);

// Update the exported GAME_WIDTH so all systems use the correct value
import * as cfg from './config';
(cfg as any).GAME_WIDTH = gameWidth;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: gameWidth,
  height: GAME_HEIGHT,
  backgroundColor: '#0a1220',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, CharacterSelectScene, ArenaScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true,
  },
  input: {
    activePointers: 4,
  },
};

const game = new Phaser.Game(config);

// Force Phaser to re-check size after orientation changes
window.addEventListener('resize', () => {
  setTimeout(() => game.scale.refresh(), 100);
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => game.scale.refresh(), 200);
});
