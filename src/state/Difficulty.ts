// ── Difficulty presets ───────────────────────────────────

export type DifficultyLevel = 'beginner' | 'intermediate' | 'expert';

export interface DifficultyConfig {
  label: string;
  playerHull: number;
  playerShield: number;
  enemyHull: number;
  enemyShield: number;
  enemySpeedMult: number;
  enemyRotationMult: number;
  enemyFireRate: number;
  enemyChaseRange: number;
}

export const DIFFICULTY: Record<DifficultyLevel, DifficultyConfig> = {
  beginner: {
    label: 'BEGINNER',
    playerHull: 150,
    playerShield: 80,
    enemyHull: 400,
    enemyShield: 0,
    enemySpeedMult: 0.3,
    enemyRotationMult: 0.3,
    enemyFireRate: 800,
    enemyChaseRange: 350,
  },
  intermediate: {
    label: 'INTERMEDIATE',
    playerHull: 100,
    playerShield: 50,
    enemyHull: 600,
    enemyShield: 0,
    enemySpeedMult: 0.5,
    enemyRotationMult: 0.5,
    enemyFireRate: 500,
    enemyChaseRange: 500,
  },
  expert: {
    label: 'EXPERT',
    playerHull: 80,
    playerShield: 30,
    enemyHull: 1000,
    enemyShield: 30,
    enemySpeedMult: 0.8,
    enemyRotationMult: 0.8,
    enemyFireRate: 300,
    enemyChaseRange: 700,
  },
};

/** Global mutable selection — set by TitleScene, read by ArenaScene */
export let currentDifficulty: DifficultyLevel = 'intermediate';

export function setDifficulty(level: DifficultyLevel): void {
  currentDifficulty = level;
}
