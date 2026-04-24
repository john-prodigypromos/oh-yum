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
    playerHull: 400,
    playerShield: 200,
    enemyHull: 200,
    enemyShield: 0,
    enemySpeedMult: 0.8,
    enemyRotationMult: 0.5,
    enemyFireRate: 900,
    enemyChaseRange: 500,
    aiSensitivity: 1.5,
    aiAggression: 0.15,
    aiJinkIntensity: 0.1,
    aiLeashRange: 300,
    aiFireCone: 0.45,
  },
  intermediate: {
    label: 'INTERMEDIATE',
    playerHull: 280,
    playerShield: 140,
    enemyHull: 350,
    enemyShield: 10,
    enemySpeedMult: 1.1,
    enemyRotationMult: 0.8,
    enemyFireRate: 500,
    enemyChaseRange: 700,
    aiSensitivity: 3.5,
    aiAggression: 0.45,
    aiJinkIntensity: 0.4,
    aiLeashRange: 220,
    aiFireCone: 0.25,
  },
  expert: {
    label: 'EXPERT',
    playerHull: 180,
    playerShield: 90,
    enemyHull: 550,
    enemyShield: 25,
    enemySpeedMult: 1.4,
    enemyRotationMult: 1.2,
    enemyFireRate: 250,
    enemyChaseRange: 900,
    aiSensitivity: 5.0,
    aiAggression: 0.8,
    aiJinkIntensity: 0.8,
    aiLeashRange: 160,
    aiFireCone: 0.1,
  },
};

/** Global mutable selection — set by TitleScene, read by ArenaScene */
export let currentDifficulty: DifficultyLevel = 'intermediate';

export function setDifficulty(level: DifficultyLevel): void {
  currentDifficulty = level;
}
