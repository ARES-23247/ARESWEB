import * as rules from "../generated/games/buzzello";
export { BUZZELLO_CELL_COUNT, BUZZELLO_COORDINATES, getBuzzelloCellIndex,
  getBuzzelloOpponent, getBuzzelloLegalMoves, getBuzzelloWinner } from "../generated/games/buzzello";
export type { BuzzelloPlayer, BuzzelloCell, BuzzelloCoordinate, BuzzelloMove } from "../generated/games/buzzello";
import type { BuzzelloPlayer, BuzzelloCell } from "../generated/games/buzzello";
const { BUZZELLO_CELL_COUNT } = rules;
export const BUZZELLO_MAX_MOVES = 55;
export type BuzzelloBoard = BuzzelloCell[];
export interface BuzzelloTurnResolution {
  currentPlayer: BuzzelloPlayer;
  gameOver: boolean;
  passedPlayer: BuzzelloPlayer | null;
  winner: BuzzelloPlayer | "draw" | null;
}
export function createBuzzelloInitialBoard(): BuzzelloBoard {
  return [...rules.createBuzzelloInitialBoard()];
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


export function getBuzzelloFlips(board: BuzzelloBoard, player: BuzzelloPlayer, index: number): number[] {
  return rules.getBuzzelloFlips(board, index, player);
}
export function applyBuzzelloMove(board: BuzzelloBoard, player: BuzzelloPlayer, index: number) {
  const flips = getBuzzelloFlips(board, player, index);
  if (flips.length === 0) throw new Error("Illegal BUZZELLO move.");
  return { board: [...rules.applyBuzzelloMove(board, player, index)], flips };
}
export function getBuzzelloScores(board: BuzzelloBoard): Record<BuzzelloPlayer, number> {
  const { yellow, black } = rules.getBuzzelloScores(board);
  return { yellow, black };
}
export function resolveBuzzelloTurn(board: BuzzelloBoard, playerWhoMoved: BuzzelloPlayer): BuzzelloTurnResolution {
  const turn = rules.resolveBuzzelloTurn(board, playerWhoMoved);
  return { currentPlayer: turn.nextPlayer, gameOver: turn.gameOver,
    passedPlayer: turn.passedPlayer, winner: turn.gameOver ? rules.getBuzzelloWinner(board) : null };
}
