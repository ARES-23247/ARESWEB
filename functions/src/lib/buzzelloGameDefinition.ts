import { ApiError } from "../middleware/errorHandler";
import {
  getBuzzelloServerRules,
  type BuzzelloBoardSize,
  getBuzzelloScores,
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

function parseHistoryEntry(
  value: unknown,
  cellCount: number,
): BuzzelloHistoryEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<BuzzelloHistoryEntry>;
  if (
    (entry.player !== "yellow" && entry.player !== "black") ||
    !Number.isSafeInteger(entry.index) ||
    (entry.index as number) < 0 ||
    (entry.index as number) >= cellCount ||
    !Number.isSafeInteger(entry.flippedCount) ||
    (entry.flippedCount as number) < 1 ||
    (entry.flippedCount as number) >= cellCount
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
  const rules = getBuzzelloServerRules(
    Array.isArray(data.board) ? data.board.length : 0,
  );
  const board = rules.assertBuzzelloBoard(data.board);
  const cellCount = board.length;
  const history = Array.isArray(data.history)
    ? data.history.map((entry) => parseHistoryEntry(entry, cellCount))
    : [];
  const lastMoveEntry = parseHistoryEntry(data.lastMove, cellCount);
  const flipped = data.lastMove?.flipped;
  if (
    (data.currentPlayer !== "yellow" && data.currentPlayer !== "black") ||
    !Number.isSafeInteger(data.moveNumber) ||
    (data.moveNumber as number) < 0 ||
    (data.moveNumber as number) > cellCount - 6 ||
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
            (index as number) >= cellCount,
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

export function createBuzzelloGameDefinition(
  boardSize: BuzzelloBoardSize = 61,
): GameDefinition<
  BuzzelloGameState,
  BuzzelloAction,
  BuzzelloPlayerView,
  BuzzelloPlayer
> {
  const initialRules = getBuzzelloServerRules(boardSize);
  return {
    gameType: "buzzello",
    minPlayers: 2,
    maxPlayers: 2,
    defaultMatchSize: 2,
    maxActions: 85,
    matchmakingVariant: boardSize === 91 ? "large" : undefined,
    actionPolicy: "sequential",
    createInitialState: () => ({
      board: initialRules.createBuzzelloInitialBoard(),
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
      const rules = getBuzzelloServerRules(state.board.length);
      let applied: ReturnType<typeof rules.applyBuzzelloMove>;
      try {
        applied = rules.applyBuzzelloMove(state.board, player, action.index);
      } catch {
        throw new ApiError(
          400,
          "That is not a legal move.",
          "BUZZELLO_ILLEGAL_MOVE",
        );
      }
      const resolution = rules.resolveBuzzelloTurn(applied.board, player);
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
}

export const buzzelloGameDefinition = createBuzzelloGameDefinition();
