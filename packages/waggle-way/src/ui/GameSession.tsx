import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft, Play, Pause, RotateCcw, StepForward } from "lucide-react";
import { Button } from "@ares/ui/button";
import { sprinklerPhase } from "../core/weather";
import {
  applyCommand,
  createRun,
  eligibleBee,
  gateState,
  populationCounts,
  pollenCounts,
  stepRun,
  TICKS_PER_SECOND,
  type RunCommand,
  type RunState,
} from "../core/engine";
import { DIRECTION_NAMES, type LevelDefinition } from "../core/level";
import GardenScene, { OBJECT_LABELS, PieceIcon } from "./GardenScene";
import GardenViewport from "./GardenViewport";
import ToolTrayButton from "./ToolTrayButton";
import GamePanel from "./GamePanel";
import DirectionPad from "./DirectionPad";
import ExperienceControls, { useWaggleExperience } from "./ExperienceControls";
import { captureReplay, type RunReplay } from "../core/replay";
import { useGhostReplay } from "./useGhostReplay";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@ares/game-common/fullscreen";

export default function GameSession({
  level,
  onExit,
  onResult,
  navigation,
  titleRef,
  chapter,
  fullscreenController,
  help,
  embedded = false,
  exitLabel = "Return to editor",
}: {
  level: LevelDefinition;
  onExit?: () => void;
  onResult?: (run: RunState) => void;
  navigation?: ReactNode;
  chapter?: string;
  fullscreenController?: ReturnType<typeof useGameFullscreen>;
  help?: ReactNode;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  embedded?: boolean;
  exitLabel?: string;
}) {
  const [run, setRun] = useState(() => createRun(level));
  const current = useRef(run);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedId, setSelectedId] = useState(
    level.objects.find(
      (object) =>
        object.kind === "perch" ||
        object.kind === "dancer" ||
        object.kind === "switch" ||
        object.kind === "rally",
    )?.id ?? level.objects[0].id,
  );
  const [overlays, setOverlays] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [stockId, setStockId] = useState(level.inventory?.[0]?.id ?? "");
  const [placingStock, setPlacingStock] = useState(false);
  const [backgroundNotice, setBackgroundNotice] = useState("");
  const [previousAttempt, setPreviousAttempt] = useState<RunReplay | null>(
    null,
  );
  const [showGhost, setShowGhost] = useState(false);
  const [reviewTick, setReviewTick] = useState<number | null>(null);
  const ghostTick = !playing && reviewTick !== null ? reviewTick : run.tick;
  const ghost = useGhostReplay(level, previousAttempt, showGhost, ghostTick);
  const counts = populationCounts(run);
  const gridPlay = level.rulesVersion >= 6;
  const selected = run.objects.find((object) => object.id === selectedId);
  const savedResult = useRef("");
  const pollen = pollenCounts(run);
  const experience = useWaggleExperience();
  const { playCue } = experience;
  const localFullscreen = useGameFullscreen();
  const fullscreen = fullscreenController ?? localFullscreen;
  const lastCounts = useRef({ rescued: 0, lost: 0, won: false });

  useEffect(() => {
    const prior = lastCounts.current;
    if (run.won && !prior.won) void playCue("win");
    else if (counts.lost > prior.lost) void playCue("lost");
    else if (counts.rescued > prior.rescued) void playCue("rescue");
    lastCounts.current = {
      rescued: counts.rescued,
      lost: counts.lost,
      won: run.won,
    };
  }, [counts.lost, counts.rescued, run.won, playCue]);

  useLayoutEffect(() => {
    const resultKey = `${counts.rescued}|${pollen.delivered}|${run.peakToolsPlaced}`;
    if (run.won && resultKey !== savedResult.current) {
      savedResult.current = resultKey;
      onResult?.(run);
    }
    if (run.phase === "setup") savedResult.current = "";
  }, [run, counts.rescued, pollen.delivered, onResult]);

  const publish = (next: RunState) => {
    current.current = next;
    setRun(next);
  };
  const command = (action: RunCommand) =>
    publish(applyCommand(level, current.current, action));
  const placeStock = (x: number, y: number, supplyId = stockId) => {
    let index = 1;
    while (
      current.current.objects.some(
        (object) => object.id === `placed-${index}`,
      ) ||
      current.current.deployed.some(
        (entry) => entry.objectId === `placed-${index}`,
      )
    )
      index++;
    const objectId = `placed-${index}`;
    const next = applyCommand(level, current.current, {
      type: "place",
      stockId: supplyId,
      objectId,
      x,
      y,
    });
    if (next.commands.length > current.current.commands.length)
      setSelectedId(objectId);
    publish(next);
  };

  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setPlaying(false);
        setBackgroundNotice(
          "Paused while this page was hidden. Resume when you are ready.",
        );
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previousTime = 0;
    let accumulator = 0;
    const animate = (time: number) => {
      if (document.hidden) {
        setPlaying(false);
        return;
      }
      if (previousTime)
        accumulator += Math.min(100, time - previousTime) * speed;
      previousTime = time;
      let next = current.current;
      let ticks = 0;
      while (accumulator >= 1000 / TICKS_PER_SECOND && ticks < 12) {
        next = stepRun(level, next);
        accumulator -= 1000 / TICKS_PER_SECOND;
        ticks++;
      }
      if (next !== current.current) {
        current.current = next;
        setRun(next);
      }
      if (next.phase === "finished") setPlaying(false);
      else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [level, playing, speed]);

  const previewBee = run.bees.find(
    (bee) => bee.status === "flying" || bee.status === "hive",
  );
  const [preview, setPreview] = useState<{
    source: RunState | null;
    route: Array<{ x: number; y: number }>;
    error: string;
  }>({ source: null, route: [], error: "" });
  const previewBeeId = previewBee?.id;
  useEffect(() => {
    if (!showPreview || playing || previewBeeId === undefined) return;
    let worker: Worker;
    const fail = () =>
      setPreview({
        source: run,
        route: [],
        error: "The route preview is unavailable. You can continue playing.",
      });
    try {
      worker = new Worker(new URL("./preview.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (
        event: MessageEvent<{
          route: Array<{ x: number; y: number }>;
          error: string | null;
        }>,
      ) =>
        setPreview({
          source: run,
          route: event.data.route,
          error: event.data.error ?? "",
        });
      worker.onerror = fail;
      worker.postMessage({ level, run, beeId: previewBeeId });
    } catch {
      fail();
    }
    return () => worker?.terminate();
  }, [showPreview, playing, previewBeeId, level, run]);
  const previewActive = showPreview && !playing && previewBeeId !== undefined;
  const route = previewActive && preview.source === run ? preview.route : [];

  const stepButton = (
    <Button
      variant="secondary"
      aria-label="Step one tick"
      className="ww-compact-button"
      disabled={playing || run.phase === "finished"}
      onClick={() => {
        setReviewTick(null);
        const started =
          current.current.phase === "setup"
            ? applyCommand(level, current.current, { type: "start" })
            : current.current;
        publish(stepRun(level, started));
      }}
    >
      <StepForward size={16} aria-hidden="true" />
      <span>Step one tick</span>
    </Button>
  );

  const helperAction = selected &&
    (selected.kind === "perch" ||
      selected.kind === "dancer" ||
      selected.kind === "switch") && (
      <div className="ww-helper-action">
        <Button
          disabled={
            run.phase === "finished" ||
            (!run.bees.some((bee) => bee.perchId === selected.id) &&
              (!eligibleBee(run, selected) ||
                counts.assigned >= level.guideLimit))
          }
          onClick={() =>
            command({
              type: run.bees.some((bee) => bee.perchId === selected.id)
                ? "release"
                : "assign",
              objectId: selected.id,
            })
          }
        >
          {run.bees.some((bee) => bee.perchId === selected.id)
            ? selected.kind === "switch"
              ? "Release operator"
              : "Release guide"
            : selected.kind === "switch"
              ? "Assign operator"
              : "Assign guide"}
        </Button>
        {!run.bees.some((bee) => bee.perchId === selected.id) &&
          (!eligibleBee(run, selected) ||
            counts.assigned >= level.guideLimit) && (
            <p className="ww-caption">
              {counts.assigned >= level.guideLimit
                ? "All helper jobs are occupied. Release a helper to free a job."
                : eligibleBee(run, selected)
                  ? "A bee is available for this helper job."
                  : "Wait for a flying bee to come within one cell of this piece."}
            </p>
          )}
      </div>
    );

  return (
    <section
      ref={fullscreen.targetRef}
      className={`ww-session ww-game-window game-fullscreen-target${embedded ? " ww-review-flight" : ""}${level.rulesVersion >= 6 ? " ww-grid-play" : ""}`}
      aria-label="Waggle Way game window"
      onPointerDownCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        const target = event.target;
        event.currentTarget
          .querySelectorAll<HTMLDetailsElement>(
            ".ww-utility-bar > details[open], details[data-game-panel][open]",
          )
          .forEach((panel) => {
            if (!panel.contains(target)) panel.open = false;
          });
      }}
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest("summary"))
          setPlaying(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !(event.target instanceof Element))
          return;
        const panel = event.target.closest<HTMLDetailsElement>("details[open]");
        if (panel) {
          event.stopPropagation();
          panel.open = false;
          panel.querySelector<HTMLElement>("summary")?.focus();
        }
      }}
      data-game-fullscreen={fullscreen.isFullscreen || undefined}
      data-paused={!playing || undefined}
      data-reduced-motion={experience.settings.value.reducedMotion || undefined}
    >
      <div className="ww-session-heading">
        <span className="ww-chapter">
          {chapter ?? "Workshop · Test flight"}
        </span>
        <h2 tabIndex={-1} ref={titleRef}>
          {level.title}
        </h2>
      </div>
      <div className="ww-toolbar ww-run-toolbar">
        {navigation && (
          <div
            className="ww-navigation"
            onClickCapture={() => setPlaying(false)}
          >
            {navigation}
          </div>
        )}
        {onExit && (
          <Button
            variant="secondary"
            onClick={onExit}
            className={
              gridPlay ? "ww-compact-button ww-exit-button" : undefined
            }
            aria-label={exitLabel}
            title={exitLabel}
          >
            {gridPlay && <ArrowLeft size={16} aria-hidden="true" />}
            <span>{exitLabel}</span>
          </Button>
        )}
        {run.phase === "setup" ? (
          <Button
            onClick={() => {
              command({ type: "start" });
              setReviewTick(null);
              void playCue("start");
              setPlaying(true);
            }}
          >
            <Play size={16} aria-hidden="true" /> Open hive
          </Button>
        ) : (
          <Button
            disabled={run.phase === "finished"}
            onClick={() => {
              setBackgroundNotice("");
              setReviewTick(null);
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {playing ? "Pause" : "Resume"}
          </Button>
        )}
        {!gridPlay && stepButton}
        <Button
          variant="secondary"
          aria-label="Restart"
          className="ww-compact-button"
          onClick={() => {
            setPlaying(false);
            setBackgroundNotice("");
            setReviewTick(null);
            if (
              current.current.commands.some(
                (entry) => entry.command.type === "start",
              )
            ) {
              try {
                setPreviousAttempt(captureReplay(level, current.current));
              } catch {
                setPreviousAttempt(null);
                setBackgroundNotice(
                  "This attempt could not be kept for comparison. Attempts are limited to 30 minutes and 10,000 actions. You can still restart and play.",
                );
              }
              setShowGhost(false);
            }
            publish(createRun(level));
          }}
        >
          <RotateCcw size={16} aria-hidden="true" />
          <span>Restart</span>
        </Button>
        {previousAttempt && (
          <Button
            variant="secondary"
            aria-pressed={showGhost}
            onClick={() => setShowGhost(!showGhost)}
          >
            Compare previous attempt
          </Button>
        )}
        <label className={gridPlay ? "ww-speed-control" : undefined}>
          <span className={gridPlay ? "sr-only" : undefined}>Speed</span>{" "}
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={1}>{gridPlay ? "1×" : "Normal"}</option>
            <option value={3}>{gridPlay ? "3×" : "Fast ×3"}</option>
          </select>
        </label>
        {!embedded && (
          <GameFullscreenButton
            className="ww-compact-button"
            isFullscreen={fullscreen.isFullscreen}
            onToggle={fullscreen.toggleFullscreen}
          />
        )}
        {run.won && run.phase !== "finished" && (
          <Button
            onClick={() => {
              command({ type: "finish" });
              setPlaying(false);
            }}
          >
            Finish with {counts.rescued} bees
          </Button>
        )}
      </div>
      <div className="ww-stats" aria-label="Hive population">
        <span>
          <strong>{counts.hive}</strong> In hive
        </span>
        <span>
          <strong>{counts.flying}</strong> Flying
        </span>
        <span>
          <strong>{counts.assigned}</strong>{" "}
          {level.rulesVersion >= 3 ? "Helpers" : "Guides"}
        </span>
        {level.rulesVersion >= 3 &&
          (!gridPlay || counts.waiting > 0 || run.rallies.length > 0) && (
            <span>
              <strong>{counts.waiting}</strong> Waiting
            </span>
          )}
        <span>
          <strong>
            {counts.rescued}/{level.rescueTarget}
          </strong>{" "}
          {gridPlay ? "Rescued" : "Rescued / target"}
        </span>
        <span>
          <strong>{counts.lost}</strong> Lost
        </span>
      </div>
      {level.rulesVersion >= 5 &&
        (Boolean(run.pollen?.length) ||
          level.objectives!.maxTools !== undefined) && (
          <div className="ww-optional-goals" aria-label="Optional goals">
            {Boolean(run.pollen?.length) && (
              <span>
                <PieceIcon kind="pollen" /> Pollen: {pollen.available} available
                · {pollen.carried} carried · {pollen.delivered} delivered
                {level.objectives!.pollen > 0
                  ? ` / ${level.objectives!.pollen} goal`
                  : ""}
                {run.won &&
                pollen.delivered >= level.objectives!.pollen &&
                level.objectives!.pollen > 0
                  ? " · Goal achieved"
                  : ""}
              </span>
            )}
            {level.objectives!.maxTools !== undefined && (
              <span>
                Optional tool goal: peak {run.peakToolsPlaced} /{" "}
                {level.objectives!.maxTools}
                {run.won && run.peakToolsPlaced <= level.objectives!.maxTools
                  ? " · Goal achieved"
                  : ""}
              </span>
            )}
          </div>
        )}

      {showGhost && previousAttempt && (
        <div
          className="ww-ghost-summary"
          aria-label="Previous attempt comparison"
        >
          <p>
            Dashed bees marked G show the previous attempt. They cannot affect
            this run. Pause to review its timeline; resuming matches the current
            run. Kept only until you leave this garden.
          </p>
          <div className="ww-ghost-timeline">
            <label>
              Previous attempt time
              <input
                type="range"
                min={0}
                max={previousAttempt.endTick}
                step={1}
                value={Math.min(ghostTick, previousAttempt.endTick)}
                disabled={playing}
                aria-valuetext={`${(Math.min(ghostTick, previousAttempt.endTick) / TICKS_PER_SECOND).toFixed(1)} seconds`}
                onChange={(event) => setReviewTick(Number(event.target.value))}
              />
            </label>
            <Button
              variant="secondary"
              disabled={playing || reviewTick === null}
              onClick={() => setReviewTick(null)}
            >
              Match current run
            </Button>
            <span>
              {!playing && reviewTick !== null
                ? "Reviewing recording; current run is paused."
                : "Following the current run."}
            </span>
          </div>
          {ghost.error ? (
            <p role="alert">{ghost.error}</p>
          ) : ghost.frame ? (
            <p data-ghost-tick={ghost.frame.tick}>
              Previous attempt · tick {ghost.frame.tick}:{" "}
              {ghost.frame.counts.hive} in hive · {ghost.frame.counts.flying}{" "}
              flying · {ghost.frame.counts.assigned} helpers ·{" "}
              {ghost.frame.counts.waiting} waiting ·{" "}
              {ghost.frame.counts.rescued} rescued · {ghost.frame.counts.lost}{" "}
              lost
              {level.rulesVersion >= 5
                ? ` · ${ghost.frame.pollen.delivered} pollen delivered`
                : ""}
              .
              {ghostTick >= ghost.frame.endTick
                ? " Recording ends here; no later movement was recorded."
                : ""}
            </p>
          ) : (
            <p>Synchronizing the previous attempt…</p>
          )}
        </div>
      )}
      <div className="ww-workspace ww-play-workspace">
        <div
          className="ww-playfield"
          style={
            gridPlay
              ? ({
                  "--ww-board-aspect": `${level.width} / ${level.height}`,
                } as CSSProperties)
              : undefined
          }
        >
          <GardenViewport level={level} run={run} enabled={gridPlay}>
            <GardenScene
              level={level}
              run={run}
              ghostBees={ghost.frame?.bees}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setPlacingStock(false);
              }}
              onInteract={() => setPlaying(false)}
              onDropTool={(id, x, y) => {
                setPlaying(false);
                placeStock(x, y, id);
                setPlacingStock(false);
              }}
              onTurn={(objectId, direction) => {
                setPlaying(false);
                const object = current.current.objects.find(
                  (item) => item.id === objectId,
                )!;
                command({
                  type: "adjust",
                  objectId,
                  direction,
                  strength: object.strength,
                });
              }}
              onPlace={placingStock ? placeStock : undefined}
              onMove={(objectId, x, y) =>
                command({ type: "move", objectId, x, y })
              }
              overlays={overlays}
              preview={route}
            />
          </GardenViewport>
          {previewActive && (
            <p role="status" className="ww-caption">
              {preview.source !== run
                ? "Calculating route preview…"
                : preview.error || "Preview ready for the current setup."}
            </p>
          )}
        </div>
        <section className="ww-action-dock" aria-label="Tool controls">
          {Boolean(level.inventory?.length) && (
            <div className="ww-tool-supply">
              <div className="ww-tool-tray" aria-label="Player tool supply">
                {level.inventory!.map((stock) => {
                  const remaining =
                    stock.count -
                    run.deployed.filter((entry) => entry.stockId === stock.id)
                      .length;
                  const danceName =
                    stock.dance === "point"
                      ? "Point"
                      : stock.dance === "reverse"
                        ? "Reverse"
                        : stock.dance === "left"
                          ? "Left 90°"
                          : "Right 90°";
                  return (
                    <ToolTrayButton
                      key={stock.id}
                      kind={stock.kind}
                      label={
                        gridPlay && stock.kind === "dancer"
                          ? danceName
                          : undefined
                      }
                      ariaLabel={
                        gridPlay
                          ? `${OBJECT_LABELS[stock.kind]}${stock.kind === "dancer" ? ` · ${danceName}` : ""} · ${remaining} remaining`
                          : undefined
                      }
                      selected={placingStock && stockId === stock.id}
                      disabled={!remaining || run.phase === "finished"}
                      onDragBegin={() => setPlaying(false)}
                      onDrop={(x, y) => {
                        placeStock(x, y, stock.id);
                        setPlacingStock(false);
                      }}
                      onSelect={() => {
                        setStockId(stock.id);
                        setPlacingStock(
                          !(placingStock && stockId === stock.id),
                        );
                      }}
                    >
                      <strong>×{remaining}</strong>
                      {stock.kind === "dancer" && !gridPlay && (
                        <span>
                          {stock.dance === "point"
                            ? "Point"
                            : stock.dance === "reverse"
                              ? "Reverse"
                              : `${stock.dance} 90°`}
                        </span>
                      )}
                    </ToolTrayButton>
                  );
                })}
              </div>
              {(!gridPlay || placingStock) && (
                <p className="ww-caption">
                  {placingStock
                    ? "Tap an empty spot to place your tool. Tap the tray button again to cancel."
                    : level.rulesVersion >= 6
                      ? "Drag onto a cell, or tap then place."
                      : "Drag a tool into the garden, or tap a tool then its destination."}
                </p>
              )}
              <GamePanel
                compact={gridPlay}
                title={gridPlay ? "Place precisely" : "Precise tool placement"}
              >
                <label>
                  Supplied tool
                  <select
                    value={stockId}
                    onChange={(event) => setStockId(event.target.value)}
                  >
                    {level.inventory!.map((stock) => (
                      <option key={stock.id} value={stock.id}>
                        {OBJECT_LABELS[stock.kind]} ·{" "}
                        {stock.count -
                          run.deployed.filter(
                            (entry) => entry.stockId === stock.id,
                          ).length}{" "}
                        remaining · {stock.id}
                      </option>
                    ))}
                  </select>
                </label>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    placeStock(Number(data.get("x")), Number(data.get("y")));
                  }}
                >
                  <div className="ww-form-grid">
                    <label>
                      Tool placement column
                      <input
                        type="number"
                        name="x"
                        min={0}
                        max={level.width - 1}
                        defaultValue={5}
                        required
                      />
                    </label>
                    <label>
                      Tool placement row
                      <input
                        type="number"
                        name="y"
                        min={0}
                        max={level.height - 1}
                        defaultValue={5}
                        required
                      />
                    </label>
                  </div>
                  <Button type="submit" disabled={run.phase === "finished"}>
                    Place supplied tool
                  </Button>
                </form>
                <label>
                  <input
                    type="checkbox"
                    checked={placingStock}
                    onChange={(event) => setPlacingStock(event.target.checked)}
                  />{" "}
                  Place supplied tools by tapping empty garden space
                </label>
                <p className="ww-caption">
                  Peak tools placed from supply: {run.peakToolsPlaced}. Returned
                  tools can be placed again.
                  {gridPlay &&
                    " Dancer uses return only during setup; release after launch keeps the use spent."}
                </p>
              </GamePanel>
            </div>
          )}
          {gridPlay && (
            <div className="ww-quick-tools">
              <span className="ww-selection-name">
                {selected ? OBJECT_LABELS[selected.kind] : "Tap a piece"}
              </span>
              {helperAction}
            </div>
          )}
          <GamePanel compact={gridPlay} title="Tool options" inlineLegacy>
            {gridPlay && stepButton}
            <div className="ww-selected-controls">
              <details className="ww-object-picker">
                <summary>
                  {selected ? OBJECT_LABELS[selected.kind] : "Select a piece"} ·
                  choose another
                </summary>
                <label>
                  Inspect object
                  <select
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {run.objects.map((object) => (
                      <option key={object.id} value={object.id}>
                        {OBJECT_LABELS[object.kind]} · {object.id}
                      </option>
                    ))}
                  </select>
                </label>
              </details>
              {selected && (
                <>
                  {selected.kind === "gate" && (
                    <p role="status">
                      Gate {gateState(run, selected)}. Operated by{" "}
                      {selected.switchId}.{" "}
                      {gateState(run, selected) === "closing"
                        ? "Waiting for bees inside to clear before closing."
                        : "Closed gates block flight and wind; open gates let both through."}
                    </p>
                  )}
                  {selected.kind === "rally" && (
                    <div>
                      <p>
                        Rally{" "}
                        {
                          run.rallies.find(
                            (entry) => entry.objectId === selected.id,
                          )?.mode
                        }
                        .{" "}
                        {
                          run.bees.filter(
                            (bee) =>
                              bee.status === "waiting" &&
                              bee.perchId === selected.id,
                          ).length
                        }{" "}
                        bees waiting. Release sends bees in order,{" "}
                        {level.releaseInterval} ticks apart.
                      </p>
                      <Button
                        disabled={run.phase === "finished"}
                        onClick={() =>
                          command({
                            type: "rally",
                            objectId: selected.id,
                            mode:
                              run.rallies.find(
                                (entry) => entry.objectId === selected.id,
                              )?.mode === "hold"
                                ? "release"
                                : "hold",
                          })
                        }
                      >
                        {run.rallies.find(
                          (entry) => entry.objectId === selected.id,
                        )?.mode === "hold"
                          ? "Release rally"
                          : "Hold arrivals"}
                      </Button>
                    </div>
                  )}
                  {selected.kind === "switch" && (
                    <p>
                      This helper holds linked gates open without dancing.
                      Gates:{" "}
                      {run.objects
                        .filter((object) => object.switchId === selected.id)
                        .map((object) => object.id)
                        .join(", ") || "none"}
                      . Release the operator to bring it home.
                    </p>
                  )}
                  {selected.kind === "dancer" && (
                    <details className="ww-dance-rules">
                      <summary>Dance rules</summary>
                      <p className="ww-caption">
                        {selected.dance === "point"
                          ? "Points passing bees along the arrow once per entry. The arrow also sets this helper's release direction."
                          : `Turns passing bees ${selected.dance === "reverse" ? "around" : `${selected.dance} 90°`} once per entry. ${level.rulesVersion >= 7 ? "On release, the helper follows the last bee it guided. Before guiding anyone, it turns its arrival heading by its dance." : "The arrow sets this helper's release direction."}`}{" "}
                        Release after launch does not refill the dance supply.
                      </p>
                    </details>
                  )}
                  {(selected.kind === "fan" ||
                    selected.kind === "perch" ||
                    selected.kind === "dancer" ||
                    selected.kind === "switch" ||
                    selected.kind === "rally" ||
                    selected.kind === "shelter") && (
                    <>
                      {selected.kind !== "shelter" &&
                        !(
                          level.rulesVersion >= 7 &&
                          selected.kind === "dancer" &&
                          selected.dance !== "point"
                        ) && (
                          <DirectionPad
                            compact={level.rulesVersion >= 6}
                            direction={selected.direction}
                            disabled={
                              selected.permission === "fixed" ||
                              run.phase === "finished"
                            }
                            onChange={(direction) =>
                              command({
                                type: "adjust",
                                objectId: selected.id,
                                direction,
                                strength: selected.strength,
                              })
                            }
                          />
                        )}
                      {selected.kind === "shelter" && (
                        <p>
                          A leaf blocks wind across its rectangle. Bees can fly
                          through it. In rainy gardens, it also keeps the column
                          below it dry.
                        </p>
                      )}
                      {selected.kind === "fan" && (
                        <label>
                          Fan strength
                          <select
                            disabled={
                              selected.permission === "fixed" ||
                              run.phase === "finished"
                            }
                            value={selected.strength}
                            onChange={(event) =>
                              command({
                                type: "adjust",
                                objectId: selected.id,
                                direction: selected.direction,
                                strength: Number(event.target.value),
                              })
                            }
                          >
                            <option value={1}>Gentle</option>
                            <option value={2}>Medium</option>
                            <option value={3}>Strong</option>
                          </select>
                        </label>
                      )}
                      {!gridPlay && helperAction}
                      {selected.permission === "movable" && (
                        <details>
                          <summary>Precise position</summary>
                          <form
                            key={`${selected.id}-${selected.x}-${selected.y}`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const data = new FormData(event.currentTarget);
                              command({
                                type: "move",
                                objectId: selected.id,
                                x: Number(data.get("column")),
                                y: Number(data.get("row")),
                              });
                            }}
                          >
                            <label>
                              Move to column
                              <input
                                name="column"
                                type="number"
                                min={0}
                                max={level.width - selected.width}
                                defaultValue={selected.x}
                                required
                              />
                            </label>
                            <label>
                              Move to row
                              <input
                                name="row"
                                type="number"
                                min={0}
                                max={level.height - selected.height}
                                defaultValue={selected.y}
                                required
                              />
                            </label>
                            <Button
                              variant="secondary"
                              disabled={run.phase === "finished"}
                              type="submit"
                            >
                              Move tool
                            </Button>
                          </form>
                        </details>
                      )}
                      {selected.kind !== "dancer" &&
                        run.deployed.some(
                          (entry) => entry.objectId === selected.id,
                        ) && (
                          <Button
                            variant="secondary"
                            disabled={
                              run.phase === "finished" ||
                              run.bees.some(
                                (bee) => bee.perchId === selected.id,
                              )
                            }
                            onClick={() =>
                              command({
                                type: "recover",
                                objectId: selected.id,
                              })
                            }
                          >
                            Return tool to supply
                          </Button>
                        )}
                    </>
                  )}
                </>
              )}
            </div>
          </GamePanel>
        </section>
      </div>
      <p className="ww-notice" role="status">
        {backgroundNotice || run.notice}
      </p>
      <div
        className="ww-utility-bar"
        aria-label="Garden information"
        onClickCapture={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("summary")
          )
            setPlaying(false);
        }}
      >
        <details name="ww-information" className="ww-panel ww-mission">
          <summary>{gridPlay ? "Mission" : "Mission & hints"}</summary>
          <div className="ww-panel-content">
            <p>{level.instructions}</p>
            {help}
          </div>
        </details>
        <details name="ww-information" className="ww-panel">
          <summary>{gridPlay ? "View" : "View and route preview"}</summary>
          <div className="ww-panel-content">
            {" "}
            <div className="ww-toolbar ww-view-controls">
              <label>
                <input
                  type="checkbox"
                  checked={overlays}
                  onChange={(event) => setOverlays(event.target.checked)}
                />{" "}
                Show wind and dance range
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(event) => setShowPreview(event.target.checked)}
                />{" "}
                Preview next three seconds while paused
              </label>
            </div>
            <p className="ww-caption">
              Columns increase to the right; rows increase downward. Preview
              assumes the current setup and no further commands.
            </p>
          </div>
        </details>
        <ExperienceControls experience={experience} compact={gridPlay} />
        {run.objects.some((object) => object.kind === "sprinkler") && (
          <details name="ww-information" className="ww-panel">
            <summary>{gridPlay ? "Spray" : "Sprinkler forecast"}</summary>
            <div className="ww-panel-content">
              <p>
                Dry and warning phases are safe. Rain catches flying, waiting
                and helper bees. Leaves, branches and closed gates stop rain
                falling into the space below. Pause freezes every cycle; Step
                advances one tick (30 ticks per second).
              </p>
              <ul>
                {run.objects
                  .filter((object) => object.kind === "sprinkler")
                  .map((object) => {
                    const weather = sprinklerPhase(object, run.tick);
                    return (
                      <li key={object.id}>
                        {object.id}: {weather.phase}, {weather.ticksRemaining}{" "}
                        ticks until{" "}
                        {weather.phase === "dry"
                          ? "warning"
                          : weather.phase === "warning"
                            ? "rain"
                            : "dry"}
                        . Rain columns {object.x}–{object.x + object.width},
                        down to row {object.y + object.height + object.range}{" "}
                        before shelter.
                      </li>
                    );
                  })}
              </ul>
            </div>
          </details>
        )}
        <details name="ww-information" className="ww-panel">
          <summary>{gridPlay ? "Bees" : "Inspect individual bees"}</summary>
          <div className="ww-panel-content">
            <p>Pause or step to inspect a stable snapshot. Tick {run.tick}.</p>
            <div className="ww-bee-list">
              {run.bees.map((bee) => (
                <p key={bee.id}>
                  Bee {bee.id + 1}: {bee.status}; column{" "}
                  {(bee.x / 1000).toFixed(2)}, row {(bee.y / 1000).toFixed(2)};
                  heading {DIRECTION_NAMES[bee.direction]}
                  {bee.signalId ? `; following ${bee.signalId}` : ""}
                  {bee.perchId ? `; at ${bee.perchId}` : ""}
                  {bee.lossReason === "rain" ? "; caught in rain" : ""}.
                </p>
              ))}
            </div>
            {ghost.frame && (
              <>
                <h3>Previous attempt bees · tick {ghost.frame.tick}</h3>
                <div className="ww-bee-list">
                  {ghost.frame.bees.map((bee) => (
                    <p key={bee.id}>
                      Ghost G{bee.id + 1}: {bee.status}; column{" "}
                      {(bee.x / 1000).toFixed(2)}, row{" "}
                      {(bee.y / 1000).toFixed(2)}; heading{" "}
                      {DIRECTION_NAMES[bee.direction]}
                      {bee.perchId ? `; at ${bee.perchId}` : ""}
                      {bee.lossReason ? `; lost to ${bee.lossReason}` : ""}.
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
