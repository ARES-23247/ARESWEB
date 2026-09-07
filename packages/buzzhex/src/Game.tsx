import {
  useRef,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  ArrowLeftRight,
  CircleHelp,
  RotateCcw,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@ares/ui/button";
import { DialogShell } from "@ares/ui/dialog";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@ares/game-common/fullscreen";
import {
  HEX_CELLS,
  BUZZHEX_SAVE_KEY,
  applyHexAction,
  canSwapHex,
  createHexGame,
  decodeHexSave,
  encodeHexSave,
  undoHexAction,
  type HexAction,
  type HexSession,
  type HexColor,
} from "./rules";
import type { HexDifficulty } from "./ai";
import "./buzzhex.css";

const TILE = "/images/games/buzzhex/buzzello-tile-";
const HEX_POINTS = "18.4,0 9.2,15.94 -9.2,15.94 -18.4,0 -9.2,-15.94 9.2,-15.94";
const colorName = (color: HexColor) => (color === "black" ? "Black" : "Yellow");

function readSession(): HexSession & { notice: string } {
  const empty: HexSession = {
    game: createHexGame(),
    names: ["Player 1", "Player 2"],
  };
  try {
    const raw = localStorage.getItem(BUZZHEX_SAVE_KEY);
    if (raw === null) return { ...empty, notice: "" };
    const saved = decodeHexSave(raw);
    return saved
      ? { ...saved, notice: "Your saved game is ready." }
      : {
          ...empty,
          notice:
            "The saved game could not be restored. A fresh board is ready.",
        };
  } catch {
    return {
      ...empty,
      notice:
        "Browser storage is unavailable. You can play, but this game will not survive a reload.",
    };
  }
}

function persist(next: HexSession) {
  let notice = "Saved on this device.";
  try {
    localStorage.setItem(BUZZHEX_SAVE_KEY, encodeHexSave(next));
  } catch {
    notice =
      "Your game is playable, but browser storage could not save it. Keep this tab open.";
  }
  return { ...next, notice };
}

export default function BuzzhexGame({
  navigation,
  printables,
}: {
  navigation: ReactNode;
  printables?: ReactNode;
}) {
  const [session, setSession] = useState(readSession);
  const [draftMode, setDraftMode] = useState(session.mode ?? "local");
  const [draftDifficulty, setDraftDifficulty] = useState<HexDifficulty>(
    session.difficulty ?? "medium",
  );
  const [aiError, setAiError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [focused, setFocused] = useState(60);
  const [hovered, setHovered] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [dialog, setDialog] = useState<"rules" | "reset" | "names" | null>(
    null,
  );
  const [draftNames, setDraftNames] = useState<[string, string]>(session.names);
  const [announcement, setAnnouncement] = useState("");
  const rulesRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const namesRef = useRef<HTMLButtonElement>(null);
  const cellRefs = useRef<(SVGGElement | null)[]>([]);
  const pointer = useRef<{
    x: number;
    y: number;
    id: number;
    type: string;
  } | null>(null);
  const cancelled = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const { isFullscreen, targetRef, toggleFullscreen } = useGameFullscreen();
  const { game } = session;
  const computer = session.mode === "computer";
  const difficulty = session.difficulty ?? "medium";
  const names: [string, string] = [
    session.names[0],
    computer ? "Computer" : session.names[1],
  ];
  const computerTurn = computer && game.current === 1 && game.winner === null;

  useEffect(() => {
    if (
      session.mode !== "computer" ||
      session.game.current !== 1 ||
      session.game.winner !== null
    )
      return;
    let worker: Worker | undefined;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const fail = () => {
      if (!cancelled)
        setAiError(
          "The computer could not choose a move. Retry, or undo your last turn.",
        );
      cancelled = true;
      worker?.terminate();
      clearTimeout(timeout);
    };
    const delay = setTimeout(() => {
      try {
        worker = new Worker(
          new URL("./buzzhex-ai.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onerror = fail;
        worker.onmessageerror = fail;
        worker.onmessage = (event: MessageEvent<HexAction | null>) => {
          if (cancelled) return;
          const action = event.data;
          if (!action || (action.type !== "swap" && action.type !== "place")) {
            fail();
            return;
          }
          const next = applyHexAction(session.game, action);
          if (!next) {
            fail();
            return;
          }
          worker?.terminate();
          clearTimeout(timeout);
          setSession(persist({ ...session, game: next }));
          setAnnouncement(
            action.type === "swap"
              ? "Computer swapped colors. You play Yellow next."
              : `Computer placed at ${HEX_CELLS[action.index].label}.`,
          );
          setSelected(null);
        };
        timeout = setTimeout(fail, 15000);
        worker.postMessage({
          game: session.game,
          difficulty: session.difficulty ?? "medium",
        });
      } catch {
        fail();
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(delay);
      clearTimeout(timeout);
      worker?.terminate();
    };
  }, [session, retry]);
  const currentColor = game.colors[game.current];
  const placements = game.board.filter(Boolean).length;
  const last = game.history.findLast(
    (entry) => entry.action.type === "place",
  )?.action;
  const status =
    game.winner === null
      ? `${names[game.current]} · ${colorName(currentColor)} to move`
      : `${names[game.winner]} wins as ${colorName(game.colors[game.winner])}!`;

  function save(next: HexSession, message: string) {
    setAiError("");
    setSession(persist(next));
    setAnnouncement(message);
  }
  function act(action: HexAction) {
    if (computerTurn) return;
    const next = applyHexAction(game, action);
    if (!next) return;
    const message =
      action.type === "swap"
        ? `${names[1]} swapped colors. ${names[0]} plays Yellow next.`
        : `${names[game.current]} placed ${colorName(currentColor)} at ${HEX_CELLS[action.index].label}.`;
    save({ ...session, game: next }, message);
    setSelected(null);
  }
  function choose(index: number, touch = false) {
    setFocused(index);
    if (computerTurn) return;
    if (game.winner !== null || game.board[index] !== null) {
      setSelected(index);
      return;
    }
    if (touch) {
      setSelected(index);
      return;
    }
    act({ type: "place", index });
  }
  function navigate(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
      return;
    }
    const { q, r } = HEX_CELLS[index];
    const offsets: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
      PageUp: [-1, 1],
      PageDown: [1, -1],
    };
    let next = index;
    if (event.key === "Home") next = event.ctrlKey ? 0 : q * 11;
    else if (event.key === "End") next = event.ctrlKey ? 120 : q * 11 + 10;
    else if (offsets[event.key]) {
      const [dq, dr] = offsets[event.key];
      if (q + dq >= 0 && q + dq < 11 && r + dr >= 0 && r + dr < 11)
        next = (q + dq) * 11 + r + dr;
    } else return;
    event.preventDefault();
    setFocused(next);
    cellRefs.current[next]?.focus();
    cellRefs.current[next]?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }
  function startPointer(event: PointerEvent<SVGGElement>) {
    if (!event.isPrimary || event.button !== 0) {
      cancelled.current = true;
      pointer.current = null;
      return;
    }
    cancelled.current = false;
    pointer.current = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      type: event.pointerType,
    };
  }
  function finishPointer(event: PointerEvent<SVGGElement>, index: number) {
    const start = pointer.current;
    pointer.current = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      cancelled.current ||
      Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8
    )
      return;
    choose(index, start.type !== "mouse");
  }
  function changeZoom(amount: number) {
    setFit(false);
    setZoom((value) => Math.max(0.75, Math.min(2, value + amount)));
  }

  return (
    <main
      ref={targetRef}
      className="buzzhex-shell game-fullscreen-target"
      data-game-fullscreen={isFullscreen || undefined}
    >
      <header className="buzzhex-header">
        <div>
          <p className="buzzhex-eyebrow">
            ARES games /{" "}
            {computer ? `Computer · ${difficulty}` : "Two players / One device"}
          </p>
          <h1>
            BUZZHEX<span>Connect the hive.</span>
          </h1>
          <p>One tile. Six neighbors. Find a path to the other side.</p>
        </div>
        <nav aria-label="More ARES games">
          {navigation}
          {printables}
        </nav>
      </header>
      <div className="buzzhex-layout">
        <section className="buzzhex-arena" aria-label="Play BUZZHEX">
          <div className="buzzhex-arena-top">
            <span>
              11 × 11 <span className="buzzhex-muted">/ 121 cells</span>
            </span>
            <span>
              {placements} {placements === 1 ? "tile" : "tiles"} placed
            </span>
          </div>
          <p className="buzzhex-mobile-status" aria-hidden="true">
            {status}
          </p>
          <div className="buzzhex-toolbar" aria-label="Board view controls">
            <Button
              variant="secondary"
              aria-label="Zoom out"
              onClick={() => changeZoom(-0.25)}
              disabled={!fit && zoom <= 0.75}
            >
              <ZoomOut size={17} aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFit(true);
                setZoom(1);
                viewport.current?.scrollTo?.(0, 0);
              }}
            >
              Fit board
            </Button>
            <Button
              variant="secondary"
              aria-label="Zoom in"
              onClick={() => changeZoom(0.25)}
              disabled={!fit && zoom >= 2}
            >
              <ZoomIn size={17} aria-hidden="true" />
            </Button>
            <GameFullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
            />
          </div>
          <div ref={viewport} className="buzzhex-viewport" data-fit={fit}>
            <svg
              className="buzzhex-board"
              style={{ "--hex-zoom": zoom } as CSSProperties}
              viewBox="-346 -228 692 456"
              role="group"
              aria-label="BUZZHEX board, 121 hexagonal cells"
              aria-describedby="buzzhex-keyboard-help"
            >
              <g className="buzzhex-rails" aria-hidden="true">
                <path
                  className="buzzhex-rail-black"
                  d="M-318 -8 L-8 -188 M8 188 L318 8"
                />
                <path
                  className="buzzhex-rail-yellow"
                  d="M-318 8 L-8 188 M8 -188 L318 -8"
                />
                <text x="-167" y="-125" className="buzzhex-rail-label">
                  A · BLACK
                </text>
                <text x="167" y="125" className="buzzhex-rail-label">
                  K · BLACK
                </text>
                <text x="167" y="-125" className="buzzhex-rail-label">
                  11 · YELLOW
                </text>
                <text x="-167" y="125" className="buzzhex-rail-label">
                  1 · YELLOW
                </text>
              </g>
              {HEX_CELLS.map((cell) => {
                const owner = game.board[cell.index];
                const isSelected = selected === cell.index;
                const preview =
                  !owner &&
                  !computerTurn &&
                  game.winner === null &&
                  (isSelected || hovered === cell.index);
                const winning = game.path.includes(cell.index);
                const human = owner ? names[game.colors.indexOf(owner)] : null;
                return (
                  <g
                    key={cell.index}
                    ref={(element) => {
                      cellRefs.current[cell.index] = element;
                    }}
                    role="button"
                    tabIndex={focused === cell.index ? 0 : -1}
                    aria-label={`${cell.label}, ${owner ? `${colorName(owner)}, ${human}` : "empty"}${winning ? ", winning path" : ""}`}
                    aria-disabled={
                      !!owner || game.winner !== null || computerTurn
                    }
                    aria-pressed={isSelected}
                    data-cell={cell.label}
                    data-owner={owner ?? "empty"}
                    data-winning={winning || undefined}
                    className="buzzhex-cell"
                    transform={`translate(${cell.x} ${cell.y})`}
                    onFocus={() => setFocused(cell.index)}
                    onKeyDown={(event) => navigate(event, cell.index)}
                    onPointerDown={startPointer}
                    onPointerUp={(event) => finishPointer(event, cell.index)}
                    onPointerCancel={() => {
                      pointer.current = null;
                      cancelled.current = true;
                    }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setHovered(cell.index);
                    }}
                    onPointerLeave={() => setHovered(null)}
                    onClick={(event) => {
                      if (event.detail === 0) choose(cell.index);
                    }}
                  >
                    <polygon points={HEX_POINTS} className="buzzhex-pocket" />
                    {!owner && (
                      <text
                        textAnchor="middle"
                        y="3"
                        className="buzzhex-coordinate"
                      >
                        {cell.label}
                      </text>
                    )}
                    {(owner || preview) && (
                      <image
                        href={`${TILE}${owner ?? currentColor}.svg`}
                        x="-19.2"
                        y="-17.28"
                        width="38.4"
                        height="34.56"
                        className={
                          preview ? "buzzhex-tile-preview" : "buzzhex-tile"
                        }
                        aria-hidden="true"
                        pointerEvents="none"
                      />
                    )}
                    <polygon
                      points={HEX_POINTS}
                      className="buzzhex-cell-outline"
                    />
                    {last?.type === "place" && last.index === cell.index && (
                      <circle
                        cx="0"
                        cy="0"
                        r="2"
                        className="buzzhex-last-move"
                        aria-hidden="true"
                      />
                    )}
                  </g>
                );
              })}
              {game.path.length > 0 && (
                <polyline
                  className="buzzhex-winning-line"
                  points={game.path
                    .map(
                      (index) => `${HEX_CELLS[index].x},${HEX_CELLS[index].y}`,
                    )
                    .join(" ")}
                  aria-hidden="true"
                />
              )}
            </svg>
          </div>
          <div className="buzzhex-selection">
            <p>
              {selected !== null
                ? `${HEX_CELLS[selected].label} · ${game.board[selected] ? `${colorName(game.board[selected]!)} tile` : "Ready to place"}`
                : "Touch: select a cell, then confirm. Zoom in and swipe to explore."}
            </p>
            {selected !== null &&
              !game.board[selected] &&
              game.winner === null &&
              !computerTurn && (
                <Button onClick={() => act({ type: "place", index: selected })}>
                  Place {colorName(currentColor)} at {HEX_CELLS[selected].label}
                </Button>
              )}
          </div>
          <p id="buzzhex-keyboard-help" className="buzzhex-keyboard-help">
            Keyboard: arrows follow the grid; Page Up / Down use the third axis.
            Enter or Space places a tile. Home / End move to row ends.
          </p>
        </section>
        <aside className="buzzhex-sidebar" aria-label="Game controls">
          <div
            className="buzzhex-turn"
            role="status"
            aria-label="Current turn"
            aria-live="polite"
          >
            <span>
              {game.winner === null ? "YOUR NEXT CONNECTION" : "CONNECTED!"}
            </span>
            <h2>
              {computerTurn
                ? aiError
                  ? "Computer paused"
                  : "Computer is thinking…"
                : status}
            </h2>
            <p>
              {game.winner === null
                ? "Connect your matching edges. Every tile stays put."
                : "The highlighted chain joins both goal edges."}
            </p>
          </div>
          {aiError && (
            <div role="alert">
              <p>{aiError}</p>
              <Button
                onClick={() => {
                  setAiError("");
                  setRetry((value) => value + 1);
                }}
              >
                Retry computer move
              </Button>
            </div>
          )}
          <div className="buzzhex-players">
            {names.map((name, player) => (
              <div
                key={player}
                className="buzzhex-player"
                data-active={game.winner === null && game.current === player}
              >
                <img
                  src={`${TILE}${game.colors[player]}.svg`}
                  alt={`${colorName(game.colors[player])} Buzzello tile`}
                  width="48"
                  height="44"
                />
                <div>
                  <strong>{name}</strong>
                  <span>
                    {colorName(game.colors[player])} ·{" "}
                    {game.colors[player] === "black" ? "A → K" : "1 → 11"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Button
            ref={namesRef}
            variant="ghost"
            onClick={() => {
              setDraftNames(session.names);
              setDialog("names");
            }}
          >
            Edit player names
          </Button>
          {canSwapHex(game) && !computerTurn && (
            <div className="buzzhex-swap">
              <h3>Keep it, or swap?</h3>
              <p>
                {names[1]}, you can take Black and the opening tile. {names[0]}{" "}
                would play Yellow next.
              </p>
              <Button variant="gold" onClick={() => act({ type: "swap" })}>
                <ArrowLeftRight size={18} aria-hidden="true" />
                Swap colors
              </Button>
              <p>Place Yellow to keep your color.</p>
            </div>
          )}
          <div className="buzzhex-actions">
            <Button
              variant="secondary"
              disabled={!game.history.length}
              onClick={() => {
                let next = undoHexAction(game);
                if (
                  computer &&
                  game.history.at(-1)?.player === 1 &&
                  next.history.length
                )
                  next = undoHexAction(next);
                save(
                  { ...session, game: next },
                  computer
                    ? "Your last turn and computer reply undone."
                    : "Last action undone.",
                );
                setSelected(null);
              }}
            >
              <Undo2 size={17} aria-hidden="true" />
              {computer ? "Undo your last turn" : "Undo last action"}
            </Button>
            <Button
              ref={rulesRef}
              variant="secondary"
              onClick={() => setDialog("rules")}
            >
              <CircleHelp size={17} aria-hidden="true" />
              Rules
            </Button>
            <Button
              ref={resetRef}
              variant="secondary"
              onClick={() => {
                setDraftMode(session.mode ?? "local");
                setDraftDifficulty(difficulty);
                setDialog("reset");
              }}
            >
              <RotateCcw size={17} aria-hidden="true" />
              New game
            </Button>
          </div>
          <details className="buzzhex-history">
            <summary>
              History · {game.history.length}{" "}
              {game.history.length === 1 ? "action" : "actions"}
            </summary>
            {!game.history.length ? (
              <p>No tiles yet. Black opens.</p>
            ) : (
              <ol>
                {game.history.map((entry, index) => (
                  <li key={index}>
                    {names[entry.player]}{" "}
                    {entry.action.type === "swap"
                      ? "swapped colors"
                      : `placed ${colorName(entry.color)} at ${HEX_CELLS[entry.action.index].label}`}
                  </li>
                ))}
              </ol>
            )}
          </details>
          <p
            className="buzzhex-storage"
            role="status"
            aria-label="Game storage"
          >
            {session.notice ||
              "Progress saves in this browser. No account needed."}
          </p>
        </aside>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        aria-label="Game announcements"
      >
        {announcement}
      </p>
      <DialogShell
        open={dialog === "rules"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="How to play BUZZHEX"
        returnFocusRef={rulesRef}
      >
        <div className="buzzhex-rules">
          <p>
            Two players take turns placing one tile in any empty cell. Black
            opens.
          </p>
          <p>
            <strong>Black connects A to K. Yellow connects 1 to 11.</strong>{" "}
            Follow matching tiles that share a hexagon edge. Your chain may turn
            or branch. Each corner touches both incident goal edges.
          </p>
          <p>
            The first connection wins immediately. There are no captures, flips,
            passes, points, or draws.
          </p>
          <h3>Play the computer</h3>
          <p>
            Choose Computer in New game. You open as Black. Easy varies its
            moves; Medium builds connections and blocks immediate threats; Hard
            also examines the opponent’s replies. The computer may use the
            opening swap. Your game and difficulty save in this browser.
          </p>
          <h3>The opening swap</h3>
          <p>
            After the first black tile, Player 2 may swap colors instead of
            placing Yellow. The tile stays black in its original cell. Player 2
            becomes Black; Player 1 becomes Yellow and plays next. Playing
            Yellow declines the offer. You can swap only once.
          </p>
          <p>
            Undo also reverses a swap or winning move. Against the computer, it
            takes back your last turn and the computer’s reply.
          </p>
          <p>
            Based on{" "}
            <a
              href="https://en.wikipedia.org/wiki/Hex_(board_game)"
              target="_blank"
              rel="noreferrer"
            >
              Hex
            </a>
            , created by Piet Hein and independently rediscovered by John Nash.
          </p>
        </div>
      </DialogShell>
      <DialogShell
        open={dialog === "reset"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Start a new game?"
        description="This clears the current board and history. Player 1 will open as Black."
        returnFocusRef={resetRef}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep playing
            </Button>
            <Button
              onClick={() => {
                save(
                  {
                    ...session,
                    game: createHexGame(),
                    mode: draftMode,
                    difficulty: draftDifficulty,
                  },
                  "New game. Player 1 opens as Black.",
                );
                setSelected(null);
                setDialog(null);
              }}
            >
              Start new game
            </Button>
          </>
        }
      >
        <div className="buzzhex-settings">
          <label>
            Opponent
            <select
              value={draftMode}
              onChange={(event) =>
                setDraftMode(event.target.value as "local" | "computer")
              }
            >
              <option value="local">Two players on this device</option>
              <option value="computer">Computer</option>
            </select>
          </label>
          {draftMode === "computer" && (
            <>
              <label>
                Difficulty
                <select
                  value={draftDifficulty}
                  onChange={(event) =>
                    setDraftDifficulty(event.target.value as HexDifficulty)
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <p>
                You open as Black. The computer can swap after your first tile.
              </p>
            </>
          )}
        </div>
      </DialogShell>
      <DialogShell
        open={dialog === "names"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Player names"
        description="Use a nickname. Names are saved only in this browser."
        returnFocusRef={namesRef}
      >
        <form
          className="buzzhex-names"
          onSubmit={(event) => {
            event.preventDefault();
            save(
              {
                ...session,
                names: [
                  draftNames[0].trim() || "Player 1",
                  draftNames[1].trim() || "Player 2",
                ],
              },
              "Player names updated.",
            );
            setDialog(null);
          }}
        >
          {draftNames.map((name, index) => (
            <label key={index}>
              Player {index + 1}
              <input
                value={name}
                maxLength={28}
                onChange={(event) =>
                  setDraftNames((previous) =>
                    index === 0
                      ? [event.target.value, previous[1]]
                      : [previous[0], event.target.value],
                  )
                }
              />
            </label>
          ))}
          <Button type="submit">Save names</Button>
        </form>
      </DialogShell>
    </main>
  );
}
