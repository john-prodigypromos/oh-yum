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
  // AI behavior tuning — scales aggression with skill level
  aiSensitivity: number;     // steering sharpness: 2.0 lazy → 5.0 razor
  aiAggression: number;      // 0.0-1.0 — pursuit relentlessness, phase duration scaling
  aiJinkIntensity: number;   // 0.0-1.0 — evasive weaving strength
  aiLeashRange: number;      // max distance before forced re-engage
  aiFireCone: number;        // dot-product threshold for allowing fire (lower = wider cone)
}

export const DIFFICULTY: Record<DifficultyLevel, DifficultyConfig> = {
  beginner: {
    label: 'BEGINNER',
    playerHull: 250,
    playerShield: 120,
    enemyHull: 350,
    enemyShield: 0,
    enemySpeedMult: 0.8,
    enemyRotationMult: 0.5,
    enemyFireRate: 600,
    enemyChaseRange: 500,
    aiSensitivity: 1.5,
    aiAggression: 0.2,
    aiJinkIntensity: 0.1,
    aiLeashRange: 200,
    aiFireCone: 0.4,
  },
  intermediate: {
    label: 'INTERMEDIATE',
    playerHull: 180,
    playerShield: 90,
    enemyHull: 500,
    enemyShield: 15,
    enemySpeedMult: 1.1,
    enemyRotationMult: 0.8,
    enemyFireRate: 350,
    enemyChaseRange: 700,
    aiSensitivity: 3.5,
    aiAggression: 0.6,
    aiJinkIntensity: 0.5,
    aiLeashRange: 140,
    aiFireCone: 0.2,
  },
  expert: {
    label: 'EXPERT',
    playerHull: 120,
    playerShield: 60,
    enemyHull: 800,
    enemyShield: 40,
    enemySpeedMult: 1.4,
    enemyRotationMult: 1.2,
    enemyFireRate: 150,
    enemyChaseRange: 900,
    aiSensitivity: 6.0,
    aiAggression: 1.0,
    aiJinkIntensity: 1.0,
    aiLeashRange: 90,
    aiFireCone: 0.05,
  },
};

/** Global mutable selection — set by TitleScene, read by ArenaScene */
export let currentDifficulty: DifficultyLevel = 'intermediate';

export function setDifficulty(level: DifficultyLevel): void {
  currentDifficulty = level;
}
