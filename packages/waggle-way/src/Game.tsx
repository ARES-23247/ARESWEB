import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGameFullscreen } from "@ares/game-common/fullscreen";
import TitleScreen from "./ui/TitleScreen";
import PracticePlayer from "./ui/PracticePlayer";
import type { CommunityClient, CommunityParent } from "./core/community";
import "./waggle-way.css";

export default function Game({
  workshopLink,
  community,
  onRemix,
}: {
  workshopLink: ReactNode;
  community?: CommunityClient;
  onRemix?: (source: CommunityParent) => void;
}) {
  const [mode, setMode] = useState<"title" | "play">("title");
  const fullscreen = useGameFullscreen();
  const page = useRef<HTMLElement>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (mode !== "title") page.current?.querySelector("h2")?.focus();
    else if (previousMode.current !== "title")
      page.current
        ?.querySelector<HTMLButtonElement>("[data-start-garden]")
        ?.focus();
    previousMode.current = mode;
  }, [mode]);
  return (
    <section ref={page} className="ww-page ww-game-page">
      {mode !== "title" ? (
        <>
          <header className="ww-header">
            <div>
              <p className="ww-eyebrow">ARES Arcade · A whole hive home</p>
              <h1>Waggle Way</h1>
            </div>
            {workshopLink}
          </header>
          <PracticePlayer
            community={community}
            onRemix={onRemix}
            fullscreen={fullscreen}
            onExit={() => setMode("title")}
          />
        </>
      ) : (
        <TitleScreen
          onPlay={() => setMode("play")}
          links={workshopLink}
          fullscreen={fullscreen}
        />
      )}
    </section>
  );
}
