import { useId, useMemo } from "react";
import type { GardenObject } from "../core/level";

// Original 16-pixel sprites. Shared by the scene, palette and drag preview.
const colors: Record<string, string> = {
  X: "#172a2b",
  D: "#344b43",
  G: "#537947",
  g: "#82a65b",
  L: "#bbd581",
  B: "#715334",
  b: "#aa7950",
  T: "#d8b878",
  Y: "#efb84a",
  y: "#ffe09a",
  W: "#fff4d2",
  C: "#a4dbd3",
  c: "#64a8b4",
  A: "#39718c",
  P: "#b689c3",
  p: "#e3b4c8",
  R: "#cf6750",
  S: "#72928e",
};

const sprites = {
  dancer: [
    "................",
    "...WW......WW...",
    "..WCCW....WCCW..",
    "..WCCWXXXXWCCW..",
    "...WWXYYYYXWW...",
    "....XYYYYYYX....",
    "....XXXXXXXX....",
    "....XYYYYYYX....",
    "....XYYYYYYX....",
    "....XXXXXXXX....",
    "....XYYYYYYX....",
    ".....XYYYYX.....",
    "......XXXX......",
    ".......XX.......",
    "................",
    "................",
  ],
  hive: [
    "................",
    "....XXXXXXXX....",
    "..XXTTTTTTTTXX..",
    ".XTTYYYYYYYYTTX.",
    ".XTYyyyyyyyyYTX.",
    ".XTYyYYYYYYyYTX.",
    ".XTYyYTTTTYyYTX.",
    ".XTYyYXXXXYyYTX.",
    ".XTYyYX..XYyXXX.",
    ".XTYyYXXXXYyX.X.",
    ".XTYyYYYYYYyXXX.",
    ".XTYyyyyyyyyYTX.",
    ".XTTYYYYYYYYTTX.",
    "..XXTTTTTTTTXX..",
    "....XXXXXXXX....",
    "................",
  ],
  flowers: [
    "................",
    "...GG......GG...",
    "..GggG....GggG..",
    "...GggGWWGggG...",
    "....GGWWWWGG....",
    "....WWWWWWWW....",
    "...WWWWYYWWWW...",
    "...WWWYYYYWWW...",
    "...WWWYYYYWWW...",
    "...WWWWYYWWWW...",
    "....WWWWWWWW....",
    "....GGWWWWGG....",
    "...GggGWWGggG...",
    "..GggG....GggG..",
    "...GG......GG...",
    "................",
  ],
  terrain: [
    "XXXXXXXXXXXXXXXX",
    "XTTTTTTTTTTTTTTX",
    "XTbbbbbbbbbbbbBX",
    "XTbbBbbbbbbBbbBX",
    "XTbbBbbbbbbBbbBX",
    "XBBBBBBBBBBBBBBX",
    "XbbBbbbbBbbbbBBX",
    "XbbBbbbbBbbbbBBX",
    "XBBBBBBBBBBBBBBX",
    "XTbbbbBbbbbBbbBX",
    "XTbbbbBbbbbBbbBX",
    "XBBBBBBBBBBBBBBX",
    "XbbBbbbbBbbbbBBX",
    "XbbBbbbbBbbbbBBX",
    "XBBBBBBBBBBBBBBX",
    "XXXXXXXXXXXXXXXX",
  ],
  water: [
    "AAAAAAAAAAAAAAAA",
    "AccccccccccccccA",
    "AccccccccccccccA",
    "AccCCCcccccccccA",
    "AccccccccccCcccA",
    "AccccccccCCCcccA",
    "AccccccccccccccA",
    "AccccccccccccccA",
    "AccccccccccccccA",
    "AcccCCCccccccccA",
    "AccccccccccccccA",
    "AccccccccCCCcccA",
    "AccccccccccccccA",
    "AccccccccccccccA",
    "AccccccccccccccA",
    "AAAAAAAAAAAAAAAA",
  ],
  perch: [
    "................",
    "....XXXXXXXX....",
    "..XXTTTTTTTTXX..",
    ".XTTbbbbbbbbTTX.",
    ".XTbBBBBBBBBbTX.",
    ".XTbBTTTTTTBbTX.",
    ".XTbBTYYYYTBbTX.",
    ".XTbBTYyyYTBbTX.",
    ".XTbBTYyyYTBbTX.",
    ".XTbBTYYYYTBbTX.",
    ".XTbBTTTTTTBbTX.",
    ".XTbBBBBBBBBbTX.",
    ".XTTbbbbbbbbTTX.",
    "..XXTTTTTTTTXX..",
    "....XXXXXXXX....",
    "................",
  ],
  fan: [
    "XXXXXXXXXXXXXXXX",
    "XCSSSSSSSSSSSSSX",
    "XSXXDXXXXXXXDXSX",
    "XSXDXXYYYXXXDXSX",
    "XSXXXXYYYXXXXXSX",
    "XSXXXXXYXXXXXXSX",
    "XSXYYXXYXXXXXXSX",
    "XSXYYYYWWYYYYXSX",
    "XSXXXXXWWXXYYXSX",
    "XSXXXXXYXXXXXXSX",
    "XSXXXXXYXXXXXXSX",
    "XSXXXXYYYXXXXXSX",
    "XSXDXXYYYXXXDXSX",
    "XSXXDXXXXXXXDXSX",
    "XSSSSSSSSSSSSSSX",
    "XXXXXXXXXXXXXXXX",
  ],
  shelter: [
    "..............XX",
    ".........XXXXXGX",
    "......XXXggggLGX",
    "....XXgggggLLgGX",
    "...XgggggLLgggGX",
    "..XggggLLgggggGX",
    ".XgggLLgggggggGX",
    ".XggLLggggggggGX",
    "XggLLggggggggGX.",
    "XgLLgggggggggGX.",
    "XLLgggggggggGX..",
    "XLgggggggggGX...",
    "XgggggggggGX....",
    "XGGGGGGGGXX.....",
    "XXXXXXXXX.......",
    "XX..............",
  ],
  switch: [
    "................",
    "...XXXXXXXXXX...",
    "..XSSSSSSSSSSX..",
    ".XSSXXXXXXXXSSX.",
    ".XSXPPPPPPPPXSX.",
    ".XSXPppppppPXSX.",
    ".XSXPppWWppPXSX.",
    ".XSXPppWWppPXSX.",
    ".XSXPppWWppPXSX.",
    ".XSXPppWWppPXSX.",
    ".XSXPppppppPXSX.",
    ".XSXPPPPPPPPXSX.",
    ".XSSXXXXXXXXSSX.",
    "..XSSSSSSSSSSX..",
    "...XXXXXXXXXX...",
    "................",
  ],
  gate: [
    "XXXXXXXXXXXXXXXX",
    "XCSSSSSSSSSSSSSX",
    "XSDDDDDDDDDDDDSX",
    "XSYYYYXXYYYYXXSX",
    "XSYYYXXYYYYXXYSX",
    "XSYYXXYYYYXXYYSX",
    "XSYXXYYYYXXYYYSX",
    "XSXXYYYYXXYYYYSX",
    "XSYYYYXXYYYYXXSX",
    "XSYYYXXYYYYXXYSX",
    "XSYYXXYYYYXXYYSX",
    "XSYXXYYYYXXYYYSX",
    "XSXXYYYYXXYYYYSX",
    "XSDDDDDDDDDDDDSX",
    "XSSSSSSSSSSSSSSX",
    "XXXXXXXXXXXXXXXX",
  ],
  rally: [
    "................",
    "....XXXXXXXX....",
    "..XXPPPPPPPPXX..",
    ".XPPppppppppPPX.",
    ".XPppppppppppPX.",
    ".XPppWWppWWppPX.",
    ".XPppWWppWWppPX.",
    ".XPppWWppWWppPX.",
    ".XPppWWppWWppPX.",
    ".XPppWWppWWppPX.",
    ".XPppWWppWWppPX.",
    ".XPppppppppppPX.",
    ".XPPppppppppPPX.",
    "..XXPPPPPPPPXX..",
    "....XXXXXXXX....",
    "................",
  ],
  sprinkler: [
    "......XXXX......",
    "......XSSX......",
    "......XSSX......",
    "...XXXXSSXXXX...",
    "..XSSSSSSSSSSX..",
    ".XSXXSSSSSSXXSX.",
    ".XSXCCSSSSCCXSX.",
    ".XSSSSXXXXSSSSX.",
    ".XSSSSXggXSSSSX.",
    ".XSXCCXggXCCXSX.",
    ".XSXXXSSSSXXXSX.",
    "..XSSSSSSSSSSX..",
    "...XXXSSSSXXX...",
    ".....XAAAAX.....",
    ".....XCCCCX.....",
    ".....XXXXXX.....",
  ],
  pollen: [
    "................",
    "......XXXX......",
    "....XXYYYYXX....",
    "...XYYyyyyYYX...",
    "..XYyyyyyyyyYX..",
    "..XYyyyWWyyyYX..",
    ".XYyyyyWWyyyyYX.",
    ".XYyyWWWWWWyyYX.",
    ".XYyyWWWWWWyyYX.",
    ".XYyyyyWWyyyyYX.",
    "..XYyyyWWyyyYX..",
    "..XYyyyyyyyyYX..",
    "...XYYyyyyYYX...",
    "....XXYYYYXX....",
    "......XXXX......",
    "................",
  ],
} satisfies Record<GardenObject["kind"], string[]>;

