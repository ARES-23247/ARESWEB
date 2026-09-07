import { useCallback, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { DialogShell } from "@ares/ui/dialog";
import type { useGameFullscreen } from "@ares/game-common/fullscreen";
import { PRACTICE_GARDENS } from "../content/redesign";
import { serializeLevel } from "../core/level";
import { populationCounts, type RunState } from "../core/engine";
import {
  loadProgress,
  progressFor,
  saveProgress,
  type LevelProgress,
} from "../core/progress";
import GameSession from "./GameSession";

const lessons = [
  "Place a dancer and rescue its helper",
  "Left and right depend on the bee's approach",
  "Reverse once, then leave the signal",
  "A solid partition safely turns bees around",
  "Cover a timed spray crossing",
];

export default function PracticePlayer({
  fullscreen,
  onExit,
}: {
  fullscreen: ReturnType<typeof useGameFullscreen>;
  onExit: () => void;
}) {
  const [selected, setSelected] = useState(0);
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
  const level = PRACTICE_GARDENS[selected];
  const onResult = useCallback(
    (run: RunState) => {
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
        title="Practice gardens"
        size="lg"
        className="ww-page ww-map-dialog"
        returnFocusRef={restoreToLevel ? heading : menuButton}
      >
        <p>
          Five small gardens to learn the hive's signals. Try any garden.
          Choosing another starts a fresh attempt; completed rescue results save
          in this browser.
        </p>
        <ol className="ww-practice-list">
          {PRACTICE_GARDENS.map((garden, index) => {
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
        chapter={`Garden beginnings · ${selected + 1} of ${PRACTICE_GARDENS.length}`}
        titleRef={heading}
        fullscreenController={fullscreen}
        onExit={onExit}
        exitLabel="Title screen"
        onResult={onResult}
        navigation={
          <Button
            ref={menuButton}
            className="ww-practice-menu-button"
            variant="secondary"
            aria-label="Choose practice garden"
            title="Practice gardens"
            onClick={() => {
              setRestoreToLevel(false);
              setMenuOpen(true);
            }}
          >
            {selected + 1}/{PRACTICE_GARDENS.length}
          </Button>
        }
      />
    </>
  );
}
