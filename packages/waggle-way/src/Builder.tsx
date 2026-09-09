import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { DialogShell } from "@ares/ui/dialog";
import {
  GameFullscreenButton,
  useGameFullscreen,
} from "@ares/game-common/fullscreen";
import ToolTrayButton from "./ui/ToolTrayButton";
import DirectionPad from "./ui/DirectionPad";
import { Button } from "@ares/ui/button";
import GardenScene, { OBJECT_LABELS } from "./ui/GardenScene";
import GameSession from "./ui/GameSession";
import InventoryEditor from "./ui/InventoryEditor";
import GamePanel from "./ui/GamePanel";
import {
  addObject,
  deleteObject,
  duplicateObject,
  editLevel,
  redoEdit,
  undoEdit,
  updateObject,
  type EditorState,
} from "./core/editor";
import {
  createBlankLevel,
  DIRECTION_NAMES,
  DANCE_TYPES,
  type DanceType,
  MAX_LEVEL_BYTES,
  LEVEL_VERSION,
  GARDEN_THEMES,
  type GardenTheme,
  parseLevelFile,
  serializeLevel,
  upgradeLevel,
  type Direction,
  type LevelDefinition,
  type ObjectKind,
  type Permission,
} from "./core/level";
import { loadDrafts, recoverDraftLibrary, saveDraft } from "./core/storage";
import type { RunState } from "./core/engine";
import WorkshopCommunity, {
  type WorkshopCommunityAccess,
} from "./ui/WorkshopCommunity";
import RemixGarden, { type RemixSource } from "./ui/RemixGarden";
import {
  bindPublication,
  createWorkshop,
  editWorkshop,
  forgetPublications,
  recordWinningFlight,
  submissionEvidence,
  type DraftOrigin,
} from "./workshopState";
import "./waggle-way.css";

function newGarden(): LevelDefinition {
  const blank = createBlankLevel(7);
  blank.inventory = [
    {
      id: "pointing-dancer",
      kind: "dancer",
      dance: "point",
      count: 2,
      width: 1,
      height: 1,
      direction: 0,
      range: 1,
      strength: 1,
    },
  ];
  return blank;
}

