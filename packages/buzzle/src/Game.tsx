import type { BuzzleClient } from "./online";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  BookOpen,
  Bot,
  BrainCircuit,
  Gauge,
  Radio,
  RotateCcw,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@ares/game-common/fullscreen";
import { DialogShell } from "@ares/ui/dialog";
import {
  BUZZLE_COORDINATES,
  analyzeBuzzlePlay,
  createBuzzleGame,
  exchangeBuzzleTiles,
  getBuzzleCellIndex,
  getBuzzleCoordinate,
  getBuzzleMultiplier,
  passBuzzleTurn,
  playBuzzleTiles,
  type BuzzleDifficulty,
  type BuzzleGameState,
  type BuzzlePlacement,
  type BuzzleTile,
} from "./rules";
import type { BuzzleAiMove } from "./ai";
import { loadBuzzleDictionary } from "./dictionary";
import { BuzzleWordHelp, type WordHelpRequest } from "./BuzzleWordHelp";
import { BuzzleHelpMode } from "./BuzzleHelpMode";
import type { BuzzleHint } from "./wordHelp";
import {
  BuzzleOnlineError,
  getOnlineBuzzlePollDelay,
  placementsToOnlineAction,
  type OnlineBuzzleGame,
  type OnlineBuzzleSession,
} from "./online";
import "./buzzle.css";

type BuzzleMode = "local" | "online" | BuzzleDifficulty;
type DictionaryState =
  | { status: "loading"; words: null }
  | { status: "ready"; words: ReadonlySet<string> }
  | { status: "error"; words: null };

const MODE_OPTIONS: ReadonlyArray<{
  id: BuzzleMode;
  name: string;
  detail: string;
  icon: typeof Users;
}> = [
  { id: "local", name: "Pass & Play", detail: "Two to four players share this device.", icon: Users },
  { id: "easy", name: "Worker Bee", detail: "A gentle AI limited to short, lower-scoring words.", icon: Bot },
  { id: "medium", name: "Swarm Guard", detail: "An AI that values useful multipliers and crossings.", icon: Gauge },
  { id: "master", name: "Queen Bee", detail: "A full-board trie search for the strongest legal play.", icon: BrainCircuit },
  { id: "online", name: "Online", detail: "Private codes and bounded matchmaking, without chat.", icon: Radio },
];

const MULTIPLIER_NAMES = {
  plain: "plain",
  DL: "double letter",
  TL: "triple letter",
  DW: "double word",
  TW: "triple word",
  star: "center star, double word on the opening play",
} as const;

function playerName(index: number, currentMode?: BuzzleMode): string {
  if (currentMode && currentMode !== "local" && currentMode !== "online") {
    return index === 0 ? "Player 1" : (MODE_OPTIONS.find(({ id }) => id === currentMode)?.name ?? "Hive AI");
  }
  return `Player ${index + 1}`;
}

function getBuzzleLeaderIndexes(game: BuzzleGameState): number[] {
  if (!game.finished) return [];
  const highScore = Math.max(...game.players.map(({ score }) => score));
  return game.players.flatMap(({ score }, index) => score === highScore ? [index] : []);
}

