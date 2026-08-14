import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ShareButtons from "@/components/ShareButtons";

describe("ShareButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all social sharing buttons and copy link button", () => {
    render(<ShareButtons title="State Finals Victory" description="Read our championship recap" />);

    expect(screen.getByText("Share this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Share on X (Twitter)" })).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet")
    );
    expect(screen.getByRole("link", { name: "Share on Bluesky" })).toHaveAttribute(
      "href",
      expect.stringContaining("bsky.app/intent/compose")
    );
    expect(screen.getByRole("link", { name: "Share on Threads" })).toHaveAttribute(
      "href",
      expect.stringContaining("threads.net/intent/post")
    );
    expect(screen.getByRole("link", { name: "Share on LinkedIn" })).toHaveAttribute(
      "href",
      expect.stringContaining("linkedin.com/sharing")
    );
    expect(screen.getByRole("link", { name: "Share on Facebook" })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/sharer")
    );
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("copies current URL to clipboard when copy link button is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    render(<ShareButtons title="Build Log" />);
    const copyButton = screen.getByRole("button", { name: "Copy link" });

    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalled();
  });

  it("invokes navigator.share when native share button is clicked", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    render(<ShareButtons title="Build Log" description="A quick summary" />);
    const shareButton = screen.getByRole("button", { name: "Share via device menu" });

    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
        title: "Build Log",
        text: "A quick summary",
      }));
    });
  });
});
