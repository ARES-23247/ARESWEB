import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BlogShareKitModal from "@/components/dashboard/BlogShareKitModal";
import type { DocRecord } from "@/hooks/useDocumentSync";

vi.mock("@/lib/blogShareKit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blogShareKit")>();
  return {
    ...actual,
    renderInstagramSquareCardDataUrl: vi.fn(
      () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    ),
  };
});

const publishedPost: DocRecord = {
  slug: "state-finals-recap",
  title: "State Finals Recap",
  category: "Tournament",
  sortOrder: 0,
  description: "Breaking down our autonomous consistency and alliance strategy.",
  content: "# State Finals Recap",
  status: "published",
  approvalStatus: "approved",
  isDeleted: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 0,
  isPortfolio: 0,
  isExecutiveSummary: 0,
  author: "CircuitFox",
  date: "2026-11-10",
};

describe("BlogShareKitModal", () => {
  const writeTextMock = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  it("renders nothing when post is null", () => {
    const { container } = render(
      <BlogShareKitModal
        post={null}
        isApprover
        syndicatingSlug={null}
        onSyndicate={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders keyless Web Share Intents, copies captions, downloads the 1080x1080 Instagram card, and triggers direct Zulip/Bluesky announcements", async () => {
    const onSyndicate = vi.fn();
    const onClose = vi.fn();

    render(
      <BlogShareKitModal
        post={publishedPost}
        isApprover
        syndicatingSlug={null}
        onSyndicate={onSyndicate}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /Share Kit: State Finals Recap/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Post on X/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://x.com/intent/tweet"),
    );
    expect(screen.getByRole("link", { name: /Share on Facebook/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://www.facebook.com/sharer/sharer.php"),
    );
    expect(screen.getByRole("link", { name: /Compose on Bluesky/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://bsky.app/intent/compose"),
    );
    expect(screen.getByRole("link", { name: /Share on LinkedIn/i })).toHaveAttribute(
      "href",
      expect.stringContaining("https://www.linkedin.com/sharing/share-offsite/"),
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy Caption & Link/i }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("https://aresfirst.org/blog/state-finals-recap"),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Copy Instagram Caption/i }));
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        expect.stringContaining("aresfirst.org/blog"),
      );
    });

    const downloadLink = screen.getByRole("link", {
      name: /Download 1080×1080 Instagram PNG/i,
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
    );
    expect(downloadLink).toHaveAttribute(
      "download",
      "ares-23247-state-finals-recap-instagram.png",
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Announce on Zulip & Bluesky/i }),
    );
    expect(onSyndicate).toHaveBeenCalledWith(publishedPost);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("hides server-side Zulip & Bluesky announcement button from non-approver members while keeping Share Kit tools available", () => {
    render(
      <BlogShareKitModal
        post={publishedPost}
        isApprover={false}
        syndicatingSlug={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /Post on X/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Announce on Zulip & Bluesky/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an accessible error state instead of crashing when a draft has an invalid slug", () => {
    render(
      <BlogShareKitModal
        post={{
          slug: "../draft with spaces",
          title: "Unsaved Draft",
          status: "draft",
        }}
        isApprover
        syndicatingSlug={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid/i);
  });
});
