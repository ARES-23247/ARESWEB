import { ApiError } from "../middleware/errorHandler";
import {
  BUZZELLO_MAX_MOVES,
  applyBuzzelloMove,
  assertBuzzelloBoard,
  createBuzzelloInitialBoard,
  getBuzzelloScores,
  resolveBuzzelloTurn,
  type BuzzelloBoard,
  type BuzzelloPlayer,
} from "./buzzelloGame";
import type { GameDefinition } from "./gameMatches";

interface BuzzelloHistoryEntry {
  player: BuzzelloPlayer;
  index: number;
  flippedCount: number;
}

export interface BuzzelloGameState {
  board: BuzzelloBoard;
  currentPlayer: BuzzelloPlayer;
  moveNumber: number;
  history: BuzzelloHistoryEntry[];
  winner: BuzzelloPlayer | "draw" | null;
  lastMove: (BuzzelloHistoryEntry & { flipped: number[] }) | null;
  passedPlayer: BuzzelloPlayer | null;
}

export interface BuzzelloAction {
  index: number;
}

type BuzzelloPlayerView = Record<string, unknown> & {
  board: BuzzelloBoard;
  currentPlayer: BuzzelloPlayer;
  moveNumber: number;
  history: BuzzelloHistoryEntry[];
  winner: BuzzelloPlayer | "draw" | null;
  lastMove: BuzzelloGameState["lastMove"];
  passedPlayer: BuzzelloPlayer | null;
  scores: Record<BuzzelloPlayer, number>;
};

function parseHistoryEntry(value: unknown): BuzzelloHistoryEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<BuzzelloHistoryEntry>;
  if (
    (entry.player !== "yellow" && entry.player !== "black") ||
    !Number.isSafeInteger(entry.index) ||
    (entry.index as number) < 0 ||
    (entry.index as number) >= 61 ||
    !Number.isSafeInteger(entry.flippedCount) ||
    (entry.flippedCount as number) < 1 ||
    (entry.flippedCount as number) >= 61
  ) {
    return null;
  }
  return {
    player: entry.player,
    index: entry.index as number,
    flippedCount: entry.flippedCount as number,
  };
}

export function parseBuzzelloGameState(value: unknown): BuzzelloGameState {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid BUZZELLO state.");
  }
  const data = value as Partial<BuzzelloGameState>;
  const board = assertBuzzelloBoard(data.board);
  const history = Array.isArray(data.history)
    ? data.history.map(parseHistoryEntry)
    : [];
  const lastMoveEntry = parseHistoryEntry(data.lastMove);
  const flipped = data.lastMove?.flipped;
  if (
    (data.currentPlayer !== "yellow" && data.currentPlayer !== "black") ||
    !Number.isSafeInteger(data.moveNumber) ||
    (data.moveNumber as number) < 0 ||
    (data.moveNumber as number) > BUZZELLO_MAX_MOVES ||
    history.length !== data.moveNumber ||
    history.some((entry) => entry === null) ||
    (data.winner !== null &&
      data.winner !== "draw" &&
      data.winner !== "yellow" &&
      data.winner !== "black") ||
    (data.passedPlayer !== null &&
      data.passedPlayer !== "yellow" &&
      data.passedPlayer !== "black") ||
    (data.lastMove !== null &&
      (!lastMoveEntry ||
        !Array.isArray(flipped) ||
        flipped.length < 1 ||
        flipped.some(
          (index) =>
            !Number.isSafeInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= 61,
        )))
  ) {
    throw new Error("Invalid BUZZELLO state.");
  }
  return {
    board,
    currentPlayer: data.currentPlayer,
    moveNumber: data.moveNumber as number,
    history: history as BuzzelloHistoryEntry[],
    winner: data.winner,
    lastMove:
      data.lastMove === null
        ? null
        : { ...lastMoveEntry!, flipped: [...flipped!] as number[] },
    passedPlayer: data.passedPlayer,
  };
}

export const buzzelloGameDefinition: GameDefinition<
  BuzzelloGameState,
  BuzzelloAction,
  BuzzelloPlayerView,
  BuzzelloPlayer
> = {
  gameType: "buzzello",
  minPlayers: 2,
  maxPlayers: 2,
  defaultMatchSize: 2,
  maxActions: BUZZELLO_MAX_MOVES,
  actionPolicy: "sequential",
  createInitialState: () => ({
    board: createBuzzelloInitialBoard(),
    currentPlayer: "yellow",
    moveNumber: 0,
    history: [],
    winner: null,
    lastMove: null,
    passedPlayer: null,
  }),
  parseState: parseBuzzelloGameState,
  activePlayerIndex: (state) => (state.currentPlayer === "yellow" ? 0 : 1),
  applyAction: (state, playerIndex, action) => {
    const player: BuzzelloPlayer = playerIndex === 0 ? "yellow" : "black";
    let applied: ReturnType<typeof applyBuzzelloMove>;
    try {
      applied = applyBuzzelloMove(state.board, player, action.index);
    } catch {
      throw new ApiError(
        400,
        "That is not a legal move.",
        "BUZZELLO_ILLEGAL_MOVE",
      );
    }
    const resolution = resolveBuzzelloTurn(applied.board, player);
    const historyEntry: BuzzelloHistoryEntry = {
      player,
      index: action.index,
      flippedCount: applied.flips.length,
    };
    return {
      board: applied.board,
      currentPlayer: resolution.currentPlayer,
      moveNumber: state.moveNumber + 1,
      history: [...state.history, historyEntry],
      winner: resolution.winner,
      lastMove: { ...historyEntry, flipped: applied.flips },
      passedPlayer: resolution.passedPlayer,
    };
  },
  isFinished: (state) => state.winner !== null,
  playerLabel: (playerIndex) => (playerIndex === 0 ? "yellow" : "black"),
  toPlayerView: (state) => ({
    board: state.board,
    currentPlayer: state.currentPlayer,
    moveNumber: state.moveNumber,
    history: state.history,
    winner: state.winner,
    lastMove: state.lastMove,
    passedPlayer: state.passedPlayer,
    scores: getBuzzelloScores(state.board),
  }),
};