function formatPlayerNames(indexes: readonly number[], currentMode?: BuzzleMode): string {
  const names = indexes.map((index) => playerName(index, currentMode));
  if (names.length <= 1) return names[0] ?? "No player";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function getBuzzleEndSummary(game: BuzzleGameState, currentMode?: BuzzleMode): string {
  if (!game.finished || game.winner === null) return "";
  const leaders = getBuzzleLeaderIndexes(game);
  const high = game.players[leaders[0]!]!.score;
  if (game.winner === "draw") {
    return `Game over. ${formatPlayerNames(leaders, currentMode)} tied for first at ${high} points.`;
  }
  const winnerName = playerName(game.winner, currentMode);
  if (game.players.length === 2) {
    const otherScore = game.players[game.winner === 0 ? 1 : 0]!.score;
    return `Game over! ${winnerName} wins ${high} to ${otherScore}!`;
  }
  return `Game over! ${winnerName} wins with ${high} points.`;
}

function onlineGameSnapshot(game: OnlineBuzzleGame): BuzzleGameState {
  return {
    board: game.board,
    bag: Array.from({ length: game.bagCount }) as BuzzleTile[],
    players: game.players.map((player, index) => ({
      score: player.score,
      rack: index === game.playerIndex ? game.rack : [],
    })),
    currentPlayer: game.currentPlayer,
    turn: game.turn,
    consecutivePasses: game.consecutivePasses,
    finished: game.finished,
    winner: game.winner,
  };
}

function BuzzleTileFace({
  tile,
  compact = false,
}: {
  tile: BuzzleTile;
  compact?: boolean;
}) {
  return (
    <span className="buzzle-tile-face" data-compact={compact} data-points={tile.points}>
      <span className="buzzle-tile-letter">{tile.blank && tile.letter === "?" ? "" : tile.letter}</span>
      <span className="buzzle-tile-points">{tile.points}</span>
    </span>
  );
}

interface BoardProps {
  game: BuzzleGameState;
  placements: ReadonlyArray<BuzzlePlacement>;
  selectedTile: BuzzleTile | null;
  disabled: boolean;
  onPlace: (index: number, tileId?: string) => void;
  onRecall: (index: number) => void;
  preview: BuzzleHint | null;
  onInspect: (index: number, trigger: HTMLElement) => void;
}

function BuzzleBoardView({
  game,
  placements,
  selectedTile,
  disabled,
  onPlace,
  onRecall,
  preview,
  onInspect,
}: BoardProps) {
  const centerIndex = getBuzzleCellIndex(0, 0)!;
  const [focusedIndex, setFocusedIndex] = useState(centerIndex);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const draftByIndex = useMemo(
    () => new Map(placements.map((placement) => [placement.index, placement])),
    [placements],
  );

  const focusCell = useCallback((index: number) => {
    setFocusedIndex(index);
    cellRefs.current[index]?.focus();
  }, []);

  const moveFocus = useCallback((index: number, qDelta: number, rDelta: number) => {
    const coordinate = getBuzzleCoordinate(index);
    const next = getBuzzleCellIndex(coordinate.q + qDelta, coordinate.r + rDelta);
    if (next !== null) focusCell(next);
  }, [focusCell]);

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction = {
      ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[event.key];
    if (direction) {
      event.preventDefault();
      moveFocus(index, direction[0], direction[1]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusCell(centerIndex);
      return;
    }
    if (/^[a-z]$/iu.test(event.key) && !game.board[index] && !draftByIndex.has(index)) {
      const tile = game.players[game.currentPlayer].rack.find(
        (candidate) => candidate.letter === event.key.toUpperCase() || candidate.blank,
      );
      if (tile) {
        event.preventDefault();
        onPlace(index, tile.id);
      }
    }
  };

  return (
    <div className="buzzle-board-wrap">
      <div
        className="buzzle-board"
        role="grid"
        aria-label={`BUZZLE board. ${playerName(game.currentPlayer)} to move. Use arrow keys to move between cells. Select a rack tile, then press Enter on an empty cell; you can also type a rack letter.`}
      >
        {BUZZLE_COORDINATES.map(({ q, r }, index) => {
          const boardTile = game.board[index];
          const draft = draftByIndex.get(index);
          const ghost = preview?.placements.find((item) => item.index === index);
          const marker = ghost && !draft ? preview!.placements.indexOf(ghost) + 1 : undefined;
          const highlighted = preview?.indices.includes(index) ?? false;
          const multiplier = getBuzzleMultiplier(index);
          const canPlace = !disabled && !boardTile && !draft && selectedTile !== null;
          const left = 50 + q * (7.2 * 13 / 17);
          const top = 50 + (r + q / 2) * (96 / 17);
          const state = boardTile
            ? `${boardTile.letter}, ${boardTile.points} points, played by ${playerName(boardTile.playedBy)}`
            : draft
              ? `${draft.tile.letter}, pending placement`
              : `${MULTIPLIER_NAMES[multiplier]} cell${canPlace ? ", available for the selected tile" : ""}`;
          return (
            <button
              key={`${q},${r}`}
              ref={(element) => { cellRefs.current[index] = element; }}
              type="button"
              role="gridcell"
              tabIndex={focusedIndex === index ? 0 : -1}
              className="buzzle-cell"
              data-multiplier={multiplier}
              data-can-place={canPlace}
              data-occupied={Boolean(boardTile || draft)}
              data-draft={Boolean(draft)}
              data-hint={highlighted}
              data-preview-marker={marker}
              aria-label={`q ${q}, r ${r}: ${state}${boardTile ? ", select to inspect words" : ""}${ghost ? `, ${marker ? `marker ${marker}, ` : ""}preview ${ghost.assignedLetter ?? ghost.tile.letter}` : ""}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onFocus={() => setFocusedIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={(event) => {
                if (boardTile) onInspect(index, event.currentTarget);
                else if (draft) onRecall(index);
                else if (canPlace) onPlace(index);
              }}
              onDragOver={(event) => {
                if (!disabled && !boardTile && !draft) event.preventDefault();
              }}
              onDrop={(event: DragEvent<HTMLButtonElement>) => {
                event.preventDefault();
                onPlace(index, event.dataTransfer.getData("text/buzzle-tile"));
              }}
            >
              <span className="buzzle-cell-surface" aria-hidden="true">
                {boardTile ? (
                  <BuzzleTileFace tile={boardTile} compact />
                ) : draft ? (
                  <BuzzleTileFace tile={{ ...draft.tile, letter: draft.assignedLetter ?? draft.tile.letter }} compact />
                ) : ghost ? (
                  <span className="buzzle-preview-marker">{marker}</span>
                ) : multiplier === "star" ? (
                  <span className="buzzle-multiplier-mark">★</span>
                ) : multiplier !== "plain" ? (
                  <span className="buzzle-multiplier-mark">{multiplier}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BuzzlePage({ online }: { online: BuzzleClient }) {
  const { createOnlineBuzzleGame, joinOnlineBuzzleGame, findOnlineBuzzleMatch, findTeamBuzzleMatch, syncOnlineBuzzleGame, playOnlineBuzzleAction } = online;
  const fullscreen = useGameFullscreen();
  const inviteFromHash = useRef(
    typeof window === "undefined" ? null : window.location.hash.match(/^#join=([2-9A-HJ-NP-Z]{8})$/u)?.[1] ?? null,
  ).current;
  const [mode, setMode] = useState<BuzzleMode>("local");
  const [playerCount, setPlayerCount] = useState(2);
  const [game, setGame] = useState(() => createBuzzleGame(2));
  const [placements, setPlacements] = useState<BuzzlePlacement[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeSelection, setExchangeSelection] = useState<Set<string>>(new Set());
  const [dictionary, setDictionary] = useState<DictionaryState>({ status: "loading", words: null });
  const [dictionaryAttempt, setDictionaryAttempt] = useState(0);
  const [wordHelp, setWordHelp] = useState<WordHelpRequest | null>(null);
  const helpFocusRef = useRef<HTMLElement | null>(null);
  const [helpMode, setHelpMode] = useState(false);
  const [hintPreview, setHintPreview] = useState<{ key: string; hint: BuzzleHint | null } | null>(null);
  const [notice, setNotice] = useState("Select a rack tile, then choose a board cell.");
  const [newGameOpen, setNewGameOpen] = useState(inviteFromHash === null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [blankPlacement, setBlankPlacement] = useState<{ index: number; tile: BuzzleTile } | null>(null);
  const [handoffPending, setHandoffPending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const aiRequestId = useRef(0);
  const [onlineSetupOpen, setOnlineSetupOpen] = useState(inviteFromHash !== null);
  const [onlineGame, setOnlineGame] = useState<OnlineBuzzleGame | null>(null);
  const [onlineInviteCode, setOnlineInviteCode] = useState<string | null>(null);
  const [onlineShareLink, setOnlineShareLink] = useState<string | null>(null);
  const [onlineJoinCode, setOnlineJoinCode] = useState(inviteFromHash ?? "");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlinePollingStopped, setOnlinePollingStopped] = useState(false);
  const onlinePlayerToken = useRef<string | null>(null);
  const onlineGameRef = useRef<OnlineBuzzleGame | null>(null);

  const rack = useMemo(
    () => mode === "online" ? (onlineGame?.rack ?? []) : game.players[game.currentPlayer].rack,
    [game.currentPlayer, game.players, mode, onlineGame],
  );
  const selectedTile = rack.find(({ id }) => id === selectedTileId) ?? null;
  const aiTurn = mode !== "local" && mode !== "online" && game.currentPlayer === 1 && !game.finished;
  const onlineTurnBlocked = mode === "online" && (
    !onlineGame || onlineGame.status !== "active" || onlineGame.currentPlayer !== onlineGame.playerIndex || onlineBusy
  );
  const helpActive = helpMode && !handoffPending && !game.finished && !exchangeMode && !aiTurn && !onlineTurnBlocked && !newGameOpen;
  const helpPositionKey = JSON.stringify([game.turn, game.board, rack, game.currentPlayer]);
  const helpSearchKey = JSON.stringify([helpPositionKey, placements]);
  const visibleHint = helpActive && hintPreview?.key === helpPositionKey && placements.every((placement) =>
    hintPreview.hint?.placements.some((candidate) => candidate.index === placement.index && candidate.tile.id === placement.tile.id && candidate.assignedLetter === placement.assignedLetter),
  ) ? hintPreview.hint : null;
  const openWordHelp = (request: WordHelpRequest, trigger: HTMLElement) => {
    helpFocusRef.current = trigger;
    setWordHelp(request);
  };

  const resetDraft = useCallback(() => {
    setPlacements([]);
    setSelectedTileId(null);
    setExchangeMode(false);
    setExchangeSelection(new Set());
  }, []);

  const applyOnlineGame = useCallback((next: OnlineBuzzleGame) => {
    const wasFinished = onlineGameRef.current?.finished ?? false;
    onlineGameRef.current = next;
    setOnlineGame(next);
    const snapshot = onlineGameSnapshot(next);
    setGame(snapshot);
    setMode("online");
    setOnlineSetupOpen(false);
    setOnlinePollingStopped(false);
    resetDraft();
    if (snapshot.finished && !wasFinished) {
      setGameOverOpen(true);
    }
  }, [resetDraft]);

  useEffect(() => {
    let active = true;
    loadBuzzleDictionary()
      .then(({ words }) => {
        if (active) setDictionary({ status: "ready", words });
      })
      .catch(() => {
        if (active) setDictionary({ status: "error", words: null });
      });
    return () => { active = false; };
  }, [dictionaryAttempt]);

  useEffect(() => {
    if (!inviteFromHash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [inviteFromHash]);

  useEffect(() => {
    if (!aiTurn || !dictionary.words || handoffPending) return;
    const requestId = aiRequestId.current + 1;
    aiRequestId.current = requestId;
    const worker = new Worker(new URL("./buzzle-ai.worker.ts", import.meta.url), { type: "module" });
    setAiThinking(true);
    setNotice("The hive AI is searching all three word axes…");
    worker.addEventListener("message", (event: MessageEvent<{ requestId: number; move: BuzzleAiMove | null; error: string | null }>) => {
      if (event.data.requestId !== requestId) return;
      try {
        if (event.data.error) throw new Error(event.data.error);
        if (!event.data.move) {
          const next = passBuzzleTurn(game);
          setGame(next);
          if (next.finished) {
            const summary = getBuzzleEndSummary(next, mode);
            setNotice(`The hive AI found no legal word and passed. ${summary}`);
            setGameOverOpen(true);
          } else {
            setNotice("The hive AI found no legal word and passed.");
          }
        } else {
          const result = playBuzzleTiles(game, event.data.move.placements, dictionary.words);
          setGame(result.state);
          const playNotice = `The hive AI played ${result.analysis.words.map(({ word }) => word).join(" + ")} for ${result.analysis.score} points.`;
          if (result.state.finished) {
            const summary = getBuzzleEndSummary(result.state, mode);
            setNotice(`${playNotice} ${summary}`);
            setGameOverOpen(true);
          } else {
            setNotice(playNotice);
          }
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "The hive AI could not finish its turn.");
      } finally {
        setAiThinking(false);
        worker.terminate();
      }
    });
    worker.postMessage({ requestId, state: game, difficulty: mode });
    return () => worker.terminate();
  }, [aiTurn, dictionary.words, game, handoffPending, mode]);

  const analysis = useMemo(() => {
    if (!dictionary.words || placements.length === 0) return null;
    try {
      return { value: analyzeBuzzlePlay(game.board, placements, dictionary.words, game.currentPlayer), error: null };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : "That play is not valid." };
    }
  }, [dictionary.words, game.board, game.currentPlayer, placements]);

  const acceptOnlineSession = useCallback((session: OnlineBuzzleSession) => {
    onlinePlayerToken.current = session.playerToken;
    applyOnlineGame(session.game);
    setOnlineError(null);
    setNotice(session.game.status === "waiting" ? "Waiting for another player. You can leave this tab open." : "The online match is ready.");
  }, [applyOnlineGame]);

  const createOnlineGame = useCallback(async () => {
    setOnlineBusy(true); setOnlineError(null);
    try {
      const result = await createOnlineBuzzleGame();
      const share = new URL(window.location.href);
      share.hash = `join=${result.inviteCode}`;
      setOnlineInviteCode(result.inviteCode);
      setOnlineShareLink(share.toString());
      acceptOnlineSession(result);
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "The online match could not be created.");
    } finally { setOnlineBusy(false); }
  }, [acceptOnlineSession, createOnlineBuzzleGame]);

  const findOnlineMatch = useCallback(async (teamOnly = false) => {
    setOnlineBusy(true); setOnlineError(null);
    try {
      const result = teamOnly ? await findTeamBuzzleMatch() : await findOnlineBuzzleMatch();
      setOnlineInviteCode(null); setOnlineShareLink(null);
      acceptOnlineSession(result);
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "Matchmaking is temporarily unavailable.");
    } finally { setOnlineBusy(false); }
  }, [acceptOnlineSession, findOnlineBuzzleMatch, findTeamBuzzleMatch]);

  const joinOnlineGame = useCallback(async () => {
    setOnlineBusy(true); setOnlineError(null);
    try {
      const result = await joinOnlineBuzzleGame(onlineJoinCode);
      setOnlineInviteCode(null); setOnlineShareLink(null);
      acceptOnlineSession(result);
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "The online match could not be joined.");
    } finally { setOnlineBusy(false); }
  }, [acceptOnlineSession, onlineJoinCode, joinOnlineBuzzleGame]);

  useEffect(() => {
    if (mode !== "online" || !onlineGame?.gameId || onlinePollingStopped) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unchangedPolls = 0;
    const schedule = (known: OnlineBuzzleGame) => {
      const delay = getOnlineBuzzlePollDelay(known, unchangedPolls);
      if (delay === null || stopped) return;
      timer = setTimeout(async () => {
        const current = onlineGameRef.current;
        const token = onlinePlayerToken.current;
        if (!current || !token || stopped) return;
        try {
          const result = await syncOnlineBuzzleGame(current, token);
          if (result.unchanged) {
            unchangedPolls += 1;
            const refreshed = { ...current, syncsRemaining: result.syncsRemaining, expiresAt: result.expiresAt };
            onlineGameRef.current = refreshed;
            setOnlineGame(refreshed);
            schedule(refreshed);
          } else {
            unchangedPolls = 0;
            applyOnlineGame(result.game);
            setOnlineError(null);
            schedule(result.game);
          }
        } catch (error) {
          setOnlineError(error instanceof Error ? error.message : "The match could not be refreshed.");
          if (error instanceof BuzzleOnlineError && [401, 404, 410, 429].includes(error.status)) {
            setOnlinePollingStopped(true);
          } else if (!stopped) timer = setTimeout(() => schedule(current), 12_000);
        }
      }, delay);
    };
    const current = onlineGameRef.current;
    if (current) schedule(current);
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [applyOnlineGame, mode, onlineGame?.gameId, onlinePollingStopped, syncOnlineBuzzleGame]);

  const commitOnlineAction = useCallback(async (action: Parameters<typeof playOnlineBuzzleAction>[2]) => {
    const current = onlineGameRef.current;
    const token = onlinePlayerToken.current;
    if (!current || !token || current.status !== "active" || current.currentPlayer !== current.playerIndex) return null;
    setOnlineBusy(true); setOnlineError(null);
    try {
      const next = await playOnlineBuzzleAction(current, token, action);
      applyOnlineGame(next);
      return next;
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "The online action could not be submitted.");
      return null;
    } finally { setOnlineBusy(false); }
  }, [applyOnlineGame, playOnlineBuzzleAction]);

  const startGame = (nextMode: BuzzleMode, nextPlayers: number) => {
    if (nextMode === "online") {
      setNewGameOpen(false);
      setOnlineError(null);
      setOnlineSetupOpen(true);
      return;
    }
    const count = nextMode === "local" ? nextPlayers : 2;
    setMode(nextMode);
    setPlayerCount(count);
    setGame(createBuzzleGame(count));
    resetDraft();
    setHandoffPending(false);
    setOnlineGame(null);
    onlineGameRef.current = null;
    onlinePlayerToken.current = null;
    setNewGameOpen(false);
    setGameOverOpen(false);
    setNotice(`${playerName(0, nextMode)} opens. Build a word through the center star.`);
  };

  const addPlacement = useCallback((index: number, requestedTileId?: string) => {
    const tile = rack.find(({ id }) => id === (requestedTileId || selectedTileId));
    if (!tile || game.board[index] || placements.some((placement) => placement.index === index)) return;
    if (placements.some((placement) => placement.tile.id === tile.id)) return;
    if (tile.blank) {
      setBlankPlacement({ index, tile });
      return;
    }
    setPlacements((current) => [...current, { index, tile }]);
    setSelectedTileId(null);
  }, [game.board, placements, rack, selectedTileId]);

  const commitBlank = (letter: string) => {
    if (!blankPlacement) return;
    setPlacements((current) => [
      ...current,
      { index: blankPlacement.index, tile: blankPlacement.tile, assignedLetter: letter },
    ]);
    setBlankPlacement(null);
    setSelectedTileId(null);
  };

  const finishTurn = (next: BuzzleGameState, message: string) => {
    setGame(next);
    resetDraft();
    if (next.finished) {
      const summary = getBuzzleEndSummary(next, mode);
      setNotice(message ? `${message} ${summary}` : summary);
      setGameOverOpen(true);
    } else {
      setNotice(message);
      if (mode === "local") setHandoffPending(true);
    }
  };

  const submitPlay = async () => {
    if (!dictionary.words) return;
    try {
      if (mode === "online") {
        const next = await commitOnlineAction(placementsToOnlineAction(placements));
        if (next) setNotice(`${analysis?.value?.words.map(({ word }) => word).join(" + ") ?? "Word"} was accepted by the server.`);
        return;
      }
      const result = playBuzzleTiles(game, placements, dictionary.words);
      finishTurn(
        result.state,
        `${result.analysis.words.map(({ word }) => word).join(" + ")} scored ${result.analysis.score} points${result.analysis.hiveFlush ? " with a Hive Flush" : ""}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That play could not be submitted.");
    }
  };

  const exchangeTiles = async () => {
    try {
      if (mode === "online") {
        const count = exchangeSelection.size;
        const next = await commitOnlineAction({ type: "exchange", tileIds: [...exchangeSelection] });
        if (next) setNotice(`You exchanged ${count} tile${count === 1 ? "" : "s"}.`);
        return;
      }
      const next = exchangeBuzzleTiles(game, [...exchangeSelection]);
      finishTurn(next, `${playerName(game.currentPlayer)} exchanged ${exchangeSelection.size} tile${exchangeSelection.size === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Those tiles could not be exchanged.");
    }
  };

  const passTurn = async () => {
    if (mode === "online") {
      const next = await commitOnlineAction({ type: "pass" });
      if (next) setNotice("You passed.");
      return;
    }
    finishTurn(passBuzzleTurn(game), `${playerName(game.currentPlayer)} passed.`);
  };

  const shuffleRack = () => {
    if (mode === "online") {
      setOnlineGame((current) => current ? { ...current, rack: [...current.rack].sort(() => Math.random() - 0.5) } : current);
      setGame((current) => {
        const players = current.players.map((player) => ({ ...player, rack: [...player.rack] }));
        if (onlineGame) players[onlineGame.playerIndex].rack.sort(() => Math.random() - 0.5);
        return { ...current, players };
      });
      return;
    }
    setGame((current) => {
      const players = current.players.map((player) => ({ ...player, rack: [...player.rack] }));
      players[current.currentPlayer].rack.sort(() => Math.random() - 0.5);
      return { ...current, players };
    });
  };

  const startAnotherGame = () => {
    setGameOverOpen(false);
    if (mode === "online") {
      setOnlineError(null);
      setOnlineSetupOpen(true);
    } else {
      startGame(mode, playerCount);
    }
  };

  const resultLeaderIndexes = getBuzzleLeaderIndexes(game);
  const startAnotherGameLabel = mode === "online" ? "New online game" : "Rematch";

  return (
    <main
      ref={fullscreen.targetRef}
      className="game-fullscreen-target buzzle-shell min-h-screen px-2 pb-16 pt-20 text-marble sm:px-5 sm:pt-28 lg:px-8"
      data-game-fullscreen={fullscreen.isFullscreen || undefined}
    >
      
      <div className="mx-auto max-w-[1500px]">
        <header className="buzzle-hero mb-4 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-ares-gold">ARES Games · Three-axis word strategy</p>
              <h1 className="mt-2 font-heading text-4xl font-black text-white sm:text-6xl">BUZZLE™</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/75 sm:text-base">
                Build connected words across all three axes of a 217-cell hive. Every crossing scores.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className="buzzle-secondary-action" href="/buzzle/word-tools">Physical play tools</a>
              <button type="button" className="buzzle-secondary-action" onClick={(event) => openWordHelp({ tab: "two" }, event.currentTarget)}>Two-letter words</button>
              <button type="button" className="buzzle-secondary-action" onClick={(event) => openWordHelp({ tab: "dictionary" }, event.currentTarget)}>Dictionary</button>
              <GameFullscreenButton
                isFullscreen={fullscreen.isFullscreen}
                onToggle={fullscreen.toggleFullscreen}
                className="buzzle-secondary-action"
              />
              <button type="button" className="buzzle-secondary-action" onClick={() => setRulesOpen(true)}>
                <BookOpen aria-hidden="true" size={18} /> Rules
              </button>
              <button type="button" className="buzzle-primary-action" onClick={() => setNewGameOpen(true)}>
                <RotateCcw aria-hidden="true" size={18} /> New game
              </button>
            </div>
          </div>
        </header>

        <section className="buzzle-scoreboard mb-4 grid gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Player scores">
            {game.players.map((player, index) => {
              const isWinner = game.finished && game.winner === index;
              const isTie = game.finished && game.winner === "draw" && resultLeaderIndexes.includes(index);
              return (
                <div
                  key={index}
                  className="buzzle-player-score"
                  data-active={!game.finished && index === game.currentPlayer}
                  data-winner={isWinner || isTie}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{playerName(index, mode)}</span>
                    {isWinner && (
                      <span className="rounded bg-ares-gold/20 px-1 py-0.5 text-[9px] font-bold text-ares-gold shrink-0" role="status">
                        Winner
                      </span>
                    )}
                    {isTie && (
                      <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-bold text-marble/70 shrink-0" role="status">
                        Tie
                      </span>
                    )}
                  </div>
                  <strong>{player.score}</strong>
                  <small>{mode === "online" ? (onlineGame?.players[index]?.rackCount ?? 0) : player.rack.length} tiles</small>
                </div>
              );
            })}
          </div>
          <div className="text-right text-sm">
            <strong className="text-ares-gold">{mode === "online" ? (onlineGame?.bagCount ?? 0) : game.bag.length}</strong> in bag · Turn {game.turn}
          </div>
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="buzzle-arena min-w-0 rounded-2xl p-1.5 sm:p-4" aria-labelledby="buzzle-board-heading">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
              <div>
                <h2 id="buzzle-board-heading" className="font-heading text-lg font-black uppercase text-white">
                  {game.finished ? "Match Complete" : "Tournament hive"}
                </h2>
                <p className="text-xs text-marble/65">
                  {game.finished
                    ? game.winner === "draw"
                      ? "Game over · Draw at final score"
                      : `Game over · ${playerName(game.winner as number, mode)} wins!`
                    : mode === "online" && onlineGame?.status === "waiting"
                      ? "Waiting for an opponent"
                      : mode === "online"
                        ? `${onlineGame?.currentPlayer === onlineGame?.playerIndex ? "Your" : "Opponent's"} turn · Online`
                        : `${playerName(game.currentPlayer, mode)} to move · ${MODE_OPTIONS.find(({ id }) => id === mode)?.name}`}
                </p>
              </div>
              <div className="buzzle-live-score" role="status" aria-live="polite" data-valid={Boolean(analysis?.value)}>
                {game.finished ? "END" : analysis?.value ? `+${analysis.value.score}` : placements.length ? "—" : "0"}
                <small>{game.finished ? "final score" : analysis?.value ? analysis.value.words.map(({ word }) => word).join(" · ") : "turn score"}</small>
              </div>
            </div>
            <BuzzleBoardView
              game={game}
              placements={placements}
              selectedTile={selectedTile}
              disabled={handoffPending || game.finished || exchangeMode || aiTurn || onlineTurnBlocked}
              onPlace={addPlacement}
              onRecall={(index) => setPlacements((current) => current.filter((placement) => placement.index !== index))}
              preview={visibleHint}
              onInspect={(cell, trigger) => openWordHelp({ tab: "board", cell }, trigger)}
            />
            <div className="buzzle-help-bar">
              <button type="button" className="buzzle-secondary-action" aria-pressed={helpMode} onClick={() => { setHelpMode(!helpMode); setHintPreview(null); }}>Help Mode: {helpMode ? "on" : "off"}</button>
              <button type="button" className="buzzle-secondary-action" onClick={(event) => openWordHelp({ tab: "board" }, event.currentTarget)}>Words on board</button>
              <p className="text-xs text-marble/75">Help Mode finds legal two-letter placements with your rack.</p>
            </div>
            {helpActive && <BuzzleHelpMode key={helpSearchKey} board={game.board} rack={rack} draft={placements} words={dictionary.words} player={game.currentPlayer} initialPreview={visibleHint}
              onPreview={(hint) => setHintPreview({ key: helpPositionKey, hint })} onDefine={(word, trigger) => openWordHelp({ tab: "dictionary", word }, trigger)} />}
          </section>

          <aside className="space-y-3" aria-label="Turn controls">
            <section className="buzzle-panel rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-black uppercase text-white">
                    {game.finished
                      ? "Final rack"
                      : mode === "online"
                        ? "Your rack"
                        : `${playerName(game.currentPlayer, mode)} rack`}
                  </h2>
                  <p className="text-xs text-marble/60">
                    {game.finished
                      ? "Match finished. Unplayed tiles deducted and awarded."
                      : "Tap or drag a tile. Type a letter on a focused board cell."}
                  </p>
                </div>
                <button type="button" className="buzzle-icon-button" aria-label="Shuffle rack" disabled={game.finished} onClick={shuffleRack}>
                  <Shuffle aria-hidden="true" size={18} />
                </button>
              </div>
              <div className="buzzle-rack" role="list" aria-label={`${playerName(game.currentPlayer)} tiles`} data-hidden={aiTurn}>
                {rack.map((tile) => {
                  const used = placements.some((placement) => placement.tile.id === tile.id);
                  const selected = exchangeMode ? exchangeSelection.has(tile.id) : selectedTileId === tile.id;
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      role="listitem"
                      className="buzzle-rack-tile"
                      data-selected={selected}
                      data-used={used}
                      aria-pressed={selected}
                      aria-label={`${tile.blank ? "Blank" : tile.letter}, ${tile.points} points${used ? ", placed on board" : ""}`}
                      draggable={!used && !exchangeMode}
                      disabled={used || handoffPending || game.finished || aiTurn || onlineTurnBlocked}
                      onDragStart={(event) => event.dataTransfer.setData("text/buzzle-tile", tile.id)}
                      onClick={() => {
                        if (exchangeMode) {
                          setExchangeSelection((current) => {
                            const next = new Set(current);
                            if (next.has(tile.id)) next.delete(tile.id); else next.add(tile.id);
                            return next;
                          });
                        } else {
                          setSelectedTileId((current) => current === tile.id ? null : tile.id);
                        }
                      }}
                    >
                      <BuzzleTileFace tile={tile} />
                    </button>
                  );
                })}
              </div>
              {aiTurn && <p className="mt-3 text-center text-sm font-bold text-ares-gold" role="status">{aiThinking ? "AI searching the hive…" : "AI turn"}</p>}
            </section>

            <section className="buzzle-panel rounded-2xl p-4" aria-label={game.finished ? "Match complete" : "Turn actions"}>
              {game.finished ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-ares-gold/35 bg-ares-gold/10 p-3">
                    <Trophy className="h-6 w-6 shrink-0 text-ares-gold" aria-hidden="true" />
                    <div>
                      <h3 className="font-heading text-sm font-black uppercase text-white">
                        {game.winner === "draw"
                          ? "Hive Draw"
                          : `${playerName(game.winner as number, mode)} Wins!`}
                      </h3>
                      <p className="text-xs text-marble/80">
                        {getBuzzleEndSummary(game, mode)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-marble/80" role="status" aria-live="polite">
                    {onlineError ?? notice}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="buzzle-secondary-action"
                      onClick={() => setGameOverOpen(true)}
                    >
                      View results
                    </button>
                    <button
                      type="button"
                      className="buzzle-primary-action flex items-center justify-center gap-1.5"
                      onClick={startAnotherGame}
                    >
                      <RotateCcw aria-hidden="true" size={16} /> {startAnotherGameLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="min-h-12 text-sm leading-relaxed text-marble/80" role="status" aria-live="polite">
                    {onlineError ?? analysis?.error ?? notice}
                  </p>
                  <p className="mt-2 text-xs text-marble/55">
                    Dictionary: {dictionary.status === "ready" ? "255,472 filtered English words ready" : dictionary.status === "loading" ? "loading…" : "unavailable—retry with a connection"}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" className="buzzle-secondary-action" disabled={!placements.length || aiTurn || onlineTurnBlocked} onClick={resetDraft}>Recall</button>
                    <button
                      type="button"
                      className="buzzle-secondary-action"
                      data-active={exchangeMode}
                      disabled={aiTurn || onlineTurnBlocked}
                      onClick={() => { setExchangeMode((value) => !value); setPlacements([]); setSelectedTileId(null); }}
                    >
                      Exchange
                    </button>
                    <button type="button" className="buzzle-secondary-action" disabled={placements.length > 0 || exchangeMode || aiTurn || onlineTurnBlocked} onClick={() => void passTurn()}>Pass</button>
                    {exchangeMode ? (
                      <button type="button" className="buzzle-primary-action" disabled={exchangeSelection.size === 0 || onlineTurnBlocked} onClick={() => void exchangeTiles()}>Swap {exchangeSelection.size || ""}</button>
                    ) : (
                      <button type="button" className="buzzle-primary-action" disabled={!analysis?.value || dictionary.status !== "ready" || onlineTurnBlocked} onClick={() => void submitPlay()}>Submit</button>
                    )}
                  </div>
                </>
              )}
            </section>
            {mode === "online" && onlineGame && (
              <section className="buzzle-panel rounded-2xl p-4 text-sm text-marble/75" aria-label="Online match details">
                <h2 className="font-heading text-base font-black uppercase text-white">Private online match</h2>
                <p className="mt-2">You are {playerName(onlineGame.playerIndex)}. {onlineGame.status === "waiting" ? "Waiting for one opponent." : "No chat or public player profile is exposed."}</p>
                {onlineInviteCode && onlineGame.status === "waiting" && (
                  <div className="mt-3">
                    <p>Invite code: <strong className="text-ares-gold">{onlineInviteCode}</strong></p>
                    {onlineShareLink && (
                      <div className="mt-2 flex gap-2">
                        <input aria-label="Friend invite link" className="min-w-0 flex-1 rounded-lg border border-white/20 bg-obsidian px-2 text-xs text-white" readOnly value={onlineShareLink} />
                        <button type="button" className="buzzle-secondary-action" onClick={() => void navigator.clipboard?.writeText(onlineShareLink)}>Copy</button>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 text-xs">{onlineGame.syncsRemaining} bounded refreshes remain · expires {new Date(onlineGame.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
              </section>
            )}
          </aside>
        </div>
      </div>

      <DialogShell open={newGameOpen} onOpenChange={setNewGameOpen} title="Choose a BUZZLE game" description="Local play supports two to four people. Computer and online games use two players.">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map(({ id, name, detail, icon: Icon }) => (
            <button key={id} type="button" className="buzzle-mode-card" onClick={() => startGame(id, playerCount)}>
              <Icon aria-hidden="true" size={24} />
              <span><strong>{name}</strong><small>{detail}</small></span>
            </button>
          ))}
          <a href="/buzzle/word-tools" className="buzzle-mode-card">
            <BookOpen aria-hidden="true" size={24} />
            <span><strong>Physical play tools</strong><small>Word checker, dictionary, and two-letter list. Checker and list work offline after setup.</small></span>
          </a>
        </div>
        <label className="mt-4 block text-sm font-bold text-white" htmlFor="buzzle-player-count">Local players</label>
        <select id="buzzle-player-count" className="mt-2 min-h-11 w-full rounded-lg border border-white/25 bg-obsidian px-3 text-white" value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value))}>
          <option value={2}>2 players</option><option value={3}>3 players</option><option value={4}>4 players</option>
        </select>
      </DialogShell>

      <DialogShell
        open={onlineSetupOpen}
        onOpenChange={(open) => { if (!onlineBusy) setOnlineSetupOpen(open); }}
        title="Online BUZZLE"
        description="Choose bounded guest matchmaking or a private friend code. Online play has no chat, profiles, or permanent room history."
        showClose={!onlineBusy}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="buzzle-mode-card" disabled={onlineBusy} onClick={() => void findOnlineMatch(false)}>
            <Radio aria-hidden="true" size={24} /><span><strong>Find a guest</strong><small>Join the first available two-player match.</small></span>
          </button>
          <button type="button" className="buzzle-mode-card" disabled={onlineBusy} onClick={() => void findOnlineMatch(true)}>
            <Users aria-hidden="true" size={24} /><span><strong>Team matchmaking</strong><small>ARES members only; sign-in is required.</small></span>
          </button>
          <button type="button" className="buzzle-mode-card" disabled={onlineBusy} onClick={() => void createOnlineGame()}>
            <RotateCcw aria-hidden="true" size={24} /><span><strong>Create friend invite</strong><small>Share an eight-character code or link.</small></span>
          </button>
        </div>
        <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void joinOnlineGame(); }}>
          <label className="block text-sm font-bold text-white" htmlFor="buzzle-invite-code">Join with a code</label>
          <div className="mt-2 flex gap-2">
            <input
              id="buzzle-invite-code"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/25 bg-obsidian px-3 font-mono uppercase tracking-widest text-white"
              autoComplete="off"
              inputMode="text"
              maxLength={8}
              value={onlineJoinCode}
              onChange={(event) => setOnlineJoinCode(event.target.value.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/gu, "").slice(0, 8))}
            />
            <button type="submit" className="buzzle-primary-action min-w-20 shrink-0" disabled={onlineBusy || onlineJoinCode.length !== 8}>Join</button>
          </div>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-marble/60">
          A temporary match token stays only in this tab. The server validates every word and move, caps refreshes and actions, and shares no rack contents with the opponent.
        </p>
        {onlineBusy && <p className="mt-3 text-sm font-bold text-ares-gold" role="status">Connecting to the hive…</p>}
        {onlineError && <p className="mt-3 text-sm text-red-300" role="alert">{onlineError}</p>}
      </DialogShell>

      <DialogShell open={rulesOpen} onOpenChange={setRulesOpen} title="How to play BUZZLE" description="Words run straight across any of the hive's three axes.">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-marble/80">
          <li>The opening word uses at least two letters and covers the center star.</li>
          <li>Later plays form one gap-free line and connect to the existing hive.</li>
          <li>Every new two-letter-or-longer word on all three axes must be in the dictionary.</li>
          <li>Letter multipliers and word multipliers apply only when first covered. Using all seven rack tiles adds 50 points.</li>
          <li>Exchange tiles or pass instead of playing. Three full rounds of consecutive passes end the game.</li>
        </ol>
      </DialogShell>

      <DialogShell open={blankPlacement !== null} onOpenChange={(open) => { if (!open) setBlankPlacement(null); }} title="Choose the blank tile letter" description="The blank keeps a value of zero points.">
        <div className="grid grid-cols-6 gap-2">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
            <button key={letter} type="button" className="buzzle-letter-choice" onClick={() => commitBlank(letter)}>{letter}</button>
          ))}
        </div>
      </DialogShell>

      <DialogShell open={handoffPending} onOpenChange={() => undefined} showClose={false} title={`Pass to ${playerName(game.currentPlayer)}`} description="The rack stays hidden until the next player is ready.">
        <button type="button" className="buzzle-primary-action w-full" onClick={() => setHandoffPending(false)}>Reveal my rack</button>
      </DialogShell>

      <DialogShell
        open={gameOverOpen}
        onOpenChange={setGameOverOpen}
        title={
          game.winner === "draw"
            ? "The Hive is Balanced"
            : `${playerName(game.winner as number, mode)} Wins!`
        }
        description={getBuzzleEndSummary(game, mode)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="buzzle-secondary-action"
              onClick={() => setGameOverOpen(false)}
            >
              Review board
            </button>
            <button
              type="button"
              className="buzzle-primary-action flex items-center justify-center gap-1.5"
              onClick={startAnotherGame}
            >
              <RotateCcw aria-hidden="true" size={16} /> {startAnotherGameLabel}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            className="grid gap-2 sm:grid-cols-2"
          >
            {game.players.map((player, idx) => {
              const isWinner = game.winner === idx;
              const isTie = game.winner === "draw" && resultLeaderIndexes.includes(idx);
              const rackCount = mode === "online"
                ? (onlineGame?.players[idx]?.rackCount ?? 0)
                : player.rack.length;
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 text-center transition-all ${
                    isWinner
                      ? "border-ares-gold/50 bg-ares-gold/10 text-white shadow-lg shadow-ares-gold/10"
                      : "border-white/10 bg-white/5 text-marble/80"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-marble/60">
                    {playerName(idx, mode)}
                  </p>
                  <p className="mt-1 font-heading text-3xl font-black text-white">
                    {player.score}
                  </p>
                  <p className="mt-1 text-xs text-marble/70">
                    {isWinner
                      ? "Winner"
                      : isTie
                        ? "Tied for first"
                        : `${rackCount} tile${rackCount === 1 ? "" : "s"} left`}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-marble/55">
            Remaining tile values were deducted from player racks and awarded to the player who went out.
          </p>
        </div>
      </DialogShell>
      {wordHelp && !handoffPending && !newGameOpen && !onlineSetupOpen && !gameOverOpen && <BuzzleWordHelp request={wordHelp} words={dictionary.words} board={game.board}
        loading={dictionary.status === "loading"} onRetry={() => { setDictionary({ status: "loading", words: null }); setDictionaryAttempt((attempt) => attempt + 1); }}
        onClose={() => setWordHelp(null)} returnFocusRef={helpFocusRef} />}
    </main>
  );
}