function Sprite({ rows }: { rows: string[] }) {
  // One path per ink color keeps large gardens from creating a DOM node per pixel.
  const paths = useMemo(() => {
    const ink: Record<string, string> = {};
    rows.forEach((row, y) => {
      [...row].forEach((color, x) => {
        if (color !== ".") {
          ink[color] = (ink[color] ?? "") + `M${x} ${y}h1v1h-1z`;
        }
      });
    });
    return Object.entries(ink);
  }, [rows]);
  return (
    <g shapeRendering="crispEdges">
      {paths.map(([color, d]) => (
        <path key={color} d={d} fill={colors[color]} />
      ))}
    </g>
  );
}

export function PixelObjectArt({
  object,
  state = "closed",
}: {
  object: Pick<GardenObject, "kind" | "width" | "height" | "elevation">;
  state?: string;
}) {
  const id = `pixel-${useId().replace(/:/g, "")}`;
  const { kind, width, height } = object;
  const tiles = ["terrain", "water", "flowers"].includes(kind);
  const size = Math.min(width, height);
  const open = kind === "gate" && state !== "closed";
  return (
    <g className={`ww-piece ww-piece-${kind} ww-state-${state}`}>
      {tiles ? (
        <>
          <defs>
            <pattern id={id} width="1" height="1" patternUnits="userSpaceOnUse">
              <g transform="scale(.0625)">
                {kind === "terrain" && object.elevation === "low" ? (
                  <>
                    <rect width="16" height="16" fill="#344b43" />
                    <rect x="1" y="4" width="14" height="8" fill="#172a2b" />
                    <rect x="2" y="5" width="12" height="5" fill="#d8b878" />
                    <path
                      d="M3 9H13M6 5V10M10 5V10"
                      stroke="#715334"
                      strokeWidth="1"
                    />
                  </>
                ) : (
                  <Sprite rows={sprites[kind]} />
                )}
              </g>
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#${id})`} />
        </>
      ) : (
        <>
          <rect
            width={width}
            height={height}
            fill="none"
            stroke="#fff4d2"
            strokeOpacity=".35"
            strokeWidth=".025"
            strokeDasharray=".08 .08"
          />
          <g
            transform={
              kind === "gate" || kind === "shelter"
                ? `scale(${width / 16} ${height / 16})`
                : `translate(${(width - size) / 2} ${(height - size) / 2}) scale(${size / 16})`
            }
          >
            {kind === "dancer" && state === "assigned" ? (
              <path
                d="M0 4V0H4M12 0H16V4M16 12V16H12M4 16H0V12"
                fill="none"
                stroke="#efb84a"
                strokeWidth="1"
              />
            ) : open ? (
              <g fill="#72928e">
                <rect width="2" height="16" />
                <rect x="14" width="2" height="16" />
              </g>
            ) : (
              <Sprite rows={sprites[kind]} />
            )}
            {kind === "sprinkler" && (
              <rect
                x="7"
                y="8"
                width="2"
                height="2"
                fill={
                  state === "rain"
                    ? colors.R
                    : state === "warning"
                      ? colors.Y
                      : colors.g
                }
              />
            )}
            {kind === "rally" && state === "release" && (
              <path
                d="M 4 4 H 8 V 6 H 10 V 8 H 12 V 9 H 10 V 11 H 8 V 13 H 4 Z"
                fill={colors.W}
              />
            )}
          </g>
        </>
      )}
      {kind === "flowers" && (
        <text
          className="ww-piece-state"
          x={width / 2}
          y="-.18"
          textAnchor="middle"
        >
          HOME
        </text>
      )}
      {["sprinkler", "gate", "rally"].includes(kind) && (
        <text
          className="ww-piece-state"
          x={width / 2}
          y={height + 0.32}
          textAnchor="middle"
        >
          {kind === "rally"
            ? state === "release"
              ? "GO"
              : "HOLD"
            : state.toUpperCase()}
        </text>
      )}
    </g>
  );
}

