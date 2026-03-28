export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

/** Get a unit vector for a direction */
export function directionToVector(dir: Direction): { x: number; y: number } {
  switch (dir) {
    case Direction.UP: return { x: 0, y: -1 };
    case Direction.DOWN: return { x: 0, y: 1 };
    case Direction.LEFT: return { x: -1, y: 0 };
    case Direction.RIGHT: return { x: 1, y: 0 };
  }
}

/** Get the opposite direction (for knockback) */
export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case Direction.UP: return Direction.DOWN;
    case Direction.DOWN: return Direction.UP;
    case Direction.LEFT: return Direction.RIGHT;
    case Direction.RIGHT: return Direction.LEFT;
  }
}

/** Determine direction from a velocity vector */
export function vectorToDirection(x: number, y: number): Direction {
  if (Math.abs(x) >= Math.abs(y)) {
    return x >= 0 ? Direction.RIGHT : Direction.LEFT;
  }
  return y >= 0 ? Direction.DOWN : Direction.UP;
}
