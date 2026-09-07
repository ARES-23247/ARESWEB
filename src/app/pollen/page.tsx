import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { GameFullscreenButton, useGameFullscreen } from "@/components/games/GameFullscreen";
import "./pollen.css";

export default function PollenPage() {
  const { isFullscreen, targetRef, toggleFullscreen } = useGameFullscreen();
  const frame = useRef<HTMLIFrameElement>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      // Only this opaque sandbox may access the single, non-sensitive score key.
      if (event.source !== frame.current?.contentWindow || event.origin !== "null") return;
      if (event.data?.type !== "pollen:load-score" && event.data?.type !== "pollen:save-score") return;
      let score = 0;
      try {
        const stored = Number(localStorage.getItem("pollen_appalachian_high_score"));
        if (Number.isSafeInteger(stored) && stored >= 0 && stored <= 1_000_000_000) score = stored;
        if (event.data.type === "pollen:save-score") {
          const proposed: unknown = event.data.score;
          if (typeof proposed !== "number" || !Number.isSafeInteger(proposed) || proposed < 0 || proposed > 1_000_000_000) return;
          score = Math.max(score, proposed);
          localStorage.setItem("pollen_appalachian_high_score", String(score));
        }
      } catch {
        setStorageUnavailable(true);
      }
      // An opaque frame has no target origin; the message contains only a score.
      frame.current?.contentWindow?.postMessage({ type: "pollen:score", score }, "*");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  return (
    <section ref={targetRef} aria-labelledby="pollen-title" data-game-fullscreen={isFullscreen} className={`pollen-page game-fullscreen-target ${isFullscreen ? "pollen-fullscreen" : ""}`}>
      <SEO title="Pollinator Pile-Up" description="Balance Appalachian critters on a flower. Play solo, pass and play on one device, or challenge Ranger Dave." />
      <header className="pollen-heading">
        <div>
          <h1 id="pollen-title" className="font-heading text-xl font-black text-white">Pollinator Pile-Up</h1>
          {!isFullscreen && <p className="mt-2 text-sm text-marble/80">Play solo, share this device with a friend, or challenge Ranger Dave. No sign-in needed.</p>}
        </div>
        <GameFullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      </header>
      {!isFullscreen && <nav aria-label="Games" className="pollen-links">
        <Link to="/arcade">All arcade games</Link>
        <Link to="/buzzle">BUZZLE</Link><Link to="/buzzello">BUZZELLO</Link><Link to="/">Team home</Link>
      </nav>}
      <iframe ref={frame} src="/games/pollen/index.html" title="Pollinator Pile-Up game" sandbox="allow-scripts" className="pollen-frame" />
      {!isFullscreen && <p role="status" className="mt-3 text-sm text-marble/75">
        {storageUnavailable ? "Browser storage is unavailable. Your best score lasts for this game session." : "Best scores stay on this device when browser storage is available."}
      </p>}
    </section>
  );
}
