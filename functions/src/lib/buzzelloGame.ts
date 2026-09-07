import { getBuzzelloRules } from "../generated/games/buzzello";
export type {
  BuzzelloPlayer,
  BuzzelloCell,
  BuzzelloCoordinate,
  BuzzelloMove,
  BuzzelloBoardSize,
} from "../generated/games/buzzello";
import type {
  BuzzelloPlayer,
  BuzzelloCell,
  BuzzelloBoardSize,
} from "../generated/games/buzzello";
export type BuzzelloBoard = BuzzelloCell[];
export interface BuzzelloTurnResolution {
  currentPlayer: BuzzelloPlayer;
  gameOver: boolean;
  passedPlayer: BuzzelloPlayer | null;
  winner: BuzzelloPlayer | "draw" | null;
}
function buildServerRules(size: BuzzelloBoardSize) {
  const rules = getBuzzelloRules(size);
  function createBuzzelloInitialBoard(): BuzzelloBoard {
    return [...rules.createBuzzelloInitialBoard()];
  }
  function assertBuzzelloBoard(value: unknown): BuzzelloBoard {
    if (
      !Array.isArray(value) ||
      value.length !== size ||
      value.some(
        (cell) => cell !== null && cell !== "yellow" && cell !== "black",
      )
    )
      throw new Error("Invalid BUZZELLO board state.");
    return [...value] as BuzzelloBoard;
  }
  function getBuzzelloFlips(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    index: number,
  ) {
    return rules.getBuzzelloFlips(board, index, player);
  }
  function applyBuzzelloMove(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
    index: number,
  ) {
    const flips = getBuzzelloFlips(board, player, index);
    if (!flips.length) throw new Error("Illegal BUZZELLO move.");
    return { board: [...rules.applyBuzzelloMove(board, player, index)], flips };
  }
  function getBuzzelloScores(
    board: BuzzelloBoard,
  ): Record<BuzzelloPlayer, number> {
    const { yellow, black } = rules.getBuzzelloScores(board);
    return { yellow, black };
  }
  function resolveBuzzelloTurn(
    board: BuzzelloBoard,
    player: BuzzelloPlayer,
  ): BuzzelloTurnResolution {
    const turn = rules.resolveBuzzelloTurn(board, player);
    return {
      currentPlayer: turn.nextPlayer,
      gameOver: turn.gameOver,
      passedPlayer: turn.passedPlayer,
      winner: turn.gameOver ? rules.getBuzzelloWinner(board) : null,
    };
  }
  return {
    ...rules,
    BUZZELLO_MAX_MOVES: size - 6,
    createBuzzelloInitialBoard,
    assertBuzzelloBoard,
    getBuzzelloFlips,
    applyBuzzelloMove,
    getBuzzelloScores,
    resolveBuzzelloTurn,
  };
}
const classicRules = buildServerRules(61),
  largeRules = buildServerRules(91);
export function getBuzzelloServerRules(size: number) {
  if (size !== 61 && size !== 91)
    throw new RangeError("Unsupported BUZZELLO board size");
  return size === 91 ? largeRules : classicRules;
}
export const {
  BUZZELLO_CELL_COUNT,
  BUZZELLO_MAX_MOVES,
  BUZZELLO_COORDINATES,
  getBuzzelloCellIndex,
  getBuzzelloOpponent,
  getBuzzelloLegalMoves,
  getBuzzelloWinner,
  createBuzzelloInitialBoard,
  assertBuzzelloBoard,
  getBuzzelloFlips,
  applyBuzzelloMove,
  getBuzzelloScores,
  resolveBuzzelloTurn,
} = classicRules;
