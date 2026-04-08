// ── Level progression state ─────────────────────────────

export interface LevelConfig {
  level: number;
  enemyCount: number;
  enemySpeedBonus: number;
  enemyRotationBonus: number;
  enemyFireRateBonus: number; // < 1 = faster firing
  subtitle: string;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, enemyCount: 1, enemySpeedBonus: 1.0, enemyRotationBonus: 1.0, enemyFireRateBonus: 1.0, subtitle: 'THE HUNT BEGINS' },
  { level: 2, enemyCount: 2, enemySpeedBonus: 1.15, enemyRotationBonus: 1.15, enemyFireRateBonus: 0.85, subtitle: 'DOUBLE TROUBLE' },
  { level: 3, enemyCount: 3, enemySpeedBonus: 1.3, enemyRotationBonus: 1.3, enemyFireRateBonus: 0.7, subtitle: 'THE FINAL WAVE' },
];

/** Current level index (0-based) */
export let currentLevelIndex = 0;

/** Carry-over player state between levels (null = fresh start) */
export let carryOverHull: number | null = null;
export let carryOverShield: number | null = null;

/** Cumulative score across all levels */
export let totalScore = 0;

export function getCurrentLevel(): LevelConfig {
  return LEVELS[currentLevelIndex];
}

export function resetLevelState(): void {
  currentLevelIndex = 0;
  carryOverHull = null;
  carryOverShield = null;
  totalScore = 0;
  currentMissionPhase = 'launch';
}

export function advanceLevel(playerHull: number, playerMaxHull: number, playerMaxShield: number, matchScore: number): boolean {
  totalScore += matchScore;

  if (currentLevelIndex >= LEVELS.length - 1) {
    return false; // no more levels
  }

  // Carry over: full shields, heal 25% hull
  carryOverShield = playerMaxShield;
  carryOverHull = Math.min(playerMaxHull, playerHull + Math.floor(playerMaxHull * 0.25));
  currentLevelIndex++;
  return true;
}

export function isLastLevel(): boolean {
  return currentLevelIndex >= LEVELS.length - 1;
}

export type MissionPhase = 'launch' | 'combat' | 'landing';
export let currentMissionPhase: MissionPhase = 'launch';

export function setMissionPhase(phase: MissionPhase): void {
  currentMissionPhase = phase;
}
