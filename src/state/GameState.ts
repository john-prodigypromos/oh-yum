import { PLAYER_MAX_HP } from '../config';

export interface InventorySlot {
  itemId: string;
  quantity: number;
  equipped: boolean;
}

export interface GameStateData {
  player: {
    hp: number;
    maxHp: number;
    rupees: number;
    keys: number;
  };
  inventory: InventorySlot[];
  equippedSword: string | null;
  equippedItem: string | null;
  flags: Record<string, boolean>;
  currentMap: string;
}

const DEFAULT_STATE: GameStateData = {
  player: {
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    rupees: 0,
    keys: 0,
  },
  inventory: [],
  equippedSword: 'wooden_sword',
  equippedItem: null,
  flags: {},
  currentMap: 'overworld',
};

/**
 * Singleton game state — survives scene transitions.
 * Call GameState.save() to persist to localStorage.
 */
class GameStateManager {
  private data: GameStateData;

  constructor() {
    this.data = structuredClone(DEFAULT_STATE);
  }

  get player() { return this.data.player; }
  get inventory() { return this.data.inventory; }
  get flags() { return this.data.flags; }
  get currentMap() { return this.data.currentMap; }

  set currentMap(map: string) { this.data.currentMap = map; }

  // ── Flag helpers ──
  setFlag(key: string, value = true): void { this.data.flags[key] = value; }
  hasFlag(key: string): boolean { return this.data.flags[key] === true; }

  // ── Player helpers ──
  heal(amount: number): void {
    this.data.player.hp = Math.min(this.data.player.hp + amount, this.data.player.maxHp);
  }

  takeDamage(amount: number): number {
    const actual = Math.max(amount, 1);
    this.data.player.hp = Math.max(this.data.player.hp - actual, 0);
    return actual;
  }

  get isPlayerDead(): boolean { return this.data.player.hp <= 0; }

  // ── Inventory helpers ──
  addItem(itemId: string, quantity = 1): void {
    const existing = this.data.inventory.find(s => s.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.data.inventory.push({ itemId, quantity, equipped: false });
    }
  }

  hasItem(itemId: string): boolean {
    return this.data.inventory.some(s => s.itemId === itemId && s.quantity > 0);
  }

  // ── Save / Load ──
  save(): void {
    localStorage.setItem('ohyum_save', JSON.stringify(this.data));
  }

  load(): boolean {
    const raw = localStorage.getItem('ohyum_save');
    if (!raw) return false;
    try {
      this.data = JSON.parse(raw) as GameStateData;
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.data = structuredClone(DEFAULT_STATE);
  }
}

export const GameState = new GameStateManager();
