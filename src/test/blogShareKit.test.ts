import { describe, expect, it, vi } from "vitest";
import {
  buildBlogOgCardUrl,
  buildBlogShareCaption,
  buildBlogWebShareIntents,
  buildCanonicalBlogUrl,
  buildInstagramCaption,
  renderInstagramSquareCardDataUrl,
  wrapCanvasLines,
  wrapMeasuredCanvasLines,
} from "@/lib/blogShareKit";

describe("blogShareKit", () => {
  const samplePost = {
    slug: "swerve-odometry-deep-dive",
    title: "Swerve Odometry Deep Dive",
    description: "How we fused IMU yaw with dead-wheel encoders for sub-centimeter autonomous repeatability.",
    category: "Control Theory",
    author: "CircuitFox",
    date: "2026-11-10",
  };

  it("builds canonical HTTPS blog URLs and rejects unsafe slugs", () => {
    expect(buildCanonicalBlogUrl("swerve-odometry-deep-dive")).toBe(
      "https://aresfirst.org/blog/swerve-odometry-deep-dive",
    );
    expect(() => buildCanonicalBlogUrl("../etc/passwd")).toThrow(/slug/i);
    expect(() => buildCanonicalBlogUrl("")).toThrow(/slug/i);
  });

  it("builds raster OpenGraph preview URLs targeting /api/og", () => {
    const ogUrl = buildBlogOgCardUrl(samplePost, "https://aresfirst.org");
    const parsed = new URL(ogUrl);
    expect(parsed.origin).toBe("https://aresfirst.org");
    expect(parsed.pathname).toBe("/api/og");
    expect(parsed.searchParams.get("title")).toBe("Swerve Odometry Deep Dive");
    expect(parsed.searchParams.get("category")).toBe("Control Theory");
    expect(parsed.searchParams.get("author")).toBe("CircuitFox");
    expect(parsed.searchParams.get("date")).toBe("2026-11-10");
  });

  it("formats general and Instagram-specific captions with team hashtags", () => {
    const shareCaption = buildBlogShareCaption(samplePost);
    expect(shareCaption).toContain("Swerve Odometry Deep Dive");
    expect(shareCaption).toContain("sub-centimeter autonomous repeatability");
    expect(shareCaption).toContain("https://aresfirst.org/blog/swerve-odometry-deep-dive");
    expect(shareCaption).toContain("#FTC23247");

    const igCaption = buildInstagramCaption(samplePost);
    expect(igCaption).toContain("Swerve Odometry Deep Dive");
    expect(igCaption).toContain("aresfirst.org/blog");
    expect(igCaption).toContain("#FIRSTTechChallenge");
  });

  it("creates keyless Web Share Intent URLs for X, Facebook, Bluesky, and LinkedIn", () => {
    const intents = buildBlogWebShareIntents({
      ...samplePost,
      description: "A ".repeat(300),
    });

    const xUrl = new URL(intents.x);
    expect(xUrl.origin).toBe("https://x.com");
    expect(xUrl.pathname).toBe("/intent/tweet");
    expect(xUrl.searchParams.get("url")).toBe(
      "https://aresfirst.org/blog/swerve-odometry-deep-dive",
    );
    expect((xUrl.searchParams.get("text") || "").length).toBeLessThanOrEqual(240);

    const fbUrl = new URL(intents.facebook);
    expect(fbUrl.origin).toBe("https://www.facebook.com");
    expect(fbUrl.pathname).toBe("/sharer/sharer.php");
    expect(fbUrl.searchParams.get("u")).toBe(
      "https://aresfirst.org/blog/swerve-odometry-deep-dive",
    );

    const bskyUrl = new URL(intents.bluesky);
    expect(bskyUrl.origin).toBe("https://bsky.app");
    expect(bskyUrl.pathname).toBe("/intent/compose");
    expect(bskyUrl.searchParams.get("text")).toContain(
      "https://aresfirst.org/blog/swerve-odometry-deep-dive",
    );
    expect((bskyUrl.searchParams.get("text") || "").length).toBeLessThanOrEqual(300);

    const liUrl = new URL(intents.linkedin);
    expect(liUrl.origin).toBe("https://www.linkedin.com");
    expect(liUrl.pathname).toBe("/sharing/share-offsite/");
    expect(liUrl.searchParams.get("url")).toBe(
      "https://aresfirst.org/blog/swerve-odometry-deep-dive",
    );
  });

  it("wraps long words and multi-line text deterministically with ellipsis", () => {
    expect(wrapCanvasLines("", 20, 3)).toEqual([]);
    expect(wrapCanvasLines("Short title", 20, 3)).toEqual(["Short title"]);
    const wrapped = wrapCanvasLines(
      "Autonomous trajectory optimization with spline curvature constraints and wheel slip rejection",
      24,
      2,
    );
    expect(wrapped).toHaveLength(2);
    expect(wrapped[1]?.endsWith("…")).toBe(true);

    const unbroken = wrapCanvasLines("Supercalifragilisticexpialidocious", 10, 2);
    expect(unbroken).toHaveLength(2);
    expect(unbroken[0]).toHaveLength(10);
  });

  it("renders a 1080x1080 branded PNG data URL on an HTML5 canvas", () => {
    const fillTextCalls: string[] = [];
    const gradientStub = { addColorStop: vi.fn() };
    const ctxStub = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      createLinearGradient: vi.fn(() => gradientStub),
      createRadialGradient: vi.fn(() => gradientStub),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn((text: string) => {
        fillTextCalls.push(text);
      }),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctxStub),
      toDataURL: vi.fn(() => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA"),
    } as unknown as HTMLCanvasElement;

    const dataUrl = renderInstagramSquareCardDataUrl(samplePost, () => fakeCanvas);
    expect(fakeCanvas.width).toBe(1080);
    expect(fakeCanvas.height).toBe(1080);
    expect(dataUrl).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA");
    expect(fillTextCalls.some((entry) => entry.includes("ARES 23247"))).toBe(true);
    expect(fillTextCalls.some((entry) => entry.includes("CONTROL THEORY"))).toBe(true);
    expect(fillTextCalls.some((entry) => entry.includes("Swerve Odometry"))).toBe(true);
    expect(fillTextCalls.some((entry) => entry.includes("aresfirst.org/blog"))).toBe(true);
  });

  it("throws an explicit error if 2D canvas context is unavailable", () => {
    const brokenCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null),
    } as unknown as HTMLCanvasElement;
    expect(() =>
      renderInstagramSquareCardDataUrl(samplePost, () => brokenCanvas),
    ).toThrow(/canvas/i);
  });

  it("measures pixel widths with ctx.measureText and enforces maxWidth bounds before the footer CTA pill", () => {
    const fillTextCalls: Array<{ text: string; x: number; y: number; maxWidth?: number }> = [];
    const gradientStub = { addColorStop: vi.fn() };
    const ctxStub = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      createLinearGradient: vi.fn(() => gradientStub),
      createRadialGradient: vi.fn(() => gradientStub),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      measureText: vi.fn((text: string) => {
        // Simulate wide uppercase glyphs (48px each for headline font, 16px otherwise)
        const charWidth = ctxStub.font.includes("62px") ? 48 : 16;
        return { width: text.length * charWidth };
      }),
      fillText: vi.fn((text: string, x: number, y: number, maxWidth?: number) => {
        fillTextCalls.push({ text, x, y, maxWidth });
      }),
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctxStub),
      toDataURL: vi.fn(() => "data:image/png;base64,MEASURED"),
    } as unknown as HTMLCanvasElement;

    const dataUrl = renderInstagramSquareCardDataUrl(
      {
        ...samplePost,
        title: "WWWWWWWWWWWWWWWWWWWWWWWWWW CHAMPIONSHIP AUTONOMOUS ARCHITECTURE BREAKDOWN",
        category: "ENGINEERING NOTEBOOK DEEP DIVE",
        author: "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
        date: "November 20, 2026",
      },
      () => fakeCanvas,
    );

    expect(dataUrl).toBe("data:image/png;base64,MEASURED");
    expect(ctxStub.measureText).toHaveBeenCalled();

    // Every headline call uses maxWidth 904 and wraps wide glyphs within 904px
    const headlineCalls = fillTextCalls.filter((call) => call.y >= 270 && call.y < 560 && call.x === 88);
    expect(headlineCalls.length).toBeGreaterThanOrEqual(2);
    for (const call of headlineCalls) {
      expect(call.maxWidth).toBe(904);
      expect(call.text.length * 48).toBeLessThanOrEqual(904);
    }

    // Byline call is truncated to fit 612px before the CTA pill at x=724
    const bylineCall = fillTextCalls.find((call) => call.x === 88 && call.y === 922);
    expect(bylineCall).toBeDefined();
    expect(bylineCall?.maxWidth).toBe(612);
    expect(bylineCall?.text.endsWith("…")).toBe(true);
    expect((bylineCall?.text.length ?? 0) * 16).toBeLessThanOrEqual(612);

    // Direct wrapMeasuredCanvasLines edge cases
    expect(
      wrapMeasuredCanvasLines(ctxStub as unknown as CanvasRenderingContext2D, "", 904, 3, 20),
    ).toEqual([]);
    const singleLong = wrapMeasuredCanvasLines(
      { measureText: (t: string) => ({ width: t.length * 30 }) } as unknown as CanvasRenderingContext2D,
      "SUPERLONGIDENTIFIERWITHOUTSPACES",
      150,
      2,
      30,
    );
    expect(singleLong).toHaveLength(2);
    expect(singleLong[1]?.endsWith("…")).toBe(true);
  });
});
