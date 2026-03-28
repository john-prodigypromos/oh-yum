/**
 * Generic finite state machine.
 * Used for player states, enemy AI, and any entity behavior.
 *
 * Usage:
 *   const sm = new StateMachine<'idle' | 'walk' | 'attack'>('idle', {
 *     idle: { enter() {}, update() {}, exit() {} },
 *     walk: { enter() {}, update(dt) {}, exit() {} },
 *     attack: { enter() {}, update(dt) {}, exit() {} },
 *   });
 */

interface StateConfig {
  enter?: () => void;
  update?: (dt: number) => void;
  exit?: () => void;
}

export class StateMachine<T extends string> {
  private currentState: T;
  private states: Record<T, StateConfig>;

  constructor(initialState: T, states: Record<T, StateConfig>) {
    this.states = states;
    this.currentState = initialState;
    this.states[this.currentState].enter?.();
  }

  get state(): T {
    return this.currentState;
  }

  transition(newState: T): void {
    if (newState === this.currentState) return;
    this.states[this.currentState].exit?.();
    this.currentState = newState;
    this.states[this.currentState].enter?.();
  }

  update(dt: number): void {
    this.states[this.currentState].update?.(dt);
  }
}
