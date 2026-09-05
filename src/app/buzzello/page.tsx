import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Bot,
  BrainCircuit,
  CircleHelp,
  Gauge,
  History,
  Radio,
  Redo2,
  RotateCcw,
  Trophy,
  Undo2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@/components/games/GameFullscreen";
import { Button, IconButton } from "@/components/ui/Button";
import { DialogShell, Drawer } from "@/components/ui/Dialog";
import {
  BUZZELLO_COORDINATES,
  applyBuzzelloMove,
  createBuzzelloInitialBoard,
  formatBuzzelloCoordinate,
  getBuzzelloCellIndex,
  getBuzzelloLegalMoves,
  getBuzzelloScores,
  getBuzzelloWinner,
  resolveBuzzelloTurn,
  selectBuzzelloAiMove,
  type BuzzelloBoard,
  type BuzzelloDifficulty,
  type BuzzelloPlayer,
} from "@/lib/buzzello";
import {
  BuzzelloOnlineError,
  createOnlineBuzzelloGame,
  findOnlineBuzzelloMatch,
  findTeamBuzzelloMatch,
  getOnlineBuzzelloPollDelay,
  joinOnlineBuzzelloGame,
  playOnlineBuzzelloMove,
  syncOnlineBuzzelloGame,
  type OnlineBuzzelloGame,
} from "@/lib/buzzelloOnline";
import "./buzzello.css";

type BuzzelloMode = "local" | "online" | BuzzelloDifficulty;
type SoundKind = "place" | "flip" | "victory";

interface BuzzelloHistoryEntry {
  player: BuzzelloPlayer;
  index: number;
  flippedCount: number;
  passedPlayer: BuzzelloPlayer | null;
}

interface BuzzelloSnapshot {
  board: BuzzelloBoard;
  currentPlayer: BuzzelloPlayer;
  gameOver: boolean;
  history: BuzzelloHistoryEntry[];
  lastFlipped: number[];
  notice: string;
}

interface BuzzelloAiResponse {
  requestId: number;
  moveIndex: number | null;
}

const MODE_DETAILS: ReadonlyArray<{
  id: BuzzelloMode;
  name: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    id: "local",
    name: "Pass & Play",
    description: "Two players share this device. Yellow moves first.",
    icon: Users,
  },
  {
    id: "online",
    name: "Private Online",
    description:
      "Find a guest or invite a friend by link or code. There is no chat or public lobby.",
    icon: Radio,
  },
  {
    id: "easy",
    name: "Rookie AI",
    description: "A relaxed opponent that mixes greedy and random moves.",
    icon: Bot,
  },
  {
    id: "medium",
    name: "Tactical AI",
    description: "A two-ply opponent that values corners, edges, and mobility.",
    icon: Gauge,
  },
  {
    id: "master",
    name: "Master AI",
    description:
      "Iterative minimax with alpha-beta pruning and an endgame solver.",
    icon: BrainCircuit,
  },
];

function playerName(player: BuzzelloPlayer): string {
  return player === "yellow" ? "Yellow" : "Black";
}

function createStartingSnapshot(): BuzzelloSnapshot {
  return {
    board: createBuzzelloInitialBoard(),
    currentPlayer: "yellow",
    gameOver: false,
    history: [],
    lastFlipped: [],
    notice: "Yellow opens. Choose any glowing legal cell.",
  };
}

function onlineGameSnapshot(game: OnlineBuzzelloGame): BuzzelloSnapshot {
  const gameOver = game.status === "finished";
  const notice =
    game.status === "waiting"
      ? "Waiting for another player to join."
      : gameOver
        ? "No legal moves remain. Final score locked."
        : game.currentPlayer === game.youAre
          ? `Your turn as ${playerName(game.youAre)}.`
          : `Waiting for ${playerName(game.currentPlayer)} to move.`;
  return {
    board: game.board,
    currentPlayer: game.currentPlayer,
    gameOver,
    history: game.history.map((entry, index) => ({
      ...entry,
      passedPlayer:
        index === game.history.length - 1 ? game.passedPlayer : null,
    })),
    lastFlipped: game.lastMove?.flipped ?? [],
    notice,
  };
}

function modeName(mode: BuzzelloMode): string {
  return MODE_DETAILS.find((item) => item.id === mode)?.name ?? "Pass & Play";
}

function useBuzzelloAudio(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    },
    [],
  );

  return useCallback(
    (kind: SoundKind) => {
      if (!enabled || typeof AudioContext === "undefined") return;
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      const start = context.currentTime;

      const tone = (
        frequency: number,
        offset: number,
        duration: number,
        type: OscillatorType,
      ) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.11, start + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + offset + duration,
        );
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + duration + 0.02);
      };

      if (kind === "place") tone(190, 0, 0.09, "square");
      if (kind === "flip") {
        tone(330, 0, 0.12, "triangle");
        tone(520, 0.06, 0.14, "sine");
      }
      if (kind === "victory") {
        [392, 523, 659, 784].forEach((frequency, index) =>
          tone(frequency, index * 0.11, 0.26, "triangle"),
        );
      }
    },
    [enabled],
  );
}

const TILE_ARTWORK: Record<BuzzelloPlayer, string> = {
  yellow: "/images/games/biobuzz-tile-yellow.png",
  black: "/images/games/biobuzz-tile-black.png",
};

function TileArtwork({
  player,
  className = "",
}: {
  player: BuzzelloPlayer;
  className?: string;
}) {
  return (
    <img
      aria-hidden="true"
      className={className}
      src={TILE_ARTWORK[player]}
      alt=""
      draggable={false}
    />
  );
}

