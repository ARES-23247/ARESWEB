import {
  HEX_DIRECTIONS,
  createHexCoordinates,
} from "@ares/game-common/hex-grid";
export type BuzzelloPlayer = "yellow" | "black";

export type BuzzelloCell = BuzzelloPlayer | null;

export type BuzzelloBoard = ReadonlyArray<BuzzelloCell>;

export type BuzzelloDifficulty = "easy" | "medium" | "master";

export interface BuzzelloCoordinate {
  q: number;
  r: number;
}

export interface BuzzelloMove {
  index: number;
  flips: number[];
}

export interface BuzzelloScores {
  yellow: number;
  black: number;
  empty: number;
}

export interface BuzzelloTurnResolution {
  nextPlayer: BuzzelloPlayer;
  passedPlayer: BuzzelloPlayer | null;
  gameOver: boolean;
}

export interface BuzzelloAiOptions {
  random?: () => number;
  now?: () => number;
  timeLimitMs?: number;
  maxDepth?: number;
}

interface SearchContext {
  maximizingPlayer: BuzzelloPlayer;
  deadline: number;
  now: () => number;
}

export type BuzzelloBoardSize = 61 | 91;

function buildBuzzelloRules(boardSize: BuzzelloBoardSize) {
  const BUZZELLO_BOARD_RADIUS = boardSize === 91 ? 5 : 4;

  const BUZZELLO_CELL_COUNT = boardSize;

  const BUZZELLO_DIRECTIONS = HEX_DIRECTIONS;

  function coordinateKey(q: number, r: number): string {
    return `${q},${r}`;
  }

  function buildCoordinates(): BuzzelloCoordinate[] {
    return createHexCoordinates(BUZZELLO_BOARD_RADIUS, "column");
  }

  const BUZZELLO_COORDINATES = buildCoordinates();

  const CELL_INDEX = new Map(
    BUZZELLO_COORDINATES.map((coordinate, index) => [
      coordinateKey(coordinate.q, coordinate.r),
      index,
    ]),
  );

  const BUZZELLO_CORNER_INDICES = [
    [0, -BUZZELLO_BOARD_RADIUS],
    [BUZZELLO_BOARD_RADIUS, -BUZZELLO_BOARD_RADIUS],
    [BUZZELLO_BOARD_RADIUS, 0],
    [0, BUZZELLO_BOARD_RADIUS],
    [-BUZZELLO_BOARD_RADIUS, BUZZELLO_BOARD_RADIUS],
    [-BUZZELLO_BOARD_RADIUS, 0],
  ].map(([q, r]) => CELL_INDEX.get(coordinateKey(q, r)) as number);

  const CORNER_INDEX_SET = new Set(BUZZELLO_CORNER_INDICES);

  const DANGER_INDEX_SET = new Set(
    BUZZELLO_CORNER_INDICES.flatMap((cornerIndex) => {
      const corner = BUZZELLO_COORDINATES[cornerIndex];
      return BUZZELLO_DIRECTIONS.flatMap((direction) => {
        const neighborIndex = getBuzzelloCellIndex(
          corner.q + direction.q,
          corner.r + direction.r,
        );
        return neighborIndex === null ? [] : [neighborIndex];
      });
    }),
  );

  function getBuzzelloCellIndex(q: number, r: number): number | null {
    return CELL_INDEX.get(coordinateKey(q, r)) ?? null;
  }

  function getBuzzelloCoordinate(index: number): BuzzelloCoordinate {
    const coordinate = BUZZELLO_COORDINATES[index];
    if (!coordinate)
      throw new RangeError(`Invalid BUZZELLO cell index: ${index}`);
    return coordinate;
  }

  function formatBuzzelloCoordinate(index: number): string {
    const { q, r } = getBuzzelloCoordinate(index);
    return `q ${q}, r ${r}`;
  }

  function getBuzzelloOpponent(player: BuzzelloPlayer): BuzzelloPlayer {
    return player === "yellow" ? "black" : "yellow";
  }

  function createBuzzelloInitialBoard(): BuzzelloBoard {
    const board: BuzzelloCell[] = Array.from(
      { length: BUZZELLO_CELL_COUNT },
      () => null,
    );
    const startingPieces: ReadonlyArray<[number, number, BuzzelloPlayer]> = [
      [1, 0, "yellow"],
      [0, 1, "black"],
      [-1, 1, "yellow"],
      [-1, 0, "black"],
      [0, -1, "yellow"],
      [1, -1, "black"],
    ];
    for (const [q, r, player] of startingPieces) {
      const index = getBuzzelloCellIndex(q, r);
      if (index !== null) board[index] = player;
    }
    return board;
  }

  function getBuzzelloFlips(
    board: BuzzelloBoard,
    index: number,
    player: BuzzelloPlayer,
  ): number[] {
    if (board[index] !== null) return [];
    const origin = getBuzzelloCoordinate(index);
    const opponent = getBuzzelloOpponent(player);
    const flips: number[] = [];

    for (const direction of BUZZELLO_DIRECTIONS) {
      const line: number[] = [];
      let q = origin.q + direction.q;
      let r = origin.r + direction.r;
      let cursor = getBuzzelloCellIndex(q, r);

      while (cursor !== null && board[cursor] === opponent) {
        line.push(cursor);
        q += direction.q;
        r += direction.r;
        cursor = getBuzzelloCellIndex(q, r);
      }

      if (line.length > 0 && cursor !== null && board[cursor] === player) {
        flips.push(...line);
      }
    }

    return flips;
  }

  function getBuzzelloLegalMoves(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
  ): BuzzelloMove[] {
    const moves: BuzzelloMove[] = [];
    for (let index = 0; index < board.length; index += 1) {
      if (board[index] !== null) continue;
      const flips = getBuzzelloFlips(board, index, player);
      if (flips.length > 0) moves.push({ index, flips });
    }
    return moves;
  }

  function applyBuzzelloMove(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    index: number,
  ): BuzzelloBoard {
    const flips = getBuzzelloFlips(board, index, player);
    if (flips.length === 0) {
      throw new Error(`${formatBuzzelloCoordinate(index)} is not a legal move`);
    }
    const nextBoard = [...board];
    nextBoard[index] = player;
    for (const flippedIndex of flips) nextBoard[flippedIndex] = player;
    return nextBoard;
  }

  function getBuzzelloScores(board: BuzzelloBoard): BuzzelloScores {
    let yellow = 0;
    let black = 0;
    for (const cell of board) {
      if (cell === "yellow") yellow += 1;
      if (cell === "black") black += 1;
    }
    return { yellow, black, empty: board.length - yellow - black };
  }

  function getBuzzelloWinner(board: BuzzelloBoard): BuzzelloPlayer | "draw" {
    const scores = getBuzzelloScores(board);
    if (scores.yellow === scores.black) return "draw";
    return scores.yellow > scores.black ? "yellow" : "black";
  }

  function isBuzzelloGameOver(board: BuzzelloBoard): boolean {
    const scores = getBuzzelloScores(board);
    if (scores.empty === 0 || scores.yellow === 0 || scores.black === 0) {
      return true;
    }
    return (
      getBuzzelloLegalMoves(board, "yellow").length === 0 &&
      getBuzzelloLegalMoves(board, "black").length === 0
    );
  }

  function resolveBuzzelloTurn(
    board: BuzzelloBoard,
    playerWhoMoved: BuzzelloPlayer,
  ): BuzzelloTurnResolution {
    const opponent = getBuzzelloOpponent(playerWhoMoved);
    if (isBuzzelloGameOver(board)) {
      return { nextPlayer: opponent, passedPlayer: null, gameOver: true };
    }
    if (getBuzzelloLegalMoves(board, opponent).length > 0) {
      return { nextPlayer: opponent, passedPlayer: null, gameOver: false };
    }
    return {
      nextPlayer: playerWhoMoved,
      passedPlayer: opponent,
      gameOver: false,
    };
  }

  function getBuzzelloPositionalWeight(index: number): number {
    if (CORNER_INDEX_SET.has(index)) return 100;
    if (DANGER_INDEX_SET.has(index)) return -30;
    const { q, r } = getBuzzelloCoordinate(index);
    const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
    return distance === BUZZELLO_BOARD_RADIUS ? 15 : 0;
  }

  function getPositionalDifference(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
  ): number {
    const opponent = getBuzzelloOpponent(player);
    let difference = 0;
    for (let index = 0; index < board.length; index += 1) {
      if (board[index] === player)
        difference += getBuzzelloPositionalWeight(index);
      if (board[index] === opponent)
        difference -= getBuzzelloPositionalWeight(index);
    }
    return difference;
  }

  function evaluateBuzzelloBoard(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
  ): number {
    const opponent = getBuzzelloOpponent(player);
    const scores = getBuzzelloScores(board);
    const playerPieces = scores[player];
    const opponentPieces = scores[opponent];
    const pieceDifference = playerPieces - opponentPieces;
    const mobilityDifference =
      getBuzzelloLegalMoves(board, player).length -
      getBuzzelloLegalMoves(board, opponent).length;
    const cornerDifference = BUZZELLO_CORNER_INDICES.reduce(
      (total, index) =>
        total +
        (board[index] === player ? 1 : board[index] === opponent ? -1 : 0),
      0,
    );
    const occupiedRatio = 1 - scores.empty / board.length;
    const parityWeight =
      occupiedRatio < 0.65 ? 1 : occupiedRatio < 0.85 ? 4 : 12;

    return (
      cornerDifference * 140 +
      getPositionalDifference(board, player) * 3 +
      mobilityDifference * 8 +
      pieceDifference * parityWeight
    );
  }

  function moveOrderingScore(move: BuzzelloMove): number {
    return getBuzzelloPositionalWeight(move.index) * 10 + move.flips.length;
  }

  function orderedMoves(moves: BuzzelloMove[]): BuzzelloMove[] {
    return [...moves].sort(
      (left, right) =>
        moveOrderingScore(right) - moveOrderingScore(left) ||
        left.index - right.index,
    );
  }

  function chooseEasyMove(
    moves: BuzzelloMove[],
    random: () => number,
  ): BuzzelloMove {
    if (random() < 0.35) {
      return moves[Math.floor(random() * moves.length) % moves.length];
    }
    return [...moves].sort(
      (left, right) =>
        right.flips.length - left.flips.length || left.index - right.index,
    )[0];
  }

  function chooseMediumMove(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    moves: BuzzelloMove[],
  ): BuzzelloMove {
    const opponent = getBuzzelloOpponent(player);
    let bestMove = moves[0];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const move of orderedMoves(moves)) {
      const afterMove = applyBuzzelloMove(board, player, move.index);
      const replies = getBuzzelloLegalMoves(afterMove, opponent);
      const score =
        replies.length === 0
          ? evaluateBuzzelloBoard(afterMove, player)
          : Math.min(
              ...replies.map((reply) =>
                evaluateBuzzelloBoard(
                  applyBuzzelloMove(afterMove, opponent, reply.index),
                  player,
                ),
              ),
            );
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  const SEARCH_TIMEOUT = Symbol("BUZZELLO_SEARCH_TIMEOUT");

  function terminalScore(
    board: BuzzelloBoard,
    maximizingPlayer: BuzzelloPlayer,
  ): number {
    const scores = getBuzzelloScores(board);
    const opponent = getBuzzelloOpponent(maximizingPlayer);
    return (scores[maximizingPlayer] - scores[opponent]) * 10_000;
  }

  function minimax(
    board: BuzzelloBoard,
    currentPlayer: BuzzelloPlayer,
    depth: number,
    alpha: number,
    beta: number,
    context: SearchContext,
  ): number {
    if (context.now() >= context.deadline) throw SEARCH_TIMEOUT;
    if (isBuzzelloGameOver(board)) {
      return terminalScore(board, context.maximizingPlayer);
    }
    if (depth === 0) {
      return evaluateBuzzelloBoard(board, context.maximizingPlayer);
    }

    const moves = orderedMoves(getBuzzelloLegalMoves(board, currentPlayer));
    const opponent = getBuzzelloOpponent(currentPlayer);
    if (moves.length === 0) {
      return minimax(board, opponent, depth, alpha, beta, context);
    }

    if (currentPlayer === context.maximizingPlayer) {
      let value = Number.NEGATIVE_INFINITY;
      for (const move of moves) {
        value = Math.max(
          value,
          minimax(
            applyBuzzelloMove(board, currentPlayer, move.index),
            opponent,
            depth - 1,
            alpha,
            beta,
            context,
          ),
        );
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    }

    let value = Number.POSITIVE_INFINITY;
    for (const move of moves) {
      value = Math.min(
        value,
        minimax(
          applyBuzzelloMove(board, currentPlayer, move.index),
          opponent,
          depth - 1,
          alpha,
          beta,
          context,
        ),
      );
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  function searchRoot(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    moves: BuzzelloMove[],
    depth: number,
    context: SearchContext,
  ): BuzzelloMove {
    let bestMove = moves[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    let alpha = Number.NEGATIVE_INFINITY;
    const opponent = getBuzzelloOpponent(player);

    for (const move of orderedMoves(moves)) {
      const score = minimax(
        applyBuzzelloMove(board, player, move.index),
        opponent,
        depth - 1,
        alpha,
        Number.POSITIVE_INFINITY,
        context,
      );
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
    }
    return bestMove;
  }

  function defaultNow(): number {
    return globalThis.performance?.now() ?? Date.now();
  }

  function chooseMasterMove(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    moves: BuzzelloMove[],
    options: BuzzelloAiOptions,
  ): BuzzelloMove {
    const scores = getBuzzelloScores(board);
    const solveEndgame = scores.empty <= 10;
    const now = options.now ?? defaultNow;
    const startedAt = now();
    const targetDepth =
      options.maxDepth ??
      (solveEndgame
        ? scores.empty
        : scores.empty > 40
          ? 4
          : scores.empty > 20
            ? 5
            : 6);
    const context: SearchContext = {
      maximizingPlayer: player,
      now,
      deadline: solveEndgame
        ? Number.POSITIVE_INFINITY
        : startedAt + (options.timeLimitMs ?? 850),
    };
    let bestMove = orderedMoves(moves)[0];
    const firstDepth = solveEndgame ? targetDepth : 2;

    for (let depth = firstDepth; depth <= targetDepth; depth += 1) {
      try {
        bestMove = searchRoot(board, player, moves, depth, context);
      } catch (error) {
        if (error !== SEARCH_TIMEOUT) throw error;
        break;
      }
    }

    return bestMove;
  }

  function selectBuzzelloAiMove(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    difficulty: BuzzelloDifficulty,
    options: BuzzelloAiOptions = {},
  ): BuzzelloMove | null {
    const moves = getBuzzelloLegalMoves(board, player);
    if (moves.length === 0) return null;
    if (difficulty === "easy") {
      return chooseEasyMove(moves, options.random ?? Math.random);
    }
    if (difficulty === "medium") {
      return chooseMediumMove(board, player, moves);
    }
    return chooseMasterMove(board, player, moves, options);
  }
  return {
    BUZZELLO_BOARD_RADIUS,
    BUZZELLO_CELL_COUNT,
    BUZZELLO_DIRECTIONS,
    BUZZELLO_COORDINATES,
    BUZZELLO_CORNER_INDICES,
    getBuzzelloCellIndex,
    getBuzzelloCoordinate,
    formatBuzzelloCoordinate,
    getBuzzelloOpponent,
    createBuzzelloInitialBoard,
    getBuzzelloFlips,
    getBuzzelloLegalMoves,
    applyBuzzelloMove,
    getBuzzelloScores,
    getBuzzelloWinner,
    isBuzzelloGameOver,
    resolveBuzzelloTurn,
    getBuzzelloPositionalWeight,
    evaluateBuzzelloBoard,
    selectBuzzelloAiMove,
  };
}

const classicRules = buildBuzzelloRules(61);
const largeRules = buildBuzzelloRules(91);
export function getBuzzelloRules(boardSize: number) {
  if (boardSize !== 61 && boardSize !== 91)
    throw new RangeError("Unsupported BUZZELLO board size");
  return boardSize === 91 ? largeRules : classicRules;
}

// Preserve the classic API for existing matches and callers.
export const {
  BUZZELLO_BOARD_RADIUS,
  BUZZELLO_CELL_COUNT,
  BUZZELLO_DIRECTIONS,
  BUZZELLO_COORDINATES,
  BUZZELLO_CORNER_INDICES,
  getBuzzelloCellIndex,
  getBuzzelloCoordinate,
  formatBuzzelloCoordinate,
  getBuzzelloOpponent,
  createBuzzelloInitialBoard,
  getBuzzelloFlips,
  getBuzzelloLegalMoves,
  applyBuzzelloMove,
  getBuzzelloScores,
  getBuzzelloWinner,
  isBuzzelloGameOver,
  resolveBuzzelloTurn,
  getBuzzelloPositionalWeight,
  evaluateBuzzelloBoard,
  selectBuzzelloAiMove,
} = classicRules;
