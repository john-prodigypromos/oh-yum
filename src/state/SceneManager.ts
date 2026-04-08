// ── Scene Manager ────────────────────────────────────────
// State machine managing game flow:
// title → charSelect → levelIntro → arena → highScore → title

export type SceneState = 'title' | 'charSelect' | 'levelIntro' | 'cinematic' | 'marsLaunch' | 'arena' | 'earthLanding' | 'highScore' | 'gameOver';

export interface SceneCallbacks {
  onEnter: (state: SceneState, prevState: SceneState | null) => void;
  onExit: (state: SceneState, nextState: SceneState) => void;
}

export class SceneManager {
  current: SceneState = 'title';
  private callbacks: SceneCallbacks;

  constructor(callbacks: SceneCallbacks) {
    this.callbacks = callbacks;
  }

  transition(next: SceneState): void {
    const prev = this.current;
    this.callbacks.onExit(prev, next);
    this.current = next;
    this.callbacks.onEnter(next, prev);
  }

  /** Start the initial scene. */
  start(initial: SceneState = 'title'): void {
    this.current = initial;
    this.callbacks.onEnter(initial, null);
  }
}
