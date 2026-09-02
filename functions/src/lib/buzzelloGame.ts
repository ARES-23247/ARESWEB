export const BUZZELLO_CELL_COUNT = 61;
export const BUZZELLO_MAX_MOVES = 55;

export type BuzzelloPlayer = "yellow" | "black";
export type BuzzelloCell = BuzzelloPlayer | null;
export type BuzzelloBoard = BuzzelloCell[];

export interface BuzzelloCoordinate {
  q: number;
  r: number;
}

export interface BuzzelloMove {
  index: number;
  flips: number[];
}

export interface BuzzelloTurnResolution {
  currentPlayer: BuzzelloPlayer;
  gameOver: boolean;
  passedPlayer: BuzzelloPlayer | null;
  winner: BuzzelloPlayer | "draw" | null;
}

const RADIUS = 4;
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const BUZZELLO_COORDINATES: readonly BuzzelloCoordinate[] = (() => {
  const coordinates: BuzzelloCoordinate[] = [];
  for (let q = -RADIUS; q <= RADIUS; q += 1) {
    const minimumR = Math.max(-RADIUS, -q - RADIUS);
    const maximumR = Math.min(RADIUS, -q + RADIUS);
    for (let r = minimumR; r <= maximumR; r += 1) {
      coordinates.push({ q, r });
    }
  }
  return coordinates;
})();

const COORDINATE_INDEX = new Map(
  BUZZELLO_COORDINATES.map(({ q, r }, index) => [`${q},${r}`, index]),
);

export function getBuzzelloOpponent(player: BuzzelloPlayer): BuzzelloPlayer {
  return player === "yellow" ? "black" : "yellow";
}

export function getBuzzelloCellIndex(q: number, r: number): number | null {
  return COORDINATE_INDEX.get(`${q},${r}`) ?? null;
}

export function createBuzzelloInitialBoard(): BuzzelloBoard {
  const board: BuzzelloBoard = Array.from(
    { length: BUZZELLO_CELL_COUNT },
    () => null,
  );
  const startingPieces: ReadonlyArray<
    readonly [number, number, BuzzelloPlayer]
  > = [
    [1, 0, "yellow"],
    [1, -1, "black"],
    [0, -1, "yellow"],
    [-1, 0, "black"],
    [-1, 1, "yellow"],
    [0, 1, "black"],
  ];
  for (const [q, r, player] of startingPieces) {
    board[getBuzzelloCellIndex(q, r)!] = player;
  }
  return board;
}

export function assertBuzzelloBoard(value: unknown): BuzzelloBoard {
  if (
    !Array.isArray(value) ||
    value.length !== BUZZELLO_CELL_COUNT ||
    value.some((cell) => cell !== null && cell !== "yellow" && cell !== "black")
  ) {
    throw new Error("Invalid BUZZELLO board state.");
  }
  return [...value] as BuzzelloBoard;
}

export function getBuzzelloFlips(
  board: BuzzelloBoard,
  player: BuzzelloPlayer,
  index: number,
): number[] {
  if (index < 0 || index >= BUZZELLO_CELL_COUNT || board[index] !== null)
    return [];
  const origin = BUZZELLO_COORDINATES[index];
  const opponent = getBuzzelloOpponent(player);
  const flips: number[] = [];

  for (const [dq, dr] of DIRECTIONS) {
    const line: number[] = [];
    let q = origin.q + dq;
    let r = origin.r + dr;
    let nextIndex = getBuzzelloCellIndex(q, r);
    while (nextIndex !== null && board[nextIndex] === opponent) {
      line.push(nextIndex);
      q += dq;
      r += dr;
      nextIndex = getBuzzelloCellIndex(q, r);
    }
    if (line.length > 0 && nextIndex !== null && board[nextIndex] === player) {
      flips.push(...line);
    }
  }

  return flips;
}

export function getBuzzelloLegalMoves(
  board: BuzzelloBoard,
  player: BuzzelloPlayer,
): BuzzelloMove[] {
  const moves: BuzzelloMove[] = [];
  for (let index = 0; index < BUZZELLO_CELL_COUNT; index += 1) {
    const flips = getBuzzelloFlips(board, player, index);
    if (flips.length > 0) moves.push({ index, flips });
  }
  return moves;
}

export function applyBuzzelloMove(
  board: BuzzelloBoard,
  player: BuzzelloPlayer,
  index: number,
): { board: BuzzelloBoard; flips: number[] } {
  const flips = getBuzzelloFlips(board, player, index);
  if (flips.length === 0) throw new Error("Illegal BUZZELLO move.");
  const nextBoard = [...board];
  nextBoard[index] = player;
  for (const flippedIndex of flips) nextBoard[flippedIndex] = player;
  return { board: nextBoard, flips };
}

export function getBuzzelloScores(
  board: BuzzelloBoard,
): Record<BuzzelloPlayer, number> {
  return board.reduce(
    (scores, cell) => {
      if (cell) scores[cell] += 1;
      return scores;
    },
    { yellow: 0, black: 0 },
  );
}

export function getBuzzelloWinner(
  board: BuzzelloBoard,
): BuzzelloPlayer | "draw" {
  const scores = getBuzzelloScores(board);
  if (scores.yellow === scores.black) return "draw";
  return scores.yellow > scores.black ? "yellow" : "black";
}

export function resolveBuzzelloTurn(
  board: BuzzelloBoard,
  playerWhoMoved: BuzzelloPlayer,
): BuzzelloTurnResolution {
  const scores = getBuzzelloScores(board);
  const opponent = getBuzzelloOpponent(playerWhoMoved);
  const opponentMoves = getBuzzelloLegalMoves(board, opponent);
  const moverMoves = getBuzzelloLegalMoves(board, playerWhoMoved);
  const gameOver =
    scores.yellow === 0 ||
    scores.black === 0 ||
    !board.includes(null) ||
    (opponentMoves.length === 0 && moverMoves.length === 0);

  if (gameOver) {
    return {
      currentPlayer: opponent,
      gameOver: true,
      passedPlayer: null,
      winner: getBuzzelloWinner(board),
    };
  }
  if (opponentMoves.length === 0) {
    return {
      currentPlayer: playerWhoMoved,
      gameOver: false,
      passedPlayer: opponent,
      winner: null,
    };
  }
  return {
    currentPlayer: opponent,
    gameOver: false,
    passedPlayer: null,
    winner: null,
  };
}