const bee = [
  "................",
  "....XXX.........",
  "...XWWWX........",
  "...XWWWX....XX..",
  "....XCCXXXXX....",
  "...XXYYXYYXYX...",
  "..XYXYYXYYXYWX..",
  ".XYyXYYXYYXYXX..",
  ".XYyXYYXYYXYYX..",
  "..XYXYYXYYXYXX..",
  "...XXYYXYYXYWX..",
  "....XCCXXXXX....",
  "...XWWWX....XX..",
  "...XWWWX........",
  "....XXX.........",
  "................",
];

export function PixelBee() {
  return (
    <g transform="translate(-.45 -.45) scale(.05625)">
      <Sprite rows={bee} />
    </g>
  );
}

export function PixelGround({
  id,
  width,
  height,
  theme,
}: {
  id: string;
  width: number;
  height: number;
  theme: string;
}) {
  const industrial = theme === "glasshouse";
  const base = industrial
    ? "#677d70"
    : theme === "rainy"
      ? "#466c60"
      : theme === "wildflower"
        ? colors.G
        : "#719253";
  return (
    <g pointerEvents="none" aria-hidden="true" shapeRendering="crispEdges">
      <defs>
        <pattern
          id={`ground-${id}`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="4" height="4" fill={base} />
          {[0, 1, 2, 3].map((y) => (
            <path
              key={y}
              d={`M 0 ${y} H 4 M ${y} 0 V 4`}
              stroke="#233c32"
              strokeOpacity=".16"
              strokeWidth=".025"
            />
          ))}
          {industrial ? (
            <path
              d="M .15 .15 H .4 M 3.6 3.85 H 3.85"
              stroke="#bbd581"
              strokeWidth=".08"
            />
          ) : (
            <g fill="#bbd581" opacity=".38">
              <path d="M .25 .35 H .3125 V .475 H .4375 V .4125 H .5 V .5375 H .25 Z M 2.5 1.2 H 2.5625 V 1.325 H 2.6875 V 1.2625 H 2.75 V 1.3875 H 2.5 Z" />
              <rect x="1.1875" y="2.5625" width=".125" height=".0625" />
              <rect x="3.375" y="3.25" width=".0625" height=".125" />
            </g>
          )}
          {theme === "wildflower" && (
            <g className="ww-ground-flowers" fill={colors.P} opacity=".55">
              <path d="M .75 2 H .8125 V 1.9375 H .875 V 2 H .9375 V 2.0625 H .875 V 2.125 H .8125 V 2.0625 H .75 Z M 3.125 .625 H 3.1875 V .5625 H 3.25 V .625 H 3.3125 V .6875 H 3.25 V .75 H 3.1875 V .6875 H 3.125 Z" />
            </g>
          )}
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#ground-${id})`} />
      <rect
        x=".0625"
        y=".0625"
        width={width - 0.125}
        height={height - 0.125}
        fill="none"
        stroke="#344b43"
        strokeWidth=".125"
      />
    </g>
  );
}
