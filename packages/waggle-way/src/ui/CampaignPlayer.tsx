import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { useGameFullscreen } from "@ares/game-common/fullscreen";
import { DialogShell } from "@ares/ui/dialog";
import GameSession from "./GameSession";
import CommunityBrowser from "./CommunityBrowser";
import type {
  CommunityClient,
  CommunityGarden,
  CommunityParent,
} from "../core/community";
import { CAMPAIGN } from "../content/campaign";
import { populationCounts, pollenCounts, type RunState } from "../core/engine";
import {
  isLevelUnlocked,
  loadProgress,
  progressFor,
  saveProgress,
  type LevelProgress,
} from "../core/progress";

const levels = CAMPAIGN.map((puzzle) => puzzle.level);
const gardens = [...new Set(CAMPAIGN.map((puzzle) => puzzle.garden))];
interface ProgressState {
  records: LevelProgress[];
  error: string | null;
}

export default function CampaignPlayer({
  community,
  onRemix,
  fullscreenController,
}: {
  community?: CommunityClient;
  onRemix?: (source: CommunityParent) => void;
  fullscreenController?: ReturnType<typeof useGameFullscreen>;
}) {
  const localFullscreen = useGameFullscreen();
  const fullscreen = fullscreenController ?? localFullscreen;
  const [selected, setSelected] = useState(0);
  const [shownGarden, setShownGarden] = useState(CAMPAIGN[0].garden);
  const [menuOpen, setMenuOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [communityGarden, setCommunityGarden] =
    useState<CommunityGarden | null>(null);
  const communityButton = useRef<HTMLButtonElement>(null);
  const [restoreToLevel, setRestoreToLevel] = useState(false);
  const mapButton = useRef<HTMLButtonElement>(null);
  const levelHeading = useRef<HTMLHeadingElement>(null);
  const choosePuzzle = (index: number) => {
    setSelected(index);
    setShownGarden(CAMPAIGN[index].garden);
  };
  const [progress, setProgress] = useState<ProgressState>(() => {
    try {
      return { records: loadProgress(localStorage), error: null };
    } catch (cause) {
      return {
        records: [],
        error:
          cause instanceof Error
            ? cause.message
            : "Campaign progress is unavailable. You can still play.",
      };
    }
  });
  const [notice, setNotice] = useState("");
  const session = useRef<HTMLDivElement>(null);
  const selectionKey = communityGarden
    ? `community:${communityGarden.id}:${communityGarden.revision}`
    : String(selected);
  const previousSelection = useRef(selectionKey);
  useEffect(() => {
    if (previousSelection.current !== selectionKey)
      session.current?.querySelector("h2")?.focus();
    previousSelection.current = selectionKey;
  }, [selectionKey]);
  const puzzle = CAMPAIGN[selected];
  const completed = progressFor(progress.records, puzzle.level);
  const onResult = useCallback(
    (run: RunState) => {
      const rescued = populationCounts(run).rescued;
      try {
        setProgress({
          records: saveProgress(localStorage, puzzle.level, {
            type: "completed",
            rescued,
            ...(puzzle.level.rulesVersion >= 5
              ? {
                  pollen: pollenCounts(run).delivered,
                  peakTools: run.peakToolsPlaced,
                }
              : {}),
          }),
          error: null,
        });
        setNotice(
          rescued === puzzle.level.population
            ? "Every bee is home. Your all-bees result is saved."
            : "Rescue target reached. Progress saved; keep going to bring everyone home.",
        );
      } catch (cause) {
        setProgress((previous) => ({
          ...previous,
          error:
            cause instanceof Error
              ? cause.message
              : "Progress could not be saved. You can keep playing.",
        }));
      }
    },
    [puzzle],
  );

  return (
    <>
      {progress.error && (
        <p className="ww-notice ww-error" role="alert">
          {progress.error} Level access is available while saving is
          unavailable.
        </p>
      )}
      <DialogShell
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Story gardens"
        size="xl"
        className="ww-page ww-map-dialog"
        returnFocusRef={restoreToLevel ? levelHeading : mapButton}
      >
        <p>
          Thirty puzzles across five gardens. Complete or skip a puzzle to open
          the next. Optional all-bees, pollen and tool goals never block
          progress.
        </p>
        <label>
          Garden
          <select
            value={shownGarden}
            onChange={(event) => setShownGarden(event.target.value)}
          >
            {gardens.map((garden) => (
              <option key={garden} value={garden}>
                {garden}
              </option>
            ))}
          </select>
        </label>
        <ol className="ww-campaign-list">
          {CAMPAIGN.map((entry, index) => {
            if (entry.garden !== shownGarden) return null;
            const saved = progressFor(progress.records, entry.level);
            const unlocked =
              Boolean(progress.error) ||
              isLevelUnlocked(levels, progress.records, index);
            const status = saved?.completed
              ? saved.bestRescued === entry.level.population
                ? "All bees rescued"
                : "Completed"
              : saved?.skipped
                ? "Skipped"
                : progress.error
                  ? "Progress unavailable"
                  : unlocked
                    ? "Ready to play"
                    : "Complete or skip the previous puzzle";
            return (
              <li key={entry.level.id}>
                <button
                  type="button"
                  className="ww-campaign-card"
                  disabled={!unlocked}
                  aria-pressed={selected === index}
                  onClick={() => {
                    setRestoreToLevel(true);
                    choosePuzzle(index);
                    setNotice("");
                    setMenuOpen(false);
                  }}
                >
                  <span className="ww-level-number">
                    {String(entry.number).padStart(2, "0")}
                  </span>
                  <strong>{entry.level.title}</strong>
                  <span>{entry.lesson}</span>
                  <small>{status}</small>
                  {entry.level.objectives && (
                    <small>
                      {entry.level.objectives.pollen > 0
                        ? `Pollen ${saved?.bestPollen ?? 0}/${entry.level.objectives.pollen}`
                        : ""}
                      {entry.level.objectives.maxTools !== undefined
                        ? ` · Tool goal ${saved?.fewestTools !== undefined && saved.fewestTools <= entry.level.objectives.maxTools ? "achieved" : `≤${entry.level.objectives.maxTools}`}`
                        : ""}
                    </small>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <p>
          Current puzzle: {puzzle.number}. {puzzle.level.title}
        </p>
        <div className="ww-toolbar">
          <Button
            variant="secondary"
            disabled={selected === CAMPAIGN.length - 1}
            onClick={() => {
              try {
                setProgress({
                  records: saveProgress(localStorage, puzzle.level, {
                    type: "skipped",
                  }),
                  error: null,
                });
                setNotice(
                  "Puzzle skipped, not marked complete. You can return to it later.",
                );
              } catch (cause) {
                setProgress((previous) => ({
                  ...previous,
                  error:
                    cause instanceof Error
                      ? cause.message
                      : "The skip could not be saved.",
                }));
              }
              setRestoreToLevel(true);
              choosePuzzle(Math.min(CAMPAIGN.length - 1, selected + 1));
              setMenuOpen(false);
            }}
          >
            Skip this puzzle
          </Button>
          {completed?.completed && selected < CAMPAIGN.length - 1 && (
            <Button
              onClick={() => {
                choosePuzzle(selected + 1);
                setNotice("");
              }}
            >
              Next puzzle
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              try {
                setProgress({
                  records: loadProgress(localStorage),
                  error: null,
                });
                setNotice("Saved progress reloaded.");
              } catch (cause) {
                setProgress((previous) => ({
                  ...previous,
                  error:
                    cause instanceof Error
                      ? cause.message
                      : "Progress is unavailable.",
                }));
              }
            }}
          >
            Reload saved progress
          </Button>
        </div>
        {notice && <p role="status">{notice}</p>}
      </DialogShell>
      {community && (
        <DialogShell
          open={communityOpen}
          onOpenChange={setCommunityOpen}
          title="Community gardens"
          size="xl"
          className="ww-page ww-map-dialog ww-community-dialog"
          returnFocusRef={restoreToLevel ? levelHeading : communityButton}
        >
          {communityOpen && (
            <CommunityBrowser
              client={community}
              onRemix={onRemix}
              onPlay={(garden) => {
                setCommunityGarden(garden);
                setRestoreToLevel(true);
                setCommunityOpen(false);
              }}
            />
          )}
        </DialogShell>
      )}
      <div
        ref={session}
        className={
          puzzle.garden === "Breezy Meadow"
            ? "ww-garden-meadow"
            : puzzle.garden === "Glasshouse"
              ? "ww-garden-glasshouse"
              : "ww-garden-sunny"
        }
      >
        <GameSession
          key={
            communityGarden
              ? `community:${communityGarden.id}:${communityGarden.revision}`
              : puzzle.level.id
          }
          level={communityGarden?.level ?? puzzle.level}
          fullscreenController={fullscreen}
          onResult={communityGarden ? undefined : onResult}
          titleRef={levelHeading}
          chapter={
            communityGarden
              ? `Community · By ${communityGarden.nickname}`
              : `${puzzle.garden} · ${String(puzzle.number).padStart(2, "0")} / 30`
          }
          help={
            !communityGarden && (
              <details className="ww-panel ww-hints" key={puzzle.level.id}>
                <summary>Hints for {puzzle.level.title}</summary>
                <ol>
                  {puzzle.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ol>
              </details>
            )
          }
          navigation={
            <>
              {community && (
                <Button
                  ref={communityButton}
                  variant="secondary"
                  onClick={() => {
                    setRestoreToLevel(false);
                    setCommunityOpen(true);
                  }}
                >
                  Community gardens
                </Button>
              )}
              {communityGarden ? (
                <Button
                  variant="secondary"
                  onClick={() => setCommunityGarden(null)}
                >
                  Back to story
                </Button>
              ) : (
                <>
                  <Button
                    ref={mapButton}
                    variant="secondary"
                    onClick={() => {
                      setRestoreToLevel(false);
                      setMenuOpen(true);
                    }}
                  >
                    Choose level
                  </Button>
                  {completed?.completed && selected < CAMPAIGN.length - 1 && (
                    <Button
                      onClick={() => {
                        choosePuzzle(selected + 1);
                        setNotice("");
                      }}
                    >
                      Next puzzle
                    </Button>
                  )}
                </>
              )}
            </>
          }
        />
      </div>
    </>
  );
}
