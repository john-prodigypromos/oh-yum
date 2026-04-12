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
    enemyRotationMult: 0.8,
    enemyFireRate: 400,
    enemyChaseRange: 500,
    aiSensitivity: 2.5,
    aiAggression: 0.4,
    aiJinkIntensity: 0.2,
    aiLeashRange: 180,
    aiFireCone: 0.3,
  },
  intermediate: {
    label: 'INTERMEDIATE',
    playerHull: 180,
    playerShield: 90,
    enemyHull: 500,
    enemyShield: 15,
    enemySpeedMult: 0.75,
    enemyRotationMult: 0.75,
    enemyFireRate: 350,
    enemyChaseRange: 700,
    aiSensitivity: 3.5,
    aiAggression: 0.7,
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
    enemySpeedMult: 0.9,
    enemyRotationMult: 0.9,
    enemyFireRate: 200,
    enemyChaseRange: 900,
    aiSensitivity: 5.0,
    aiAggression: 1.0,
    aiJinkIntensity: 0.8,
    aiLeashRange: 100,
    aiFireCone: 0.1,
  },
};

/** Global mutable selection — set by TitleScene, read by ArenaScene */
export let currentDifficulty: DifficultyLevel = 'intermediate';

export function setDifficulty(level: DifficultyLevel): void {
  currentDifficulty = level;
}