function downloadFile(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Builder({
  playLink,
  community,
  remix,
}: {
  playLink: ReactNode;
  community?: WorkshopCommunityAccess;
  remix?: { source: RemixSource; onClose: () => void };
}) {
  const [workshop, setWorkshop] = useState(() => createWorkshop(newGarden()));
  const fullscreen = useGameFullscreen();
  const editor = workshop.editor;
  const testButton = useRef<HTMLButtonElement>(null);
  const accountScope = community
    ? `${community.accountKey}:${community.canSubmit}:${Boolean(community.canReview)}`
    : "";
  useEffect(() => {
    setWorkshop((previous) => forgetPublications(previous));
  }, [accountScope]);
  const [selectedId, setSelectedId] = useState("hive");
  const [palette, setPalette] = useState<ObjectKind | "select">("select");
  const [paletteGroup, setPaletteGroup] = useState<
    "guidance" | "landscape" | "machines"
  >("guidance");
  const [notice, setNotice] = useState(
    "Build a route, then test it. New and loaded gardens can be undone while this page stays open.",
  );
  const [error, setError] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const propertiesButton = useRef<HTMLButtonElement>(null);
  const [testing, setTesting] = useState(false);
  const wasTesting = useRef(false);
  useEffect(() => {
    if (wasTesting.current && !testing) testButton.current?.focus();
    wasTesting.current = testing;
  }, [testing]);
  const [drafts, setDrafts] = useState<LevelDefinition[]>([]);
  const [zoom, setZoom] = useState(1);
  const [overlays, setOverlays] = useState(true);
  const level = editor.level;
  const gridWorkshop = level.rulesVersion >= 6;
  const origin = workshop.origins.get(level) ?? null;
  const evidence = submissionEvidence(level, workshop.flights);
  const onResult = useCallback(
    (run: RunState) => {
      setWorkshop((previous) => recordWinningFlight(previous, level, run));
    },
    [level],
  );
  const selected = level.objects.find((object) => object.id === selectedId);

  const report = (message: string, failed = false) => {
    setNotice(message);
    setError(failed);
  };
  const commit = (
    change: (previous: EditorState) => EditorState,
    message = "Garden updated. Changes are not saved until you choose Save.",
    draftOrigin?: DraftOrigin | null,
  ) => {
    try {
      const next = editWorkshop(workshop, change, draftOrigin);
      setWorkshop(next);
      if (next.editor.level.rulesVersion < 6 && palette === "dancer") {
        setPalette("select");
      }
      report(message);
      return next.editor;
    } catch (cause) {
      report(
        cause instanceof Error
          ? cause.message
          : "This change could not be applied.",
        true,
      );
      return null;
    }
  };
  const place = (x: number, y: number) => {
    if (palette === "select") return;
    const next = commit((previous) => addObject(previous, palette, x, y));
    if (next) setSelectedId(next.level.objects.at(-1)!.id);
  };
  const dropPiece = (kind: string, x: number, y: number) => {
    if (
      ![
        "terrain",
        "water",
        "perch",
        "fan",
        "shelter",
        "switch",
        "gate",
        "rally",
        "sprinkler",
        "pollen",
        ...(gridWorkshop ? ["dancer"] : []),
      ].includes(kind)
    )
      return;
    const next = commit((previous) =>
      addObject(previous, kind as ObjectKind, x, y),
    );
    if (next) {
      setSelectedId(next.level.objects.at(-1)!.id);
      setPalette("select");
    }
  };
  const applyProperties = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    commit((previous) =>
      updateObject(previous, selected.id, {
        x: Number(data.get("x")),
        y: Number(data.get("y")),
        width: Number(data.get("width")),
        height: Number(data.get("height")),
        direction: Number(
          data.get("direction") ?? selected.direction,
        ) as Direction,
        range: Number(data.get("range") ?? selected.range),
        strength: Number(data.get("strength") ?? selected.strength),
        ...(selected.kind === "gate"
          ? { switchId: String(data.get("switchId")) }
          : {}),
        ...(selected.kind === "dancer"
          ? { dance: String(data.get("dance")) as DanceType }
          : {}),
        ...(selected.kind === "sprinkler"
          ? {
              cycle: {
                dryTicks: Number(data.get("dryTicks")),
                warningTicks: Number(data.get("warningTicks")),
                wetTicks: Number(data.get("wetTicks")),
                offsetTicks: Number(data.get("offsetTicks")),
              },
            }
          : {}),
        permission: (data.get("permission") ??
          selected.permission) as Permission,
      }),
    );
  };

  return (
    <section className="ww-page ww-game-page">
      {community && remix && (
        <RemixGarden
          key={`${remix.source.id}:${remix.source.revision}`}
          client={community.client}
          source={remix.source}
          onClose={remix.onClose}
          returnFocusRef={testButton}
          onExport={() =>
            downloadFile(`${level.id}.waggle.json`, serializeLevel(level))
          }
          onLoad={(garden) => {
            const next = commit(
              (previous) =>
                editLevel(previous, {
                  ...garden.level,
                  id: crypto.randomUUID(),
                }),
              "Remix opened. Make it your own, then test it before sharing.",
              {
                publication: null,
                parent: { id: garden.id, revision: garden.revision },
              },
            );
            if (!next) return false;
            setSelectedId(next.level.objects[0].id);
            setTesting(false);
            return true;
          }}
        />
      )}
      <header className="ww-header">
        <div>
          <p className="ww-eyebrow">Waggle Way · Workshop</p>
          <h1>Your garden</h1>
        </div>
        {playLink}
      </header>
      {testing && (
        <GameSession
          level={level}
          onResult={onResult}
          fullscreenController={fullscreen}
          onExit={() => setTesting(false)}
        />
      )}
      <section
        hidden={testing}
        ref={testing ? undefined : fullscreen.targetRef}
        className={`ww-workshop-window game-fullscreen-target${gridWorkshop ? " ww-grid-workshop" : ""}`}
        aria-label="Waggle Way workshop window"
        onPointerDownCapture={(event) => {
          if (!(event.target instanceof Element)) return;
          const target = event.target;
          // Portaled dialogs keep their launching disclosure available for focus return.
          if (target.closest('[role="dialog"]')) return;
          event.currentTarget
            .querySelectorAll<HTMLDetailsElement>(
              "details[data-game-panel][open]",
            )
            .forEach((panel) => {
              if (!panel.contains(target)) panel.open = false;
            });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !(event.target instanceof Element))
            return;
          const panel = event.target.closest<HTMLDetailsElement>(
            "details[data-game-panel][open]",
          );
          if (panel) {
            event.stopPropagation();
            panel.open = false;
            panel.querySelector("summary")?.focus();
          }
        }}
        data-game-fullscreen={
          (!testing && fullscreen.isFullscreen) || undefined
        }
      >
        <div className="ww-toolbar ww-workshop-toolbar">
          <Button
            ref={testButton}
            aria-label="Test garden"
            onClick={() => setTesting(true)}
          >
            {gridWorkshop ? "Test" : "Test garden"}
          </Button>
          <GameFullscreenButton
            className={gridWorkshop ? "ww-compact-button" : undefined}
            isFullscreen={fullscreen.isFullscreen}
            onToggle={fullscreen.toggleFullscreen}
          />
          {community && (
            <GamePanel compact={gridWorkshop} title="Community" inlineLegacy>
              {gridWorkshop && (
                <p>
                  Dancer gardens can be saved and exported locally. Community
                  publishing does not support them yet.
                </p>
              )}
              <WorkshopCommunity
                key={accountScope}
                access={community}
                level={level}
                flights={workshop.flights}
                origin={origin}
                returnFocusRef={testButton}
                onBind={(submittedLevel, binding) =>
                  setWorkshop((previous) =>
                    bindPublication(previous, submittedLevel, binding),
                  )
                }
                onDeleted={(id) =>
                  setWorkshop((previous) => forgetPublications(previous, id))
                }
                onExport={() =>
                  downloadFile(`${level.id}.waggle.json`, serializeLevel(level))
                }
                onLoad={(revision) => {
                  const next = commit(
                    (previous) => editLevel(previous, revision.level),
                    "Community revision loaded. Test your changes before submitting them for review.",
                    {
                      publication: {
                        id: revision.garden.id,
                        version: revision.garden.version,
                        accountKey: community.accountKey,
                        metadata: revision.metadata,
                      },
                    },
                  );
                  if (next) setSelectedId(next.level.objects[0].id);
                }}
              />
            </GamePanel>
          )}

          <Button
            variant="secondary"
            disabled={!editor.past.length}
            onClick={() =>
              commit(undoEdit, "Previous edit restored. Save to keep it.")
            }
          >
            Undo
          </Button>
          <Button
            variant="secondary"
            disabled={!editor.future.length}
            onClick={() => commit(redoEdit)}
          >
            Redo
          </Button>
          <Button
            variant="secondary"
            aria-label="Save garden"
            onClick={() => {
              try {
                setDrafts(saveDraft(localStorage, level));
                report(
                  "Garden saved in this browser. Export a file for another device.",
                );
              } catch (cause) {
                report((cause as Error).message, true);
              }
            }}
          >
            {gridWorkshop ? "Save" : "Save garden"}
          </Button>
        </div>
        {community && !gridWorkshop && (
          <p className="ww-caption" role="status">
            {evidence.ready
              ? "Successful test flights recorded for sharing."
              : "Test the finished garden to record flights for sharing."}
          </p>
        )}
        {workshop.flightError && (
          <p className="ww-error" role="alert">
            {workshop.flightError}
          </p>
        )}
        <p
          className={`ww-notice ${error ? "ww-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {notice}
        </p>
        <div className="ww-workspace ww-builder-workspace">
          <div>
            <div
              className="ww-scroll-scene"
              tabIndex={0}
              aria-label="Garden viewport; use arrow keys to scroll when zoomed"
            >
              <div
                style={{
                  width:
                    zoom === 1
                      ? `min(100%, calc(${((gridWorkshop ? 50 : 65) * level.width) / level.height}dvh - ${(2 * level.width) / level.height}px))`
                      : `${zoom * 100}%`,
                  marginInline: "auto",
                }}
              >
                <GardenScene
                  level={level}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onTurn={(id, direction) =>
                    commit((previous) =>
                      updateObject(previous, id, { direction }),
                    )
                  }
                  onDropPiece={dropPiece}
                  onPlace={place}
                  onMove={(id, x, y) => {
                    commit((previous) => updateObject(previous, id, { x, y }));
                  }}
                  overlays={overlays}
                />
              </div>
            </div>
            {gridWorkshop && (
              <div
                className="ww-palette-groups"
                role="group"
                aria-label="Piece categories"
              >
                {(["guidance", "landscape", "machines"] as const).map(
                  (group) => (
                    <Button
                      key={group}
                      variant="secondary"
                      aria-pressed={paletteGroup === group}
                      onClick={() => {
                        setPaletteGroup(group);
                        setPalette("select");
                      }}
                    >
                      {group === "guidance"
                        ? "Guidance"
                        : group === "landscape"
                          ? "Landscape"
                          : "Machines"}
                    </Button>
                  ),
                )}
              </div>
            )}
            <div className="ww-palette" aria-label="Object palette">
              {(
                [
                  "select",
                  ...(gridWorkshop ? ["dancer" as const] : ["perch" as const]),
                  "fan",
                  "terrain",
                  "water",
                  ...(level.schemaVersion !== 1 ? ["shelter" as const] : []),
                  ...(level.schemaVersion >= 3
                    ? (["switch", "gate", "rally"] as const)
                    : []),
                  ...(level.schemaVersion >= 4 ? ["sprinkler" as const] : []),
                  ...(level.schemaVersion >= 5 ? ["pollen" as const] : []),
                ] as const
              )
                .filter(
                  (kind) =>
                    !gridWorkshop ||
                    kind === "select" ||
                    (paletteGroup === "guidance"
                      ? ["dancer", "fan", "rally"]
                      : paletteGroup === "landscape"
                        ? ["terrain", "water", "shelter", "pollen"]
                        : ["switch", "gate", "sprinkler"]
                    ).includes(kind),
                )
                .map((kind) =>
                  kind === "select" ? (
                    <Button
                      key={kind}
                      variant="secondary"
                      aria-pressed={palette === kind}
                      onClick={() => setPalette(kind)}
                    >
                      Select
                    </Button>
                  ) : (
                    <ToolTrayButton
                      key={kind}
                      kind={kind}
                      selected={palette === kind}
                      onSelect={() => setPalette(kind)}
                      onDrop={(x, y) => dropPiece(kind, x, y)}
                    />
                  ),
                )}
            </div>
            <p className="ww-caption">
              {gridWorkshop
                ? "Drag or tap to place. Drag pieces to move; arrows to turn. Use precise controls below for keyboard placement."
                : "Drag a piece from the tray, or tap a piece and then the garden. Drag placed pieces to move them and their arrows to turn. Precise controls are available below."}
            </p>
            <GamePanel compact={gridWorkshop} title="Place by coordinates">
              <form
                className="ww-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  place(Number(data.get("column")), Number(data.get("row")));
                }}
              >
                <label>
                  Placement column
                  <input
                    name="column"
                    type="number"
                    min={0}
                    max={level.width - 1}
                    defaultValue={5}
                    required
                  />
                </label>
                <label>
                  Placement row
                  <input
                    name="row"
                    type="number"
                    min={0}
                    max={level.height - 1}
                    defaultValue={5}
                    required
                  />
                </label>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={palette === "select"}
                >
                  Place selected piece
                </Button>
              </form>
            </GamePanel>
            <div className="ww-toolbar ww-view-controls">
              <label>
                Zoom
                <select
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                >
                  <option value={1}>Fit garden</option>
                  <option value={1.5}>150%</option>
                  <option value={2}>200%</option>
                  <option value={3}>300%</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={overlays}
                  onChange={(event) => setOverlays(event.target.checked)}
                />{" "}
                Wind and range overlays
              </label>
            </div>
          </div>
          <section className="ww-builder-dock" aria-label="Garden pieces">
            <label>
              Selected object
              <select
                value={selected ? selectedId : ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="" disabled>
                  Select an object
                </option>
                {level.objects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {OBJECT_LABELS[object.kind]} · {object.id}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <>
                {!gridWorkshop &&
                  ["hive", "fan", "perch", "switch", "rally"].includes(
                    selected.kind,
                  ) && (
                    <DirectionPad
                      direction={selected.direction}
                      onChange={(direction) =>
                        commit((previous) =>
                          updateObject(previous, selected.id, { direction }),
                        )
                      }
                    />
                  )}
                <Button
                  ref={propertiesButton}
                  variant="secondary"
                  onClick={() => setPropertiesOpen(true)}
                >
                  Edit piece
                </Button>
              </>
            )}
            <DialogShell
              open={propertiesOpen}
              onOpenChange={setPropertiesOpen}
              title="Object properties"
              className="ww-page"
              returnFocusRef={propertiesButton}
            >
              {error && (
                <p className="ww-notice ww-error" role="alert">
                  {notice}
                </p>
              )}
              {selected && (
                <form key={JSON.stringify(selected)} onSubmit={applyProperties}>
                  <div className="ww-form-grid">
                    {(["x", "y", "width", "height"] as const).map((field) => (
                      <label key={field}>
                        {
                          {
                            x: "Column",
                            y: "Row",
                            width: "Width",
                            height: "Height",
                          }[field]
                        }
                        <input
                          name={field}
                          type="number"
                          min={field === "x" || field === "y" ? 0 : 1}
                          max={
                            field === "x" || field === "width"
                              ? level.width
                              : level.height
                          }
                          defaultValue={selected[field]}
                          required
                        />
                      </label>
                    ))}
                  </div>
                  {selected.kind === "hive" ||
                  selected.kind === "fan" ||
                  selected.kind === "perch" ||
                  (selected.kind === "dancer" &&
                    !(level.rulesVersion >= 7 && selected.dance !== "point")) ||
                  selected.kind === "switch" ||
                  selected.kind === "rally" ? (
                    <label>
                      Heading
                      <select
                        name="direction"
                        defaultValue={selected.direction}
                      >
                        {DIRECTION_NAMES.map((name, index) => (
                          <option key={name} value={index}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {selected.kind === "dancer" && (
                    <label>
                      Dance type
                      <select name="dance" defaultValue={selected.dance}>
                        {DANCE_TYPES.map((dance) => (
                          <option key={dance} value={dance}>
                            {dance === "point"
                              ? "Point a direction"
                              : dance === "reverse"
                                ? "Reverse 180°"
                                : `Turn ${dance} 90°`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(selected.kind === "fan" ||
                    selected.kind === "perch" ||
                    selected.kind === "dancer" ||
                    selected.kind === "switch" ||
                    selected.kind === "rally") && (
                    <>
                      {(selected.kind === "fan" ||
                        selected.kind === "perch" ||
                        selected.kind === "dancer") && (
                        <label>
                          Influence range
                          <input
                            type="number"
                            name="range"
                            min={1}
                            max={16}
                            defaultValue={selected.range}
                            required
                          />
                        </label>
                      )}
                      {selected.kind === "fan" && (
                        <label>
                          Strength
                          <select
                            name="strength"
                            defaultValue={selected.strength}
                          >
                            <option value={1}>Gentle</option>
                            <option value={2}>Medium</option>
                            <option value={3}>Strong</option>
                          </select>
                        </label>
                      )}
                      <label>
                        Player permission
                        <select
                          name="permission"
                          defaultValue={selected.permission}
                        >
                          <option value="fixed">Fixed</option>
                          <option value="adjustable">Can turn</option>
                          <option value="movable">Can turn and move</option>
                        </select>
                      </label>
                    </>
                  )}
                  {selected.kind === "shelter" && (
                    <label>
                      Player permission
                      <select
                        name="permission"
                        defaultValue={selected.permission}
                      >
                        <option value="fixed">Fixed</option>
                        <option value="movable">Can move</option>
                      </select>
                    </label>
                  )}
                  {selected.kind === "sprinkler" && (
                    <fieldset>
                      <legend>Sprinkler timing</legend>
                      <p>
                        Rain falls down from the nozzle. 30 ticks = 1 second.
                        The cycle repeats dry, warning, then rain; warning is
                        still safe. The offset chooses where it starts. Pausing
                        freezes the cycle.
                      </p>
                      <label>
                        Rain range
                        <input
                          type="number"
                          name="range"
                          min={1}
                          max={16}
                          defaultValue={selected.range}
                          required
                        />
                      </label>
                      <label>
                        Dry ticks
                        <input
                          type="number"
                          name="dryTicks"
                          min={1}
                          max={1800}
                          defaultValue={selected.cycle!.dryTicks}
                          required
                        />
                      </label>
                      <label>
                        Warning ticks
                        <input
                          type="number"
                          name="warningTicks"
                          min={1}
                          max={300}
                          defaultValue={selected.cycle!.warningTicks}
                          required
                        />
                      </label>
                      <label>
                        Rain ticks
                        <input
                          type="number"
                          name="wetTicks"
                          min={1}
                          max={1800}
                          defaultValue={selected.cycle!.wetTicks}
                          required
                        />
                      </label>
                      <label>
                        Cycle offset
                        <input
                          type="number"
                          name="offsetTicks"
                          min={0}
                          max={3899}
                          defaultValue={selected.cycle!.offsetTicks}
                          required
                        />
                      </label>
                    </fieldset>
                  )}
                  {selected.kind === "gate" && (
                    <label>
                      Operated by switch
                      <select name="switchId" defaultValue={selected.switchId}>
                        {level.objects
                          .filter((object) => object.kind === "switch")
                          .map((object) => (
                            <option key={object.id} value={object.id}>
                              {object.id}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  {selected.kind === "switch" && (
                    <p>
                      Linked gates:{" "}
                      {level.objects
                        .filter((object) => object.switchId === selected.id)
                        .map((object) => object.id)
                        .join(", ") || "none"}
                      . Relink or delete these gates before deleting the switch.
                      Undo restores each change.
                    </p>
                  )}
                  <Button type="submit">Apply properties</Button>
                  <div className="ww-toolbar">
                    <Button
                      variant="secondary"
                      disabled={
                        level.rulesVersion >= 7 &&
                        selected.kind === "dancer" &&
                        selected.dance !== "point"
                      }
                      onClick={() =>
                        commit((previous) =>
                          updateObject(
                            previous,
                            selected.id,
                            selected.kind === "hive" ||
                              selected.kind === "fan" ||
                              selected.kind === "perch" ||
                              selected.kind === "dancer" ||
                              selected.kind === "switch" ||
                              selected.kind === "rally"
                              ? {
                                  direction: ((selected.direction + 1) %
                                    8) as Direction,
                                }
                              : {
                                  width: selected.height,
                                  height: selected.width,
                                },
                          ),
                        )
                      }
                    >
                      {selected.kind === "hive" ||
                      selected.kind === "fan" ||
                      selected.kind === "perch" ||
                      selected.kind === "dancer" ||
                      selected.kind === "switch" ||
                      selected.kind === "rally"
                        ? "Rotate 45°"
                        : "Rotate shape 90°"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={
                        selected.kind === "hive" || selected.kind === "flowers"
                      }
                      onClick={() =>
                        commit((previous) =>
                          deleteObject(previous, selected.id),
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>
                  <p className="ww-caption">
                    To duplicate, enter an empty column and row in the
                    properties above, then choose Duplicate there.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={
                      selected.kind === "hive" || selected.kind === "flowers"
                    }
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      if (!form) return;
                      const data = new FormData(form);
                      const next = commit((previous) =>
                        duplicateObject(
                          previous,
                          selected.id,
                          Number(data.get("x")),
                          Number(data.get("y")),
                        ),
                      );
                      if (next) setSelectedId(next.level.objects.at(-1)!.id);
                    }}
                  >
                    Duplicate there
                  </Button>
                </form>
              )}
            </DialogShell>
          </section>
        </div>
        <div className={gridWorkshop ? "ww-workshop-menus" : undefined}>
          <GamePanel
            compact={gridWorkshop}
            title="Files and saved gardens"
            legacyClassName="ww-panel"
          >
            <div className="ww-toolbar">
              {" "}
              <Button
                variant="secondary"
                onClick={() => {
                  const blank = newGarden();
                  blank.id = `garden-${Date.now().toString(36)}`;
                  if (
                    commit(
                      (previous) => editLevel(previous, blank),
                      "New garden. Bees fly across water, but dancers need dry ground. Turn and reverse helpers follow the last bee they guided. Undo restores the previous garden.",
                      null,
                    )
                  )
                    setSelectedId("hive");
                }}
              >
                New garden
              </Button>{" "}
              {level.rulesVersion === 6 && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    commit(
                      (previous) =>
                        editLevel(previous, {
                          ...previous.level,
                          schemaVersion: 7,
                          rulesVersion: 7,
                        }),
                      "Dancer rules updated: dry-ground placement and automatic turn-helper release. Undo restores version 6.",
                    )
                  }
                >
                  Upgrade dancer rules
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    setDrafts(loadDrafts(localStorage));
                    report("Local library loaded.");
                  } catch (cause) {
                    report((cause as Error).message, true);
                  }
                }}
              >
                Load library
              </Button>{" "}
              <Button
                variant="secondary"
                onClick={() => {
                  try {
                    downloadFile(
                      `${level.id}.waggle.json`,
                      serializeLevel(level),
                    );
                    report("Level file prepared for download.");
                  } catch (cause) {
                    report((cause as Error).message, true);
                  }
                }}
              >
                Export garden
              </Button>
            </div>
            <label>
              Import a garden file
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > MAX_LEVEL_BYTES)
                      throw new Error(
                        "Level files must be no larger than 256 KiB.",
                      );
                    const imported = parseLevelFile(await file.text());
                    // Merge with the latest history if edits occur while the file is being read.
                    setWorkshop((previous) =>
                      editWorkshop(
                        previous,
                        (current) => editLevel(current, imported),
                        null,
                      ),
                    );
                    setSelectedId(imported.objects[0].id);
                    setPalette("select");
                    report(
                      "Garden imported. Undo restores the previous garden; save to keep this one.",
                    );
                  } catch (cause) {
                    report(
                      cause instanceof Error
                        ? cause.message
                        : "The file could not be read. Your garden has not changed.",
                      true,
                    );
                  }
                }}
              />
            </label>
            {drafts.length ? (
              <label>
                Saved gardens
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const loaded = drafts.find(
                      (draft) => draft.id === event.target.value,
                    );
                    if (
                      loaded &&
                      commit(
                        (previous) => editLevel(previous, loaded),
                        "Saved garden opened. Undo restores your previous work.",
                        null,
                      )
                    )
                      setSelectedId(loaded.objects[0].id);
                    event.target.value = "";
                  }}
                >
                  <option value="" disabled>
                    Choose a garden
                  </option>
                  {drafts.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {draft.title} · {draft.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                Choose Load library to check this browser for saved gardens.
              </p>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  downloadFile(
                    "waggle-drafts-recovery.json",
                    recoverDraftLibrary(localStorage),
                  );
                  report(
                    "Raw draft library prepared for recovery. The stored library has not changed.",
                  );
                } catch (cause) {
                  report((cause as Error).message, true);
                }
              }}
            >
              Export library for recovery
            </Button>
          </GamePanel>
          {level.schemaVersion < LEVEL_VERSION && (
            <div className="ww-panel">
              <p>
                This garden uses format {level.schemaVersion}. It can still be
                edited and played. Upgrade to add switches, gates and rally
                flowers, timed sprinklers, pollen and garden themes; Undo
                restores the previous format.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  commit(
                    (previous) =>
                      editLevel(previous, upgradeLevel(previous.level)),
                    `Garden upgraded to format ${LEVEL_VERSION}. Save or export to keep the upgrade; Undo restores format ${level.schemaVersion}.`,
                  )
                }
              >
                Upgrade garden format
              </Button>
            </div>
          )}
          {level.schemaVersion !== 1 && (
            <InventoryEditor
              level={level}
              onChange={(inventory) =>
                commit((previous) =>
                  editLevel(previous, { ...previous.level, inventory }),
                )
              }
            />
          )}
          <GamePanel
            compact={gridWorkshop}
            title="Level title and puzzle rules"
            legacyClassName="ww-panel"
          >
            <form
              key={`${level.id}-${level.title}-${level.width}-${level.height}-${level.population}-${level.rescueTarget}-${level.releaseInterval}-${level.guideLimit}-${level.theme}-${JSON.stringify(level.objectives)}`}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                commit((previous) =>
                  editLevel(previous, {
                    ...previous.level,
                    id: String(data.get("id")),
                    title: String(data.get("title")),
                    instructions: String(data.get("instructions")),
                    width: Number(data.get("width")),
                    height: Number(data.get("height")),
                    population: Number(data.get("population")),
                    rescueTarget: Number(data.get("rescueTarget")),
                    releaseInterval: Number(data.get("releaseInterval")),
                    guideLimit: Number(data.get("guideLimit")),
                    ...(level.schemaVersion >= 5
                      ? {
                          theme: String(data.get("theme")) as GardenTheme,
                          objectives: {
                            pollen: Number(data.get("pollen")),
                            ...(data.get("toolGoal")
                              ? { maxTools: Number(data.get("maxTools")) }
                              : {}),
                          },
                        }
                      : {}),
                  }),
                );
              }}
            >
              <div className="ww-form-grid">
                <label>
                  Garden ID
                  <input
                    name="id"
                    defaultValue={level.id}
                    maxLength={64}
                    required
                  />
                </label>
                <label>
                  Title
                  <input
                    name="title"
                    defaultValue={level.title}
                    maxLength={80}
                    required
                  />
                </label>
                <label className="ww-wide">
                  Instructions
                  <textarea
                    name="instructions"
                    defaultValue={level.instructions}
                    maxLength={500}
                  />
                </label>
                {(
                  [
                    { name: "width", label: "Garden width", min: 8, max: 128 },
                    { name: "height", label: "Garden height", min: 6, max: 72 },
                    {
                      name: "population",
                      label: "Number of bees",
                      min: 1,
                      max: 100,
                    },
                    {
                      name: "rescueTarget",
                      label: "Rescue target",
                      min: 1,
                      max: 100,
                    },
                    {
                      name: "releaseInterval",
                      label: "Ticks between bees (30 ticks = 1 second)",
                      min: 1,
                      max: 300,
                    },
                    {
                      name: "guideLimit",
                      label: "Maximum helpers (guides and operators)",
                      min: 0,
                      max: 100,
                    },
                  ] as const
                ).map((field) => (
                  <label key={field.name}>
                    {field.label}
                    <input
                      name={field.name}
                      type="number"
                      min={field.min}
                      max={field.max}
                      defaultValue={level[field.name]}
                      required
                    />
                  </label>
                ))}
              </div>
              {level.schemaVersion >= 5 && (
                <fieldset>
                  <legend>Garden appearance and optional goals</legend>
                  <div className="ww-form-grid">
                    <label>
                      Garden theme
                      <select name="theme" defaultValue={level.theme}>
                        {GARDEN_THEMES.map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Pollen delivery target
                      <input
                        name="pollen"
                        type="number"
                        min={0}
                        max={
                          level.objects.filter(
                            (object) => object.kind === "pollen",
                          ).length
                        }
                        defaultValue={level.objectives!.pollen}
                        required
                      />
                    </label>
                    <label>
                      <input
                        name="toolGoal"
                        type="checkbox"
                        defaultChecked={
                          level.objectives!.maxTools !== undefined
                        }
                      />
                      Offer a fewer-tools goal
                    </label>
                    <label>
                      Optional maximum tools
                      <input
                        name="maxTools"
                        type="number"
                        min={0}
                        max={(level.inventory ?? []).reduce(
                          (sum, stock) => sum + stock.count,
                          0,
                        )}
                        defaultValue={level.objectives!.maxTools ?? 0}
                      />
                    </label>
                  </div>
                  <p className="ww-caption">
                    Pollen counts only when its carrier reaches the flowers. A
                    lost carrier returns it to the garden. Optional goals never
                    block progress. Tool limits count peak simultaneous supplied
                    tools.
                  </p>
                </fieldset>
              )}
              <Button type="submit">Apply level rules</Button>
            </form>
          </GamePanel>
        </div>
      </section>
    </section>
  );
}
