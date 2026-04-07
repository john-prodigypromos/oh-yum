// ── Villain Taunts ──────────────────────────────────────
// Only two trigger points:
// 1. onSpawn — shown as typewriter popup when the fight starts
// 2. onWin — shown on the game over screen when the villain beats you
//
// Content: Menacing but PG (ages 8+).

export const VILLAIN_TAUNTS: Record<string, { onSpawn: string; onWin: string }> = {
  bolo_tie: {
    onSpawn: 'Wo unto the liar...',
    onWin: 'I am so righteous!',
  },
  bow_tie: {
    onSpawn: 'Are you a thug nasty?',
    onWin: "That's what I thought, thug",
  },
  bishop: {
    onSpawn: 'I find you deplorable!',
    onWin: "Don't mess with my empire",
  },
};

/** Get spawn taunt for a villain. */
export function getSpawnTaunt(villainId: string): string | null {
  return VILLAIN_TAUNTS[villainId]?.onSpawn ?? null;
}

/** Get win taunt for a villain (shown on game over screen). */
export function getWinTaunt(villainId: string): string | null {
  return VILLAIN_TAUNTS[villainId]?.onWin ?? null;
}