function ScorePiece({ player }: { player: BuzzelloPlayer }) {
  return (
    <span
      className="buzzello-score-piece"
      data-player={player}
      aria-hidden="true"
    >
      <TileArtwork player={player} className="buzzello-tile-art" />
    </span>
  );
}

interface BuzzelloBoardViewProps {
  board: BuzzelloBoard;
  currentPlayer: BuzzelloPlayer;
  legalMoveFlips: ReadonlyMap<number, number[]>;
  lastFlipped: number[];
  disabled: boolean;
  onMove: (index: number) => void;
}

function BuzzelloBoardView({
  board,
  currentPlayer,
  legalMoveFlips,
  lastFlipped,
  disabled,
  onMove,
}: BuzzelloBoardViewProps) {
  const centerIndex = getBuzzelloCellIndex(0, 0) ?? 0;
  const [focusedIndex, setFocusedIndex] = useState(centerIndex);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previewFlips = new Set(
    previewIndex === null ? [] : (legalMoveFlips.get(previewIndex) ?? []),
  );
  const justFlipped = new Set(lastFlipped);

  const moveFocus = (index: number, qDelta: number, rDelta: number) => {
    const coordinate = BUZZELLO_COORDINATES[index];
    const nextIndex = getBuzzelloCellIndex(
      coordinate.q + qDelta,
      coordinate.r + rDelta,
    );
    if (nextIndex === null) return;
    setFocusedIndex(nextIndex);
    cellRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const direction = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[event.key];
    if (direction) {
      event.preventDefault();
      moveFocus(index, direction[0], direction[1]);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setFocusedIndex(centerIndex);
      cellRefs.current[centerIndex]?.focus();
    }
  };

  return (
    <div className="buzzello-board-wrap" tabIndex={-1}>
      <div
        className="buzzello-board mx-auto w-full max-w-[760px] rounded-2xl"
        role="grid"
        aria-label={`BUZZELLO board. ${playerName(currentPlayer)} to move. Use arrow keys to move between cells and Enter or Space to play a legal move.`}
      >
        {BUZZELLO_COORDINATES.map(({ q, r }, index) => {
          const player = board[index];
          const flips = legalMoveFlips.get(index) ?? [];
          const isLegal = !disabled && flips.length > 0;
          const isCenter = q === 0 && r === 0;
          const cellState = player
            ? `${playerName(player)} piece`
            : isLegal
              ? `empty, legal move, flips ${flips.length} ${flips.length === 1 ? "piece" : "pieces"}`
              : isCenter
                ? "open center, empty"
                : "empty";
          // Preserve the regular flat-top geometry inside a 2% safety inset.
          // A radius-4 grid spans 14 hex radii wide and 9√3 radii tall.
          const left = 50 + q * (72 / 7);
          const top = 50 + (r + q / 2) * (32 / 3);

          return (
            <button
              key={`${q},${r}`}
              ref={(element) => {
                cellRefs.current[index] = element;
              }}
              type="button"
              role="gridcell"
              tabIndex={focusedIndex === index ? 0 : -1}
              aria-label={`${formatBuzzelloCoordinate(index)}: ${cellState}`}
              aria-disabled={!isLegal}
              data-legal={isLegal}
              className="buzzello-cell"
              style={{ left: `${left}%`, top: `${top}%` }}
              onFocus={() => setFocusedIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onClick={() => {
                if (isLegal) onMove(index);
              }}
              onPointerEnter={() => {
                if (isLegal) setPreviewIndex(index);
              }}
              onPointerLeave={() => setPreviewIndex(null)}
            >
              <span className="buzzello-cell-surface" aria-hidden="true">
                {player ? (
                  <span
                    className="buzzello-piece"
                    data-player={player}
                    data-preview={previewFlips.has(index)}
                    data-just-flipped={justFlipped.has(index)}
                  >
                    <span className="buzzello-piece-face" data-face={player}>
                      <TileArtwork
                        player={player}
                        className="buzzello-tile-art"
                      />
                    </span>
                  </span>
                ) : isLegal ? (
                  <span className="buzzello-valid-ring" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BuzzelloPage() {
  const fullscreen = useGameFullscreen();
  const [mode, setMode] = useState<BuzzelloMode>("medium");
  const [timeline, setTimeline] = useState<BuzzelloSnapshot[]>(() => [
    createStartingSnapshot(),
  ]);
  const [cursor, setCursor] = useState(0);
  const [newGameOpen, setNewGameOpen] = useState(true);
  const [onlineSetupOpen, setOnlineSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const [onlineGame, setOnlineGame] = useState<OnlineBuzzelloGame | null>(null);
  const [onlineInviteCode, setOnlineInviteCode] = useState<string | null>(null);
  const [onlineShareLink, setOnlineShareLink] = useState<string | null>(null);
  const [onlineCopyStatus, setOnlineCopyStatus] = useState<string | null>(null);
  const [onlineJoinCode, setOnlineJoinCode] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlinePollingStopped, setOnlinePollingStopped] = useState(false);
  const onlinePlayerTokenRef = useRef<string | null>(null);
  const onlineGameRef = useRef<OnlineBuzzelloGame | null>(null);
  const aiRequestRef = useRef(0);
  const rulesTriggerRef = useRef<HTMLButtonElement>(null);
  const current = timeline[cursor];
  const scores = getBuzzelloScores(current.board);
  const legalMoves = useMemo(
    () => getBuzzelloLegalMoves(current.board, current.currentPlayer),
    [current.board, current.currentPlayer],
  );
  const legalMoveFlips = useMemo(
    () => new Map(legalMoves.map((move) => [move.index, move.flips])),
    [legalMoves],
  );
  const playSound = useBuzzelloAudio(soundEnabled);
  const isOnlineMode = mode === "online";
  const isAiMode = mode !== "local" && mode !== "online";
  const isAiTurn =
    isAiMode && current.currentPlayer === "black" && !current.gameOver;

  useEffect(() => {
    const inviteMatch = window.location.hash.match(
      /^#join=([2-9A-HJ-NP-Z]{8})$/u,
    );
    if (!inviteMatch) return;
    setOnlineJoinCode(inviteMatch[1]);
    setNewGameOpen(false);
    setOnlineSetupOpen(true);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  const startGame = useCallback((nextMode: BuzzelloMode) => {
    if (nextMode === "online") return;
    setMode(nextMode);
    setTimeline([createStartingSnapshot()]);
    setCursor(0);
    setAiThinking(false);
    setGameOverOpen(false);
    setHistoryOpen(false);
    setNewGameOpen(false);
    setOnlineGame(null);
    setOnlineInviteCode(null);
    setOnlineShareLink(null);
    setOnlineCopyStatus(null);
    setOnlineError(null);
    onlinePlayerTokenRef.current = null;
    onlineGameRef.current = null;
  }, []);

  const applyOnlineGame = useCallback((game: OnlineBuzzelloGame) => {
    setMode("online");
    onlineGameRef.current = game;
    setOnlineGame(game);
    setTimeline([onlineGameSnapshot(game)]);
    setCursor(0);
    setGameOverOpen(game.status === "finished");
    setNewGameOpen(false);
    setOnlineSetupOpen(false);
    setOnlinePollingStopped(false);
  }, []);

  const createOnlineGame = useCallback(async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const result = await createOnlineBuzzelloGame();
      onlinePlayerTokenRef.current = result.playerToken;
      setOnlineInviteCode(result.inviteCode);
      const shareUrl = new URL("/buzzello", window.location.origin);
      shareUrl.hash = `join=${result.inviteCode}`;
      setOnlineShareLink(shareUrl.toString());
      setOnlineCopyStatus(null);
      applyOnlineGame(result.game);
    } catch (error) {
      setOnlineError(
        error instanceof Error
          ? error.message
          : "The online match could not be created.",
      );
    } finally {
      setOnlineBusy(false);
    }
  }, [applyOnlineGame]);

  const findOnlineMatch = useCallback(async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const result = await findOnlineBuzzelloMatch();
      onlinePlayerTokenRef.current = result.playerToken;
      setOnlineInviteCode(null);
      setOnlineShareLink(null);
      setOnlineCopyStatus(null);
      applyOnlineGame(result.game);
    } catch (error) {
      setOnlineError(
        error instanceof Error
          ? error.message
          : "A quick match could not be started.",
      );
    } finally {
      setOnlineBusy(false);
    }
  }, [applyOnlineGame]);

  const findTeamMatch = useCallback(async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const result = await findTeamBuzzelloMatch();
      onlinePlayerTokenRef.current = result.playerToken;
      setOnlineInviteCode(null);
      setOnlineShareLink(null);
      setOnlineCopyStatus(null);
      applyOnlineGame(result.game);
    } catch (error) {
      setOnlineError(
        error instanceof Error
          ? error.message
          : "A team match could not be started.",
      );
    } finally {
      setOnlineBusy(false);
    }
  }, [applyOnlineGame]);

  const joinOnlineGame = useCallback(async () => {
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const result = await joinOnlineBuzzelloGame(onlineJoinCode);
      onlinePlayerTokenRef.current = result.playerToken;
      setOnlineInviteCode(null);
      setOnlineShareLink(null);
      setOnlineCopyStatus(null);
      applyOnlineGame(result.game);
    } catch (error) {
      setOnlineError(
        error instanceof Error
          ? error.message
          : "The online match could not be joined.",
      );
    } finally {
      setOnlineBusy(false);
    }
  }, [applyOnlineGame, onlineJoinCode]);

  const copyOnlineShareLink = useCallback(async () => {
    if (!onlineShareLink || !navigator.clipboard) {
      setOnlineCopyStatus("Select and copy the link manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(onlineShareLink);
      setOnlineCopyStatus("Invite link copied.");
    } catch {
      setOnlineCopyStatus("Select and copy the link manually.");
    }
  }, [onlineShareLink]);

  const handleRulesOpenChange = useCallback((open: boolean) => {
    setRulesOpen(open);
    if (!open) {
      requestAnimationFrame(() => rulesTriggerRef.current?.focus());
    }
  }, []);

  const commitMove = useCallback(
    (index: number) => {
      if (current.gameOver) return;
      const flips = legalMoveFlips.get(index);
      if (!flips?.length) return;
      const nextBoard = applyBuzzelloMove(
        current.board,
        current.currentPlayer,
        index,
      );
      const resolution = resolveBuzzelloTurn(nextBoard, current.currentPlayer);
      const historyEntry: BuzzelloHistoryEntry = {
        player: current.currentPlayer,
        index,
        flippedCount: flips.length,
        passedPlayer: resolution.passedPlayer,
      };
      const notice = resolution.gameOver
        ? "No legal moves remain. Final score locked."
        : resolution.passedPlayer
          ? `${playerName(resolution.passedPlayer)} has no legal move and passes. ${playerName(resolution.nextPlayer)} moves again.`
          : `${playerName(resolution.nextPlayer)} to move.`;
      const nextSnapshot: BuzzelloSnapshot = {
        board: nextBoard,
        currentPlayer: resolution.nextPlayer,
        gameOver: resolution.gameOver,
        history: [...current.history, historyEntry],
        lastFlipped: flips,
        notice,
      };

      setTimeline((existing) => [
        ...existing.slice(0, cursor + 1),
        nextSnapshot,
      ]);
      setCursor(cursor + 1);
      playSound("place");
      if (flips.length > 0) playSound("flip");
      if (resolution.gameOver) {
        playSound("victory");
        setGameOverOpen(true);
      }
    },
    [current, cursor, legalMoveFlips, playSound],
  );

  const commitOnlineMove = useCallback(
    async (index: number) => {
      if (
        !onlineGame ||
        !onlinePlayerTokenRef.current ||
        onlineGame.status !== "active" ||
        onlineGame.currentPlayer !== onlineGame.youAre ||
        onlineBusy
      ) {
        return;
      }
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        const game = await playOnlineBuzzelloMove(
          onlineGame.gameId,
          index,
          onlineGame.version,
          onlinePlayerTokenRef.current,
        );
        applyOnlineGame(game);
        playSound("place");
        if (game.lastMove?.flipped.length) playSound("flip");
        if (game.status === "finished") playSound("victory");
      } catch (error) {
        setOnlineError(
          error instanceof Error
            ? error.message
            : "The move could not be completed.",
        );
      } finally {
        setOnlineBusy(false);
      }
    },
    [applyOnlineGame, onlineBusy, onlineGame, playSound],
  );

  const shouldPollOnlineGame = Boolean(
    onlineGame && getOnlineBuzzelloPollDelay(onlineGame, 0) !== null,
  );
  const pollingGameId = onlineGame?.gameId;

  useEffect(() => {
    const playerToken = onlinePlayerTokenRef.current;
    if (
      !isOnlineMode ||
      !pollingGameId ||
      !playerToken ||
      !shouldPollOnlineGame ||
      onlinePollingStopped
    ) {
      return;
    }
    let cancelled = false;
    let timer = 0;
    let unchangedPolls = 0;

    const schedule = (game: OnlineBuzzelloGame, delayOverride?: number) => {
      if (cancelled) return;
      const delay =
        delayOverride ?? getOnlineBuzzelloPollDelay(game, unchangedPolls);
      if (delay !== null) timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (cancelled) return;
      const knownGame = onlineGameRef.current;
      if (!knownGame || knownGame.gameId !== pollingGameId) return;
      if (document.visibilityState === "hidden") {
        schedule(knownGame, 30_000);
        return;
      }
      try {
        const result = await syncOnlineBuzzelloGame(knownGame, playerToken);
        if (!cancelled) {
          setOnlineError(null);
          if (result.unchanged) {
            unchangedPolls += 1;
            const refreshedGame = {
              ...knownGame,
              syncsRemaining: result.syncsRemaining,
              expiresAt: result.expiresAt,
            };
            onlineGameRef.current = refreshedGame;
            setOnlineGame((currentGame) =>
              currentGame?.gameId === refreshedGame.gameId
                ? refreshedGame
                : currentGame,
            );
            schedule(refreshedGame);
            return;
          }
          const game = result.game;
          const stateChanged =
            game.version !== knownGame.version ||
            game.status !== knownGame.status ||
            game.opponentConnected !== knownGame.opponentConnected;
          unchangedPolls = stateChanged ? 0 : unchangedPolls + 1;
          applyOnlineGame(game);
          schedule(game);
        }
      } catch (error) {
        if (!cancelled) {
          setOnlineError(
            error instanceof Error
              ? error.message
              : "The match could not be refreshed.",
          );
          const pollingMustStop =
            error instanceof BuzzelloOnlineError &&
            [404, 410, 429].includes(error.status);
          if (pollingMustStop) {
            setOnlinePollingStopped(true);
            return;
          }
          unchangedPolls += 1;
          schedule(knownGame);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      const game = onlineGameRef.current;
      if (game?.gameId === pollingGameId) schedule(game, 0);
    };

    const game = onlineGameRef.current;
    if (game) schedule(game);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    applyOnlineGame,
    isOnlineMode,
    onlinePollingStopped,
    pollingGameId,
    shouldPollOnlineGame,
  ]);

  useEffect(() => {
    if (!isAiTurn) return;
    const requestId = aiRequestRef.current + 1;
    aiRequestRef.current = requestId;
    let cancelled = false;
    let fallbackTimer = 0;
    let worker: Worker | null = null;
    setAiThinking(true);

    const finish = (moveIndex: number | null) => {
      if (cancelled || aiRequestRef.current !== requestId) return;
      setAiThinking(false);
      if (moveIndex !== null) commitMove(moveIndex);
    };

    if (typeof Worker !== "undefined") {
      worker = new Worker(new URL("./buzzello-ai.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener(
        "message",
        (event: MessageEvent<BuzzelloAiResponse>) => {
          if (event.data.requestId === requestId) finish(event.data.moveIndex);
        },
      );
      worker.addEventListener("error", () => {
        worker?.terminate();
        worker = null;
        fallbackTimer = window.setTimeout(() => {
          finish(
            selectBuzzelloAiMove(
              current.board,
              "black",
              mode as BuzzelloDifficulty,
            )?.index ?? null,
          );
        }, 0);
      });
      worker.postMessage({
        requestId,
        board: current.board,
        player: "black",
        difficulty: mode,
      });
    } else {
      fallbackTimer = window.setTimeout(() => {
        finish(
          selectBuzzelloAiMove(
            current.board,
            "black",
            mode as BuzzelloDifficulty,
          )?.index ?? null,
        );
      }, 0);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      worker?.terminate();
    };
  }, [commitMove, current.board, isAiTurn, mode]);

  const undo = () => {
    if (cursor === 0 || aiThinking) return;
    let target = cursor - 1;
    if (isAiMode && timeline[target]?.currentPlayer === "black" && target > 0) {
      target -= 1;
    }
    aiRequestRef.current += 1;
    setCursor(target);
    setGameOverOpen(false);
  };

  const redo = () => {
    if (cursor >= timeline.length - 1 || aiThinking) return;
    let target = cursor + 1;
    if (
      isAiMode &&
      timeline[target]?.currentPlayer === "black" &&
      target < timeline.length - 1
    ) {
      target += 1;
    }
    aiRequestRef.current += 1;
    setCursor(target);
    setGameOverOpen(timeline[target]?.gameOver ?? false);
  };

  const winner = current.gameOver ? getBuzzelloWinner(current.board) : null;
  const isOnlineWaiting = isOnlineMode && onlineGame?.status === "waiting";
  const isOnlineOpponentTurn =
    isOnlineMode &&
    onlineGame?.status === "active" &&
    onlineGame.currentPlayer !== onlineGame.youAre;
  const onlineBoardDisabled =
    isOnlineMode &&
    (!onlineGame ||
      onlineGame.status !== "active" ||
      onlineGame.currentPlayer !== onlineGame.youAre ||
      onlineBusy);
  const statusText = onlineError
    ? onlineError
    : aiThinking
      ? `${modeName(mode)} is calculating Black's move.`
      : current.gameOver
        ? winner === "draw"
          ? `Game over. Draw at ${scores.yellow} to ${scores.black}.`
          : `Game over. ${playerName(winner as BuzzelloPlayer)} wins ${Math.max(scores.yellow, scores.black)} to ${Math.min(scores.yellow, scores.black)}.`
        : current.notice;

  return (
    <main
      ref={fullscreen.targetRef}
      className="game-fullscreen-target buzzello-shell min-h-screen bg-obsidian px-2 pb-16 pt-20 text-marble sm:px-5 sm:pt-28 lg:px-8"
      data-game-fullscreen={fullscreen.isFullscreen || undefined}
    >
      <SEO
        title="BUZZELLO™"
        exactTitle
        url="/buzzello"
        description="Play BUZZELLO, a local, private online, or AI-powered six-axis hexagonal strategy game from ARES 23247."
      />

      <div className="mx-auto max-w-[1500px]">
        <header className="buzzello-hero relative overflow-hidden rounded-2xl px-4 py-5 shadow-2xl sm:px-8 sm:py-7">
          <div
            className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(245,166,35,0.14),transparent_68%)]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="buzzello-accent font-heading text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.38em]">
                ARES hive strategy
              </p>
              <h1 className="mt-2 font-heading text-4xl font-black tracking-[-0.04em] text-white sm:text-6xl">
                BUZZELLO
                <span className="buzzello-accent align-top text-xl sm:text-2xl">
                  ™
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-marble/72 sm:text-base">
                Surround. Convert. Control the hive. Play locally, challenge a
                local AI, or invite one remote guest to a chat-free match.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <GameFullscreenButton
                isFullscreen={fullscreen.isFullscreen}
                onToggle={fullscreen.toggleFullscreen}
                className="buzzello-secondary-action"
              />
              <Button
                variant="gold"
                className="buzzello-primary-action"
                onClick={() => setNewGameOpen(true)}
              >
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> New game
              </Button>
              <Button
                ref={rulesTriggerRef}
                variant="secondary"
                className="buzzello-secondary-action"
                onClick={() => setRulesOpen(true)}
              >
                <CircleHelp aria-hidden="true" className="h-4 w-4" /> Rules
              </Button>
              <IconButton
                variant="secondary"
                className="buzzello-secondary-action"
                aria-label={
                  soundEnabled ? "Mute game sounds" : "Enable game sounds"
                }
                onClick={() => setSoundEnabled((enabled) => !enabled)}
              >
                {soundEnabled ? (
                  <Volume2 aria-hidden="true" />
                ) : (
                  <VolumeX aria-hidden="true" />
                )}
              </IconButton>
            </div>
          </div>
        </header>

        <section
          className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]"
          aria-labelledby="arena-heading"
        >
          <div className="buzzello-arena min-w-0 rounded-2xl p-2 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2 px-1 sm:mb-4 sm:px-0">
              <div>
                <h2
                  id="arena-heading"
                  className="font-heading text-lg font-black uppercase tracking-wider text-white"
                >
                  Tournament board
                </h2>
                <p className="mt-1 text-xs text-marble/60">
                  {modeName(mode)} · {scores.empty} open cells
                </p>
              </div>
              <div className="flex shrink-0 gap-1 sm:gap-2">
                <IconButton
                  variant="ghost"
                  className="buzzello-icon-action"
                  aria-label="Undo move"
                  onClick={undo}
                  disabled={isOnlineMode || cursor === 0 || aiThinking}
                >
                  <Undo2 aria-hidden="true" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  className="buzzello-icon-action"
                  aria-label="Redo move"
                  onClick={redo}
                  disabled={
                    isOnlineMode || cursor >= timeline.length - 1 || aiThinking
                  }
                >
                  <Redo2 aria-hidden="true" />
                </IconButton>
                <IconButton
                  variant="ghost"
                  className="buzzello-icon-action"
                  aria-label="Open move history"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History aria-hidden="true" />
                </IconButton>
              </div>
            </div>

            <div
              className="buzzello-current-turn"
              data-player={
                current.gameOver || isOnlineWaiting
                  ? undefined
                  : current.currentPlayer
              }
              role="status"
              aria-label="Current turn"
              aria-live="polite"
              aria-atomic="true"
            >
              {!current.gameOver && !isOnlineWaiting && (
                <ScorePiece player={current.currentPlayer} />
              )}
              <span>
                {current.gameOver
                  ? "Match complete"
                  : isOnlineWaiting
                    ? "Waiting for opponent"
                    : `${playerName(current.currentPlayer)}’s turn`}
              </span>
            </div>

            <div
              className="buzzello-mobile-status mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl p-2 xl:hidden"
              aria-label={`Score: Yellow ${scores.yellow}, Black ${scores.black}`}
            >
              <div
                className="buzzello-mobile-player"
                data-active={
                  current.currentPlayer === "yellow" && !current.gameOver
                }
              >
                <ScorePiece player="yellow" />
                <span>
                  <span className="block text-[9px] font-black uppercase tracking-wider text-[#f7e326]">
                    Yellow
                  </span>
                  <span className="font-heading text-xl font-black text-white">
                    {scores.yellow}
                  </span>
                </span>
              </div>
              <div className="min-w-0 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#f7e326]">
                  {current.gameOver
                    ? "Final"
                    : isOnlineWaiting
                      ? "Waiting"
                      : `${playerName(current.currentPlayer)} turn`}
                </p>
                <p className="max-w-36 truncate text-[11px] text-white/75">
                  {current.gameOver
                    ? `${scores.empty} open cells`
                    : `${legalMoves.length} legal ${legalMoves.length === 1 ? "move" : "moves"}`}
                </p>
              </div>
              <div
                className="buzzello-mobile-player justify-self-end"
                data-active={
                  current.currentPlayer === "black" && !current.gameOver
                }
              >
                <span className="text-right">
                  <span className="block text-[9px] font-black uppercase tracking-wider text-white/65">
                    Black
                  </span>
                  <span className="font-heading text-xl font-black text-white">
                    {scores.black}
                  </span>
                </span>
                <ScorePiece player="black" />
              </div>
            </div>

            <BuzzelloBoardView
              board={current.board}
              currentPlayer={current.currentPlayer}
              legalMoveFlips={legalMoveFlips}
              lastFlipped={current.lastFlipped}
              disabled={
                current.gameOver ||
                aiThinking ||
                newGameOpen ||
                onlineSetupOpen ||
                onlineBoardDisabled
              }
              onMove={isOnlineMode ? commitOnlineMove : commitMove}
            />

            <p className="mt-3 px-2 text-center text-[11px] leading-5 text-marble/65 sm:mt-4 sm:text-xs">
              Tap a glowing hex to place. Keyboard players can use arrow keys,
              Home, Enter, or Space.
            </p>
          </div>

          <aside className="space-y-4" aria-label="Game status and controls">
            <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-marble/55">
                Live score
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className={`rounded-xl border p-4 ${current.currentPlayer === "yellow" && !current.gameOver ? "border-[#f7e326] bg-[#f7e326]/10" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <ScorePiece player="yellow" />
                  <p className="mt-3 text-xs font-black uppercase tracking-wider text-[#f7e326]">
                    Yellow
                  </p>
                  <p className="font-heading text-3xl font-black text-white">
                    {scores.yellow}
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-4 ${current.currentPlayer === "black" && !current.gameOver ? "border-[#f7e326] bg-[#f7e326]/10" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <ScorePiece player="black" />
                  <p className="mt-3 text-xs font-black uppercase tracking-wider text-marble/75">
                    Black
                  </p>
                  <p className="font-heading text-3xl font-black text-white">
                    {scores.black}
                  </p>
                </div>
              </div>
            </section>

            <section
              className="buzzello-turn-card rounded-2xl p-5"
              aria-labelledby="turn-heading"
            >
              <p
                id="turn-heading"
                className="buzzello-accent text-[10px] font-black uppercase tracking-[0.24em]"
              >
                {current.gameOver
                  ? "Final result"
                  : isOnlineWaiting
                    ? "Waiting for opponent"
                    : isOnlineOpponentTurn
                      ? "Opponent's turn"
                      : aiThinking
                        ? "AI turn"
                        : `${playerName(current.currentPlayer)} turn`}
              </p>
              <p
                className="mt-2 text-sm font-semibold leading-6 text-white"
                role="status"
                aria-live="polite"
              >
                {statusText}
              </p>
              {!current.gameOver && !aiThinking && !isOnlineWaiting && (
                <p className="mt-3 text-xs leading-5 text-marble/62">
                  {isOnlineOpponentTurn ? "Opponent has" : "You have"}{" "}
                  {legalMoves.length} legal{" "}
                  {legalMoves.length === 1 ? "move" : "moves"}. Tap a glowing
                  cell to play, or hover with a pointer to preview every flip.
                </p>
              )}
            </section>

            {isOnlineMode && onlineGame && (
              <section className="buzzello-turn-card rounded-2xl p-5">
                <p className="buzzello-accent text-[10px] font-black uppercase tracking-[0.24em]">
                  Private online match
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-marble/60">Your side</dt>
                    <dd className="font-bold text-white">
                      {playerName(onlineGame.youAre)}
                    </dd>
                  </div>
                  {onlineInviteCode && onlineGame.status === "waiting" && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-marble/60">Invite code</dt>
                        <dd className="select-all font-mono text-lg font-black tracking-widest text-[#f7e326]">
                          {onlineInviteCode}
                        </dd>
                      </div>
                      {onlineShareLink && (
                        <div className="pt-2">
                          <dt className="text-marble/60">Invite link</dt>
                          <dd className="mt-2 space-y-2">
                            <input
                              aria-label="Shareable match link"
                              readOnly
                              value={onlineShareLink}
                              onFocus={(event) => event.currentTarget.select()}
                              className="min-h-10 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7e326]"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void copyOnlineShareLink()}
                            >
                              Copy invite link
                            </Button>
                            {onlineCopyStatus && (
                              <p
                                role="status"
                                className="text-xs text-marble/65"
                              >
                                {onlineCopyStatus}
                              </p>
                            )}
                          </dd>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-marble/60">Refreshes left</dt>
                    <dd className="font-bold text-white">
                      {onlineGame.syncsRemaining}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-marble/60">Expires</dt>
                    <dd className="font-bold text-white">
                      {new Date(onlineGame.expiresAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs leading-5 text-marble/62">
                  Two players only. No chat, display names, profiles, or
                  spectators. The match closes automatically.
                </p>
              </section>
            )}

            <section className="buzzello-season-card rounded-2xl p-1 sm:p-3">
              <a
                href="https://www.firstinspires.org/resources/library/season-brand-downloads"
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-xl min-[360px]:block"
                aria-label="Official BIOBUZZ presented by RTX season brand resources (opens in a new tab)"
              >
                <img
                  src="/images/season/biobuzz-lockup.webp"
                  width="1280"
                  height="850"
                  loading="lazy"
                  alt="BIOBUZZ presented by RTX, FIRST Tech Challenge"
                  className="h-auto w-full rounded-xl"
                />
              </a>
              <p className="mt-2 px-2 pb-2 text-xs leading-5 text-marble/65 sm:px-1 sm:pb-0">
                Created by ARES for the 2026–2027 BIOBUZZ™ presented by RTX
                season. BUZZELLO is a team-made game, not an official season
                game.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-marble/55">
                Match controls
              </p>
              <div className="mt-4 grid gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (isOnlineMode) {
                      setOnlineError(null);
                      setOnlineSetupOpen(true);
                    } else {
                      startGame(mode);
                    }
                  }}
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />{" "}
                  {isOnlineMode ? "Start another match" : "Rematch this mode"}
                </Button>
                <Button variant="ghost" onClick={() => setHistoryOpen(true)}>
                  <History aria-hidden="true" className="h-4 w-4" /> View{" "}
                  {current.history.length} moves
                </Button>
              </div>
            </section>
          </aside>
        </section>
      </div>

      <DialogShell
        open={newGameOpen}
        onOpenChange={setNewGameOpen}
        title="Start a new BUZZELLO match"
        description="Choose local, private online, or AI play. Yellow always makes the opening move."
        size="lg"
        showClose={current.history.length > 0 || isOnlineMode}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_DETAILS.map(({ id, name, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === "online") {
                  setNewGameOpen(false);
                  setOnlineError(null);
                  setOnlineSetupOpen(true);
                  return;
                }
                startGame(id);
              }}
              className="buzzello-mode-card group rounded-xl p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7e326] sm:min-h-36 sm:p-5"
            >
              <Icon aria-hidden="true" className="h-6 w-6 text-[#f7e326]" />
              <span className="mt-2 block font-heading text-base font-black uppercase text-white sm:mt-4">
                {name}
              </span>
              <span className="mt-2 block text-sm leading-6 text-marble/65">
                {description}
              </span>
            </button>
          ))}
        </div>
      </DialogShell>

      <DialogShell
        open={onlineSetupOpen}
        onOpenChange={(open) => {
          if (!onlineBusy) setOnlineSetupOpen(open);
        }}
        title="Online BUZZELLO"
        description="Guests and team members can play without a profile. Every temporary match connects exactly two players."
        size="md"
        showClose={!onlineBusy}
      >
        <div className="space-y-5">
          <section className="buzzello-turn-card rounded-xl p-4">
            <h3 className="font-heading text-sm font-black uppercase text-[#f7e326]">
              Find a match
            </h3>
            <p className="mt-1 text-sm leading-6 text-marble/70">
              Join the next available guest with no lobby or identity exchange.
              If nobody is waiting, your search expires after 90 seconds.
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => void findOnlineMatch()}
              isPending={onlineBusy}
              pendingLabel="Finding a guest…"
            >
              Find a match
            </Button>
          </section>

          <section className="rounded-xl border border-white/12 bg-white/[0.03] p-4">
            <h3 className="font-heading text-sm font-black uppercase text-white">
              Find a teammate
            </h3>
            <p className="mt-1 text-sm leading-6 text-marble/70">
              Uses the same blind, chat-free queue, but requires an authorized
              ARES website account and only pairs team members.
            </p>
            <Button
              variant="ghost"
              className="mt-3"
              onClick={() => void findTeamMatch()}
              isPending={onlineBusy}
              pendingLabel="Finding a teammate…"
            >
              Find a teammate
            </Button>
          </section>

          <section className="buzzello-turn-card rounded-xl p-4">
            <h3 className="font-heading text-sm font-black uppercase text-[#f7e326]">
              Play a friend
            </h3>
            <p className="mt-1 text-sm leading-6 text-marble/70">
              You play Yellow. Share the link or eight-character code with one
              person; it expires after ten minutes.
            </p>
            <Button
              variant="gold"
              className="mt-3"
              onClick={() => void createOnlineGame()}
              isPending={onlineBusy}
              pendingLabel="Creating private match…"
            >
              Create friend invite
            </Button>
          </section>

          <form
            className="rounded-xl border border-white/12 bg-white/[0.03] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void joinOnlineGame();
            }}
          >
            <label
              htmlFor="buzzello-invite-code"
              className="font-heading text-sm font-black uppercase text-white"
            >
              Join with a code
            </label>
            <p className="mt-1 text-sm leading-6 text-marble/70">
              You play Black. Codes contain only letters and numbers.
            </p>
            <input
              id="buzzello-invite-code"
              value={onlineJoinCode}
              onChange={(event) =>
                setOnlineJoinCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^2-9A-HJ-NP-Z]/g, "")
                    .slice(0, 8),
                )
              }
              required
              minLength={8}
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              className="mt-3 min-h-11 w-full rounded border border-white/20 bg-black/30 px-4 py-2 font-mono text-lg font-black uppercase tracking-[0.2em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7e326]"
              aria-describedby="buzzello-online-privacy"
            />
            <Button
              type="submit"
              variant="secondary"
              className="mt-3"
              disabled={onlineJoinCode.length !== 8}
              isPending={onlineBusy}
              pendingLabel="Joining private match…"
            >
              Join private match
            </Button>
          </form>

          <p
            id="buzzello-online-privacy"
            className="text-xs leading-5 text-marble/60"
          >
            Online play uses a temporary match-only session held in this tab and
            protected service requests. It has no chat, names, profiles, friend
            lists, or public lobby. Requests and match lifetime are strictly
            limited; refreshing or closing the tab ends access.
          </p>
          {onlineError && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100"
            >
              {onlineError}
            </p>
          )}
        </div>
      </DialogShell>

      <DialogShell
        open={rulesOpen}
        onOpenChange={handleRulesOpenChange}
        title="How to play BUZZELLO"
        description="A six-axis hexagonal Reversi game with an intentionally open center."
        size="lg"
      >
        <div className="space-y-5 text-sm leading-6 text-marble/78">
          <section>
            <h3 className="font-heading font-black uppercase text-white">
              Place and flank
            </h3>
            <p className="mt-1">
              Place on a glowing empty cell. At least one straight line must
              begin with Black pieces and end at Yellow, or begin with Yellow
              pieces and end at Black. Every bracketed line flips at once.
            </p>
          </section>
          <section>
            <h3 className="font-heading font-black uppercase text-white">
              The open-center rosette
            </h3>
            <p className="mt-1">
              The center starts empty. Six alternating pieces surround it, with
              Yellow moving first. The board contains 61 cells across six
              movement directions.
            </p>
          </section>
          <section>
            <h3 className="font-heading font-black uppercase text-white">
              Passes and victory
            </h3>
            <p className="mt-1">
              A player with no legal move passes automatically. The match ends
              when neither player can move, the board is full, or one color is
              eliminated. The higher final piece count wins.
            </p>
          </section>
          <section className="rounded-xl border border-[#f7e326]/25 bg-[#f7e326]/[0.06] p-4">
            <h3 className="font-heading font-black uppercase text-[#f7e326]">
              Master AI
            </h3>
            <p className="mt-1">
              Master evaluates corners, danger cells, perimeter control,
              mobility, and late-game parity with iterative minimax and
              alpha-beta pruning. With ten or fewer empty cells, it searches to
              the end of the game.
            </p>
          </section>
        </div>
      </DialogShell>

      <Drawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Move history"
        description="Moves shown up to the current undo/redo position."
        size="md"
      >
        {current.history.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-marble/65">
            No moves yet. Start with one of the glowing cells.
          </p>
        ) : (
          <ol className="space-y-2">
            {current.history.map((entry, index) => (
              <li
                key={`${index}-${entry.index}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ScorePiece player={entry.player} />
                    <div>
                      <p className="text-sm font-bold text-white">
                        {index + 1}. {playerName(entry.player)} at{" "}
                        {formatBuzzelloCoordinate(entry.index)}
                      </p>
                      <p className="mt-1 text-xs text-marble/60">
                        Flipped {entry.flippedCount}{" "}
                        {entry.flippedCount === 1 ? "piece" : "pieces"}
                      </p>
                    </div>
                  </div>
                  {entry.passedPlayer && (
                    <span className="rounded-full border border-[#f7e326]/30 bg-[#f7e326]/10 px-2 py-1 text-[10px] font-black uppercase text-[#f7e326]">
                      {playerName(entry.passedPlayer)} passed
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Drawer>

      <DialogShell
        open={gameOverOpen}
        onOpenChange={setGameOverOpen}
        title={
          winner === "draw"
            ? "The hive is balanced"
            : `${winner ? playerName(winner) : "Match"} wins`
        }
        description={`Final score: Yellow ${scores.yellow}, Black ${scores.black}.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGameOverOpen(false)}>
              Review board
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                if (isOnlineMode) {
                  setGameOverOpen(false);
                  setOnlineError(null);
                  setOnlineSetupOpen(true);
                } else {
                  startGame(mode);
                }
              }}
            >
              <Trophy aria-hidden="true" className="h-4 w-4" />{" "}
              {isOnlineMode ? "New online match" : "Rematch"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#f7e326]/30 bg-[#f7e326]/10 p-4 text-center">
            <ScorePiece player="yellow" />
            <p className="mt-2 text-3xl font-black text-white">
              {scores.yellow}
            </p>
            <p className="text-xs uppercase tracking-wider text-[#f7e326]">
              Yellow
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-center">
            <ScorePiece player="black" />
            <p className="mt-2 text-3xl font-black text-white">
              {scores.black}
            </p>
            <p className="text-xs uppercase tracking-wider text-marble/70">
              Black
            </p>
          </div>
        </div>
      </DialogShell>
    </main>
  );
}
