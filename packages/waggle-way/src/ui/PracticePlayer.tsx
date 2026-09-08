import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { DialogShell } from "@ares/ui/dialog";
import type { useGameFullscreen } from "@ares/game-common/fullscreen";
import {
  ADVENTURE_CHAPTERS,
  ADVENTURE_GARDENS as gardens,
} from "../content/adventure";
import { serializeLevel } from "../core/level";
import { pollenCounts, populationCounts, type RunState } from "../core/engine";
import CommunityBrowser from "./CommunityBrowser";
import type {
  CommunityClient,
  CommunityGarden,
  CommunityParent,
} from "../core/community";
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
  community,
  onRemix,
}: {
  fullscreen: ReturnType<typeof useGameFullscreen>;
  onExit: () => void;
  community?: CommunityClient;
  onRemix?: (source: CommunityParent) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [communityGarden, setCommunityGarden] =
    useState<CommunityGarden | null>(null);
  const communityButton = useRef<HTMLButtonElement>(null);
  const [restoreToLevel, setRestoreToLevel] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const chapterHeadings = useRef<Record<string, HTMLHeadingElement | null>>({});
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
  const level = communityGarden?.level ?? gardens[selected];
  const selectionKey = communityGarden
    ? `community:${communityGarden.id}:${communityGarden.revision}`
    : `${level.id}:${attempt}`;
  const previousLevel = useRef(selectionKey);
  useEffect(() => {
    if (previousLevel.current !== selectionKey) heading.current?.focus();
    previousLevel.current = selectionKey;
  }, [selectionKey]);
  const onResult = useCallback(
    (run: RunState) => {
      setCompletedId(level.id);
      try {
        setProgress({
          records: saveProgress(localStorage, level, {
            type: "completed",
            rescued: populationCounts(run).rescued,
            pollen: pollenCounts(run).delivered,
            peakTools: run.peakToolsPlaced,
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
        className="ww-page ww-map-dialog ww-garden-library"
        returnFocusRef={restoreToLevel ? heading : menuButton}
      >
        <div className="ww-garden-library-intro">
          <p>
            30 gardens. Every puzzle is open. Water is safe to fly over; dancers
            need dry ground.
          </p>
          <nav aria-label="Jump to chapter" className="ww-chapter-jumps">
            {ADVENTURE_CHAPTERS.slice(1).map((chapter) => (
              <Button
                key={chapter.title}
                variant="secondary"
                onClick={() => {
                  const target = chapterHeadings.current[chapter.title];
                  target?.scrollIntoView({ block: "start" });
                  target?.focus({ preventScroll: true });
                }}
              >
                {chapter.start === 5 ? "Jump to challenges" : chapter.title}
              </Button>
            ))}
          </nav>
        </div>
        <div className="ww-garden-chapters">
          {ADVENTURE_CHAPTERS.map((chapter) => (
            <section key={chapter.title} aria-label={chapter.title}>
              <h3
                ref={(element) => {
                  chapterHeadings.current[chapter.title] = element;
                }}
                tabIndex={-1}
              >
                {chapter.title}
              </h3>
              <p className="ww-garden-chapter-detail">{chapter.detail}</p>
              <ol className="ww-practice-list" start={chapter.start + 1}>
                {chapter.levels.map((garden, chapterIndex) => {
                  const index = chapter.start + chapterIndex;
                  const saved = progressFor(progress.records, garden);
                  return (
                    <li key={garden.id}>
                      <button
                        type="button"
                        aria-pressed={selected === index}
                        onClick={() => {
                          setRestoreToLevel(true);
                          setSelected(index);
                          setAttempt((previous) => previous + 1);
                          setMenuOpen(false);
                        }}
                      >
                        <span className="ww-practice-number">{index + 1}</span>
                        <span>
                          <strong>{garden.title}</strong>
                          <small>
                            {lessons[index] ??
                              `${garden.guideLimit} helper jobs · ${garden.width} × ${garden.height} board`}
                          </small>
                          <small className="ww-garden-result">
                            {selected === index && "Playing · "}
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
            </section>
          ))}
        </div>
        <p className="ww-garden-save-note">
          Choosing a garden starts a fresh attempt. Completed rescues save in
          this browser.
        </p>
      </DialogShell>
      {community && (
        <DialogShell
          open={communityOpen}
          onOpenChange={setCommunityOpen}
          title="Community gardens"
          size="xl"
          className="ww-page ww-map-dialog ww-community-dialog"
          returnFocusRef={restoreToLevel ? heading : communityButton}
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
      <GameSession
        key={`${selectionKey}:${serializeLevel(level)}`}
        level={level}
        chapter={
          communityGarden
            ? `Community · By ${communityGarden.nickname}`
            : `${ADVENTURE_CHAPTERS.findLast((chapter) => selected >= chapter.start)!.title} · ${selected + 1} of ${gardens.length}`
        }
        titleRef={heading}
        fullscreenController={fullscreen}
        onExit={onExit}
        exitLabel="Title screen"
        onResult={communityGarden ? undefined : onResult}
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
                Back to gardens
              </Button>
            ) : (
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
                  <span>Gardens</span>{" "}
                  <span>
                    {selected + 1}/{gardens.length}
                  </span>
                </Button>
                {(completedId === level.id ||
                  progressFor(progress.records, level)?.completed) &&
                  (selected < gardens.length - 1 ? (
                    <Button onClick={() => setSelected(selected + 1)}>
                      Next garden
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setRestoreToLevel(false);
                        setMenuOpen(true);
                      }}
                    >
                      Choose another garden
                    </Button>
                  ))}
              </>
            )}
          </>
        }
      />
    </>
  );
}
