import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideosPage from "../app/videos/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const mockVideos = [
  {
    id: "vid_1",
    title: "Championship Autonomous Pathing",
    description: "Breakdown of our pure pursuit odometry implementation.",
    platform: "youtube" as const,
    videoId: "pathing1234",
    thumbnailUrl: "https://img.youtube.com/vi/pathing1234/hqdefault.jpg",
    watchUrl: "https://www.youtube.com/watch?v=pathing1234",
    embedUrl: "https://www.youtube-nocookie.com/embed/pathing1234",
    type: "video" as const,
    status: "published" as const,
    createdAt: "2026-02-15T00:00:00Z",
    isArchived: false,
  },
  {
    id: "vid_2",
    title: "15-Second Claw Cycle Demonstration",
    description: "Rapid intake and specimen drop cycling.",
    platform: "youtube" as const,
    videoId: "shortclaw12",
    thumbnailUrl: "https://img.youtube.com/vi/shortclaw12/hqdefault.jpg",
    watchUrl: "https://www.youtube.com/watch?v=shortclaw12",
    embedUrl: "https://www.youtube-nocookie.com/embed/shortclaw12",
    type: "short" as const,
    status: "published" as const,
    createdAt: "2026-03-01T00:00:00Z",
    isArchived: false,
  },
];

describe("VideosPage Filter, Sandbox, & Keyboard Navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("filters videos by type and updates the active filter list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ videos: mockVideos, hasMore: false, nextCursor: null })));

    render(<VideosPage />);

    expect(await screen.findByRole("heading", { name: "Championship Autonomous Pathing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "15-Second Claw Cycle Demonstration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Team YouTube/i })).toHaveAttribute("href", "https://www.youtube.com/@ARESFTC");

    // Filter by Shorts
    fireEvent.click(screen.getByRole("button", { name: "Shorts" }));
    expect(screen.queryByRole("heading", { name: "Championship Autonomous Pathing" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "15-Second Claw Cycle Demonstration" })).toBeInTheDocument();

    // Filter by Videos
    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    expect(screen.getByRole("heading", { name: "Championship Autonomous Pathing" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "15-Second Claw Cycle Demonstration" })).not.toBeInTheDocument();
  });

  it("opens modal video player with safe sandbox attributes, position counter, and cycles with Arrow keys", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ videos: mockVideos, hasMore: false, nextCursor: null })));

    render(<VideosPage />);

    const playFirst = await screen.findByRole("button", { name: /play championship autonomous pathing/i });
    fireEvent.click(playFirst);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 2")).toBeInTheDocument();

    const iframe = dialog.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/pathing1234?autoplay=1&rel=0",
    );
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-presentation allow-popups");
    expect(iframe).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    expect(
      within(dialog).getByRole("link", { name: "Open on YouTube" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=pathing1234");

    // Navigate right with keyboard
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByRole("heading", { name: "15-Second Claw Cycle Demonstration" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 of 2")).toBeInTheDocument();

    // Navigate left with keyboard
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(dialog).getByRole("heading", { name: "Championship Autonomous Pathing" })).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 2")).toBeInTheDocument();
  });
});
