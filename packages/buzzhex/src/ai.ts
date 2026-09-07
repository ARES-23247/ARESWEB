import {
  BUZZHEX_SIZE,
  HEX_CELLS,
  canSwapHex,
  hexNeighbors,
  hexWinningPath,
  type HexAction,
  type HexColor,
  type HexState,
} from "./rules";

export type HexDifficulty = "easy" | "medium" | "hard";
const NEIGHBORS = HEX_CELLS.map((cell) => hexNeighbors(cell.index));
const other = (color: HexColor): HexColor =>
  color === "black" ? "yellow" : "black";

/** Minimum empty cells needed to join the goals; opposing tiles are impassable. */
function distance(board: HexState["board"], color: HexColor): number {
  const costs = Array<number>(board.length).fill(1000);
  const queue: number[] = [];
  for (let n = 0; n < BUZZHEX_SIZE; n++) {
    const index = color === "black" ? n : n * BUZZHEX_SIZE;
    if (board[index] === other(color)) continue;
    costs[index] = board[index] === color ? 0 : 1;
    queue.push(index);
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    for (const next of NEIGHBORS[index]) {
      if (board[next] === other(color)) continue;
      const cost = costs[index] + (board[next] === color ? 0 : 1);
      if (cost < costs[next]) {
        costs[next] = cost;
        queue.push(next);
      }
    }
  }
  let result = 1000;
  for (let n = 0; n < BUZZHEX_SIZE; n++) {
    const index = color === "black" ? 110 + n : n * BUZZHEX_SIZE + 10;
    result = Math.min(result, costs[index]);
  }
  return result;
}

function evaluate(board: HexState["board"], color: HexColor): number {
  const own = distance(board, color),
    opponent = distance(board, other(color));
  if (own === 0) return 10000;
  if (opponent === 0) return -10000;
  return opponent - own;
}

function rank(board: HexState["board"], color: HexColor) {
  return HEX_CELLS.filter(({ index }) => board[index] === null)
    .map(({ index, q, r }) => {
      board[index] = color;
      const score = evaluate(board, color);
      board[index] = null;
      // Stable tie breaking prefers central cells without changing the path score.
      return { index, score, center: Math.abs(q - 5) + Math.abs(r - 5) };
    })
    .sort(
      (a, b) => b.score - a.score || a.center - b.center || a.index - b.index,
    );
}

/** Bounded local search, run in a worker. Input state is never mutated. */
export function chooseHexAction(
  state: HexState,
  difficulty: HexDifficulty,
  random = Math.random,
): HexAction | null {
  if (state.winner !== null) return null;
  const board = [...state.board],
    color = state.colors[state.current];
  const empty = HEX_CELLS.filter(({ index }) => board[index] === null);
  if (!empty.length) return null;
  for (const { index } of empty) {
    board[index] = color;
    const wins = hexWinningPath(board, color).length > 0;
    board[index] = null;
    if (wins) return { type: "place", index };
  }
  if (canSwapHex(state)) {
    const opening = HEX_CELLS[board.findIndex((tile) => tile !== null)];
    const central = Math.abs(opening.q - 5) + Math.abs(opening.r - 5) <= 4;
    if (difficulty === "easy" ? random() < 0.25 : central)
      return { type: "swap" };
  }
  if (difficulty === "easy") {
    return {
      type: "place",
      index:
        empty[
          Math.min(
            empty.length - 1,
            Math.max(0, Math.floor(random() * empty.length)),
          )
        ].index,
    };
  }
  // Both stronger levels stop a one-move loss before developing their own path.
  for (const { index } of empty) {
    board[index] = other(color);
    const loses = hexWinningPath(board, other(color)).length > 0;
    board[index] = null;
    if (loses) return { type: "place", index };
  }
  const candidates = rank(board, color);
  if (difficulty === "medium")
    return { type: "place", index: candidates[0].index };
  let best = candidates[0].index,
    bestScore = -Infinity;
  // Examine the opponent's best reply to each of eight promising moves.
  // All legal replies are ranked, so an immediate reply win is never pruned.
  for (const candidate of candidates.slice(0, 8)) {
    board[candidate.index] = color;
    const reply = rank(board, other(color))[0];
    const score = reply ? -reply.score : evaluate(board, color);
    board[candidate.index] = null;
    if (score > bestScore) {
      bestScore = score;
      best = candidate.index;
    }
  }
  return { type: "place", index: best };
}
