// ── Character selection ──────────────────────────────────

export type CharacterName = 'owen' | 'william' | 'parks' | 'brayden' | 'brody' | 'ethan' | 'austin' | 'dylan';

export interface CharacterConfig {
  label: string;
  color: number;       // Ship tint accent
  imageKey: string;     // Texture key for portrait
  tagline: string;
}

export const CHARACTERS: Record<CharacterName, CharacterConfig> = {
  owen: {
    label: 'OWEN',
    color: 0xff00cc,
    imageKey: 'portrait_owen',
    tagline: 'Speed & precision',
  },
  william: {
    label: 'WILLIAM',
    color: 0xff6600,
    imageKey: 'portrait_william',
    tagline: 'Power & resilience',
  },
  parks: {
    label: 'PARKS',
    color: 0x44bbff,
    imageKey: 'portrait_parks',
    tagline: 'Cool under fire',
  },
  brayden: {
    label: 'BRAYDEN',
    color: 0x44dd44,
    imageKey: 'portrait_brayden',
    tagline: 'Steady & relentless',
  },
  brody: {
    label: 'BRODY',
    color: 0xffcc00,
    imageKey: 'portrait_brody',
    tagline: 'Born to fly',
  },
  ethan: {
    label: 'ETHAN',
    color: 0xdd44ff,
    imageKey: 'portrait_ethan',
    tagline: 'Fearless tactician',
  },
  austin: {
    label: 'AUSTIN',
    color: 0x44aaff,
    imageKey: 'portrait_austin',
    tagline: 'Quick on the trigger',
  },
  dylan: {
    label: 'DYLAN',
    color: 0x00ddcc,
    imageKey: 'portrait_dylan',
    tagline: 'Ace of the squad',
  },
};

export let currentCharacter: CharacterName = 'owen';

export function setCharacter(name: CharacterName): void {
  currentCharacter = name;
}
