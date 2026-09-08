import { useId, type ReactNode } from "react";
import { Button } from "@ares/ui/button";
import {
  GameFullscreenButton,
  type useGameFullscreen,
} from "@ares/game-common/fullscreen";
import { PixelBee, PixelGround, PixelObjectArt } from "./PixelArt";

// Original five-by-seven lettering for the game's wordmark.
const letters: Record<string, string[]> = {
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};
const word = "WAGGLE WAY";
const wordmark = [...word]
  .flatMap((letter, index) =>
    (letters[letter] ?? []).flatMap((row, y) =>
      [...row].flatMap((pixel, x) =>
        pixel === "1" ? [`M${index * 6 + x} ${y}h1v1h-1z`] : [],
      ),
    ),
  )
  .join("");

export default function TitleScreen({
  onPlay,
  onOriginalCampaign,
  links,
  fullscreen,
}: {
  onPlay: () => void;
  onOriginalCampaign: () => void;
  links: ReactNode;
  fullscreen: ReturnType<typeof useGameFullscreen>;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <section
      ref={fullscreen.targetRef}
      className="ww-game-window ww-title-screen"
      aria-label="Waggle Way title screen"
      data-game-fullscreen={fullscreen.isFullscreen}
    >
      <div className="ww-title-toolbar">
        <span>A WHOLE HIVE HOME</span>
        <GameFullscreenButton
          isFullscreen={fullscreen.isFullscreen}
          onToggle={fullscreen.toggleFullscreen}
        />
      </div>
      <svg
        className="ww-title-garden"
        viewBox="0 0 24 16"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <PixelGround id={id} width={24} height={16} theme="sunny" />
        <path
          d="M 0 13 H 6 V 12 H 10 V 14 H 16 V 12 H 24 V 16 H 0 Z"
          fill="#537947"
        />
        <path
          d="M 0 14 H 6 V 13 H 10 V 15 H 16 V 13 H 24"
          fill="none"
          stroke="#bbd581"
          strokeWidth=".125"
        />
        <g transform="translate(2 10) scale(2)">
          <PixelObjectArt object={{ kind: "hive", width: 1, height: 1 }} />
        </g>
        <g transform="translate(18 10)">
          <PixelObjectArt object={{ kind: "flowers", width: 4, height: 3 }} />
        </g>
        {[
          { x: 7, y: 11.5 },
          { x: 10, y: 10.5 },
          { x: 13, y: 11.5 },
          { x: 16, y: 10.5 },
        ].map(({ x, y }) => (
          <g key={x} transform={`translate(${x} ${y}) scale(1.5)`}>
            <PixelBee />
          </g>
        ))}
      </svg>
      <div className="ww-title-content">
        <p className="ww-title-kicker">SMALL BEES. BIG ADVENTURE.</p>
        <h1>
          <svg
            viewBox="-1 -1 62 10"
            role="img"
            aria-label="Waggle Way"
            shapeRendering="crispEdges"
          >
            <path
              d={wordmark}
              transform="translate(0 1)"
              fill="#172a2b"
              stroke="#172a2b"
              strokeWidth=".5"
            />
            <path d={wordmark} fill="#ffe09a" />
          </svg>
        </h1>
        <p className="ww-title-promise">
          Dance a path. Catch a breeze.
          <br />
          Bring every bee home.
        </p>
        <Button className="ww-title-play" onClick={onPlay} data-start-garden>
          Play gardens <span aria-hidden="true">▶</span>
        </Button>
        <p>11 adventure gardens · 30 original gardens</p>
        <div className="ww-title-original">
          <Button variant="secondary" onClick={onOriginalCampaign}>
            Original gardens
          </Button>
        </div>
        <div className="ww-title-links">{links}</div>
      </div>
      <p className="ww-title-footer">A bee-guiding puzzle & level workshop</p>
    </section>
  );
}
