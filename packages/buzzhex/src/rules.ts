/** Classic 11 x 11 Hex. Player identity stays independent of tile color. */
export const BUZZHEX_SIZE = 11;
export const BUZZHEX_SAVE_KEY = "ares:buzzhex:v1";
export type HexColor = "black" | "yellow";
export type HexPlayer = 0 | 1;
export type HexAction = { type: "place"; index: number } | { type: "swap" };
export interface HexEntry {
  action: HexAction;
  player: HexPlayer;
  color: HexColor;
}
export interface HexState {
  board: (HexColor | null)[];
  colors: [HexColor, HexColor];
  current: HexPlayer;
  history: HexEntry[];
  winner: HexPlayer | null;
  path: number[];
}
export interface HexSession {
  mode?: "local" | "computer";
  difficulty?: "easy" | "medium" | "hard";
  game: HexState;
  names: [string, string];
}
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
] as const;

export const HEX_CELLS = Array.from({ length: 121 }, (_, index) => {
  const q = Math.floor(index / 11),
    r = index % 11;
  return {
    index,
    q,
    r,
    label: `${String.fromCharCode(65 + q)}${r + 1}`,
    x: ((q + r - 10) * 34 * Math.sqrt(3)) / 2,
    y: (q - r) * 17,
  };
});

export function hexNeighbors(index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= 121) return [];
  const { q, r } = HEX_CELLS[index];
  return DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr])
    .filter(([nq, nr]) => nq >= 0 && nq < 11 && nr >= 0 && nr < 11)
    .map(([nq, nr]) => nq * 11 + nr);
}

export function createHexGame(): HexState {
  return {
    board: Array<HexColor | null>(121).fill(null),
    colors: ["black", "yellow"],
    current: 0,
    history: [],
    winner: null,
    path: [],
  };
}

/** Breadth-first search returns a real edge-connected winning chain. */
export function hexWinningPath(
  board: readonly (HexColor | null)[],
  color: HexColor,
): number[] {
  const parent = new Map<number, number | null>();
  const queue: number[] = [];
  for (const cell of HEX_CELLS) {
    if (
      (color === "black" ? cell.q : cell.r) === 0 &&
      board[cell.index] === color
    ) {
      queue.push(cell.index);
      parent.set(cell.index, null);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i],
      cell = HEX_CELLS[index];
    if ((color === "black" ? cell.q : cell.r) === 10) {
      const result: number[] = [];
      let cursor: number | null = index;
      while (cursor !== null) {
        result.push(cursor);
        cursor = parent.get(cursor) ?? null;
      }
      return result.reverse();
    }
    for (const next of hexNeighbors(index)) {
      if (board[next] === color && !parent.has(next)) {
        parent.set(next, index);
        queue.push(next);
      }
    }
  }
  return [];
}

export function canSwapHex(state: HexState): boolean {
  return (
    state.winner === null && state.history.length === 1 && state.current === 1
  );
}

export function applyHexAction(
  state: HexState,
  action: HexAction,
): HexState | null {
  if (state.winner !== null) return null;
  const color = state.colors[state.current];
  const entry: HexEntry = { action, player: state.current, color };
  if (action.type === "swap") {
    if (!canSwapHex(state)) return null;
    return {
      ...state,
      colors: ["yellow", "black"],
      current: 0,
      history: [...state.history, entry],
    };
  }
  if (
    !Number.isInteger(action.index) ||
    action.index < 0 ||
    action.index >= 121 ||
    state.board[action.index] !== null
  )
    return null;
  const board = [...state.board];
  board[action.index] = color;
  const path = hexWinningPath(board, color);
  return {
    ...state,
    board,
    current: state.current === 0 ? 1 : 0,
    path,
    winner: path.length ? state.current : null,
    history: [...state.history, entry],
  };
}

export function undoHexAction(state: HexState): HexState {
  return state.history
    .slice(0, -1)
    .reduce(
      (game, entry) => applyHexAction(game, entry.action)!,
      createHexGame(),
    );
}

export function encodeHexSave(session: HexSession): string {
  return JSON.stringify({
    version: 1,
    mode: session.mode,
    difficulty: session.difficulty,
    names: session.names,
    actions: session.game.history.map((entry) => entry.action),
  });
}

/** Only replay validated actions. Never trust a saved board, winner, or turn. */
export function decodeHexSave(raw: string): HexSession | null {
  if (raw.length > 16000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("version" in value) ||
      value.version !== 1 ||
      !("names" in value) ||
      !Array.isArray(value.names) ||
      value.names.length !== 2 ||
      !value.names.every(
        (name) =>
          typeof name === "string" &&
          name.trim().length > 0 &&
          name.length <= 28,
      ) ||
      !("actions" in value) ||
      !Array.isArray(value.actions) ||
      value.actions.length > 122
    )
      return null;
    if ("mode" in value && value.mode !== "local" && value.mode !== "computer")
      return null;
    if (
      "difficulty" in value &&
      value.difficulty !== "easy" &&
      value.difficulty !== "medium" &&
      value.difficulty !== "hard"
    )
      return null;
    let game = createHexGame();
    for (const action of value.actions) {
      if (
        !action ||
        typeof action !== "object" ||
        (action.type !== "swap" &&
          (action.type !== "place" || !Number.isInteger(action.index)))
      )
        return null;
      const safeAction: HexAction =
        action.type === "swap"
          ? { type: "swap" }
          : { type: "place", index: action.index };
      const next = applyHexAction(game, safeAction);
      if (!next) return null;
      game = next;
    }
    return {
      game,
      names: [value.names[0], value.names[1]],
      ...("mode" in value ? { mode: value.mode as HexSession["mode"] } : {}),
      ...("difficulty" in value
        ? { difficulty: value.difficulty as HexSession["difficulty"] }
        : {}),
    };
  } catch {
    return null;
  }
}
