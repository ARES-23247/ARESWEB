import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { DialogShell } from "@ares/ui/dialog";
import type { useGameFullscreen } from "@ares/game-common/fullscreen";
import { PRACTICE_GARDENS } from "../content/redesign";
import { CHALLENGE_GARDENS } from "../content/challenges";
import { serializeLevel } from "../core/level";
import { populationCounts, type RunState } from "../core/engine";
import {
  loadProgress,
  progressFor,
  saveProgress,
  type LevelProgress,
} from "../core/progress";
import GameSession from "./GameSession";

const gardens = [...PRACTICE_GARDENS, ...CHALLENGE_GARDENS];
const lessons = [
  "Place a dancer and rescue its helper",
  "Left and right depend on the bee's approach",
  "Reverse once, then leave the signal",
  "A solid partition safely turns bees around",
  "Cover a timed spray crossing",
  "Combine an operator with a free dancer",
  "Find a separate escape for the operator",
  "Keep the next shutter open for your helpers",
  "Reuse a helper job after gathering the hive",
  "Protect two crossings with limited supplies",
  "Plan a complete departure through the glasshouse",
];

export default function PracticePlayer({
  fullscreen,
  onExit,
  onOriginalCampaign,
}: {
  fullscreen: ReturnType<typeof useGameFullscreen>;
  onExit: () => void;
  onOriginalCampaign: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [restoreToLevel, setRestoreToLevel] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [progress, setProgress] = useState<{
    records: LevelProgress[];
    error: string | null;
  }>(() => {
    try {
      return { records: loadProgress(localStorage), error: null };
    } catch (cause) {
      return {
        records: [],
        error:
          cause instanceof Error
            ? cause.message
            : "Saved results are unavailable. You can still play.",
      };
    }
  });
  const level = gardens[selected];
  const previousLevel = useRef(level.id);
  useEffect(() => {
    if (previousLevel.current !== level.id) heading.current?.focus();
    previousLevel.current = level.id;
  }, [level.id]);
  const onResult = useCallback(
    (run: RunState) => {
      setCompletedId(level.id);
      try {
        setProgress({
          records: saveProgress(localStorage, level, {
            type: "completed",
            rescued: populationCounts(run).rescued,
          }),
          error: null,
        });
      } catch (cause) {
        setProgress((previous) => ({
          ...previous,
          error:
            cause instanceof Error
              ? cause.message
              : "This result could not be saved. You can still play.",
        }));
      }
    },
    [level],
  );

  return (
    <>
      {progress.error && (
        <p role="alert" className="ww-notice ww-error">
          {progress.error}
        </p>
      )}
      <DialogShell
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Adventure gardens"
        size="lg"
        className="ww-page ww-map-dialog"
        returnFocusRef={restoreToLevel ? heading : menuButton}
      >
        <p>
          Eleven gardens: learn the signals, then take on the glasshouse. Try
          any garden. Choosing another starts a fresh attempt; completed rescue
          results save in this browser.
        </p>
        <ol className="ww-practice-list">
          {gardens.map((garden, index) => {
            const saved = progressFor(progress.records, garden);
            return (
              <li key={garden.id}>
                <button
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => {
                    setRestoreToLevel(true);
                    setSelected(index);
                    setMenuOpen(false);
                  }}
                >
                  <span className="ww-practice-number">{index + 1}</span>
                  <span>
                    <strong>{garden.title}</strong>
                    <small>{lessons[index]}</small>
                    <small>
                      {progress.error
                        ? "Saving unavailable"
                        : saved
                          ? `${saved.bestRescued}/${garden.population} bees rescued`
                          : "Ready to play"}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </DialogShell>
      <GameSession
        key={serializeLevel(level)}
        level={level}
        chapter={`${selected < 5 ? "Garden beginnings" : "Glasshouse challenges"} · ${selected + 1} of ${gardens.length}`}
        titleRef={heading}
        fullscreenController={fullscreen}
        onExit={onExit}
        exitLabel="Title screen"
        onResult={onResult}
        navigation={
          <>
            <Button
              ref={menuButton}
              className="ww-practice-menu-button"
              variant="secondary"
              aria-label="Choose adventure garden"
              title="Adventure gardens"
              onClick={() => {
                setRestoreToLevel(false);
                setMenuOpen(true);
              }}
            >
              {selected + 1}/{gardens.length}
            </Button>
            {(completedId === level.id ||
              progressFor(progress.records, level)?.completed) &&
              (selected < gardens.length - 1 ? (
                <Button onClick={() => setSelected(selected + 1)}>
                  Next garden
                </Button>
              ) : (
                <Button onClick={onOriginalCampaign}>
                  Play 30 original gardens
                </Button>
              ))}
          </>
        }
      />
    </>
  );
}
