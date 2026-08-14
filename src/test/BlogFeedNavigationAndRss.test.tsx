import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HelmetProvider } from "react-helmet-async";
import BlogFeedPage from "../app/blog/page";
import BlogPostPage from "../app/blog/[slug]/page";
import BlogTableOfContents from "../components/blog/BlogTableOfContents";
import ArticleQuoteCallout from "../components/blog/ArticleQuoteCallout";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_ITEMS,
  calculateReadingTime,
  extractTableOfContents,
  filterPostsByCategory,
  formatQuoteForSharing,
  generateAtomFeed,
  generateRssFeed,
  slugifyHeading,
  escapeXml,
} from "../lib/blogSyndication";
import { onSnapshot } from "firebase/firestore";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "test-user" },
    authorizedUser: { role: "admin" },
    loading: false,
  }),
}));

vi.mock("@/lib/firebaseFirestore", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
}));

describe("Blog Syndication, Navigation, Reading Time & RSS Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Category Taxonomy & Filtering Utilities", () => {
    it("exports canonical category lists", () => {
      expect(BLOG_CATEGORIES).toEqual([
        "All",
        "Engineering",
        "Software",
        "Outreach",
        "Business",
        "Competitions",
      ]);
      expect(BLOG_CATEGORY_ITEMS).toEqual([
        "Engineering",
        "Software",
        "Outreach",
        "Business",
        "Competitions",
      ]);
    });

    it("filters posts by category correctly", () => {
      const posts = [
        { slug: "p1", title: "Odometry", category: "Engineering" },
        { slug: "p2", title: "Vision PID", category: "Software" },
        { slug: "p3", title: "Library Demo", category: "Outreach" },
        { slug: "p4", title: "Sponsor Pitch", category: "Business" },
        { slug: "p5", title: "Worlds Recap", category: "Competitions" },
        { slug: "p6", title: "Uncategorized" },
      ];

      // "All" returns everything
      expect(filterPostsByCategory(posts, "All")).toEqual(posts);
      expect(filterPostsByCategory(posts, "")).toEqual(posts);
      expect(filterPostsByCategory(posts, null)).toEqual(posts);

      // Specific categories (case-insensitive)
      expect(filterPostsByCategory(posts, "Engineering")).toHaveLength(1);
      expect(filterPostsByCategory(posts, "engineering")[0].slug).toBe("p1");
      expect(filterPostsByCategory(posts, "Software")).toHaveLength(1);
      expect(filterPostsByCategory(posts, "Outreach")).toHaveLength(1);
      expect(filterPostsByCategory(posts, "Business")).toHaveLength(1);
      expect(filterPostsByCategory(posts, "Competitions")).toHaveLength(1);

      // Non-matching category
      expect(filterPostsByCategory(posts, "NonExistent")).toHaveLength(0);

      // Invalid input handling
      expect(filterPostsByCategory(null as unknown as { category?: string }[], "All")).toEqual([]);
    });
  });

  describe("Reading Time Estimation", () => {
    it("handles empty or non-string inputs safely", () => {
      expect(calculateReadingTime("")).toEqual({
        minutes: 1,
        words: 0,
        text: "1 min read",
        timeRequiredIso: "PT1M",
      });
      expect(calculateReadingTime(null)).toEqual({
        minutes: 1,
        words: 0,
        text: "1 min read",
        timeRequiredIso: "PT1M",
      });
      expect(calculateReadingTime(undefined)).toEqual({
        minutes: 1,
        words: 0,
        text: "1 min read",
        timeRequiredIso: "PT1M",
      });
    });

    it("calculates accurate reading time stripping markdown syntax", () => {
      const shortText = "This is a simple ten word sentence for testing the calculator.";
      const shortResult = calculateReadingTime(shortText, 200);
      expect(shortResult.words).toBe(11);
      expect(shortResult.minutes).toBe(1);
      expect(shortResult.text).toBe("1 min read");
      expect(shortResult.timeRequiredIso).toBe("PT1M");

      // Generate a ~450 word markdown text with code blocks and links
      const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(" ");
      const markdown = `
# Title

\`\`\`typescript
const x = 1;
const y = 2;
// 100 code lines that should not count as prose reading
\`\`\`

![Diagram](https://example.com/image.png)

${words}

[Link to resource](https://example.com)
`;
      const result = calculateReadingTime(markdown, 200);
      expect(result.words).toBeGreaterThanOrEqual(450);
      expect(result.minutes).toBe(3);
      expect(result.text).toBe("3 min read");
      expect(result.timeRequiredIso).toBe("PT3M");
    });

    it("supports custom words-per-minute parameter and handles edge values", () => {
      const text = "Word ".repeat(500);
      expect(calculateReadingTime(text, 100).minutes).toBe(5);
      expect(calculateReadingTime(text, 500).minutes).toBe(1);
      // Fallback for 0 or negative WPM
      expect(calculateReadingTime(text, 0).minutes).toBe(3);
      expect(calculateReadingTime(text, -50).minutes).toBe(3);
    });
  });

  describe("Heading Slugification & Table of Contents Extraction", () => {
    it("slugifies heading text accurately", () => {
      expect(slugifyHeading("Hardware Overview")).toBe("hardware-overview");
      expect(slugifyHeading("2026 FTC Into The Deep: Season Plan!")).toBe("2026-ftc-into-the-deep-season-plan");
      expect(slugifyHeading("   Trailing / Leading Spaces   ")).toBe("trailing-leading-spaces");
      expect(slugifyHeading("Special @#$$% Characters")).toBe("special-characters");
      expect(slugifyHeading("")).toBe("heading");
      expect(slugifyHeading(null)).toBe("heading");
    });

    it("extracts H2, H3, and H4 headings ignoring code blocks and duplicate names", () => {
      const markdown = `
# Main Post Title (H1 ignored for TOC)

Introduction paragraph.

## Mechanical Design
Details about the chassis.

\`\`\`markdown
## Fake Heading Inside Code Block
\`\`\`

### Linear Slide System
Details about slides.

### Intake Mechanism
Details about intake.

## Mechanical Design
Second section with identical heading name.

#### Fine Tuning
Sub-sub heading level 4.
`;

      const toc = extractTableOfContents(markdown);
      expect(toc).toHaveLength(5);
      expect(toc[0]).toEqual({ id: "mechanical-design", text: "Mechanical Design", level: 2 });
      expect(toc[1]).toEqual({ id: "linear-slide-system", text: "Linear Slide System", level: 3 });
      expect(toc[2]).toEqual({ id: "intake-mechanism", text: "Intake Mechanism", level: 3 });
      expect(toc[3]).toEqual({ id: "mechanical-design-1", text: "Mechanical Design", level: 2 });
      expect(toc[4]).toEqual({ id: "fine-tuning", text: "Fine Tuning", level: 4 });
    });

    it("returns empty array for empty markdown or markdown without headings", () => {
      expect(extractTableOfContents("")).toEqual([]);
      expect(extractTableOfContents("Just plain paragraphs without headers.")).toEqual([]);
      expect(extractTableOfContents(null)).toEqual([]);
    });
  });

  describe("Social Quote Copy & Formatting", () => {
    it("formats quotes properly for social sharing and clipboard", () => {
      expect(formatQuoteForSharing("> Engineering without testing is just guessing.", "Testing Guide", "https://aresfirst.org/blog/testing")).toBe(
        '"Engineering without testing is just guessing." — "Testing Guide" | https://aresfirst.org/blog/testing'
      );

      expect(formatQuoteForSharing("Simple standalone quote.")).toBe('"Simple standalone quote."');
      expect(formatQuoteForSharing("", "Title", "https://ares.org")).toBe("");
      expect(formatQuoteForSharing(null)).toBe("");
    });

    it("renders ArticleQuoteCallout and handles copy action", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const { unmount } = render(
        <ArticleQuoteCallout cite="Chief Engineer">
          <span>Precision is not an accident; it is <strong>engineered</strong>.</span>
        </ArticleQuoteCallout>
      );

      expect(screen.getByText(/Precision is not an accident/i)).toBeInTheDocument();
      expect(screen.getByText(/Chief Engineer/i)).toBeInTheDocument();

      const copyBtn = screen.getByRole("button", { name: "Copy quote to clipboard" });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(
          expect.stringContaining("Precision is not an accident; it is engineered.")
        );
      });
      expect(await screen.findByText("Copied")).toBeInTheDocument();
      unmount();
    });

    it("clears copied state after feedback timeout", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(<ArticleQuoteCallout>Short quote to test timer</ArticleQuoteCallout>);
      const copyBtn = screen.getByRole("button", { name: "Copy quote to clipboard" });
      fireEvent.click(copyBtn);
      expect(await screen.findByText("Copied")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText("Copied")).not.toBeInTheDocument();
      }, { timeout: 3500 });
    });

    it("handles native share button click when navigator.share is available", async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        share: shareMock,
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ArticleQuoteCallout>
          Robotics brings communities together.
        </ArticleQuoteCallout>
      );

      const shareBtn = screen.getByRole("button", { name: "Share quote" });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(shareMock).toHaveBeenCalledWith(
          expect.objectContaining({
            text: '"Robotics brings communities together."',
          })
        );
      });
    });

    it("falls back to copy when navigator.share fails with error", async () => {
      const shareMock = vi.fn().mockRejectedValue(new Error("Share failed"));
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        share: shareMock,
        clipboard: {
          writeText: writeTextMock,
        },
      });

      render(
        <ArticleQuoteCallout>
          Failure is an iterative step toward success.
        </ArticleQuoteCallout>
      );

      const shareBtn = screen.getByRole("button", { name: "Share quote" });
      fireEvent.click(shareBtn);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled();
      });
    });

    it("handles clipboard failure gracefully in ArticleQuoteCallout", async () => {
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      });

      render(
        <ArticleQuoteCallout>
          Resilience under failure is key.
        </ArticleQuoteCallout>
      );

      const copyBtn = screen.getByRole("button", { name: "Copy quote to clipboard" });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("Unable to copy quote automatically.");
      });
    });
  });

  describe("BlogTableOfContents Component", () => {
    it("renders Table of Contents and highlights active item on click with smooth scroll", () => {
      const scrollIntoViewMock = vi.fn();
      const div = document.createElement("div");
      div.id = "odometry-sensor-fusion";
      div.scrollIntoView = scrollIntoViewMock;
      document.body.appendChild(div);

      const markdown = `
## Drivetrain Architecture
Text about drivetrain.
### Odometry Sensor Fusion
Text about odometry.
## Autonomous Pathing
Text about pathing.
`;

      render(<BlogTableOfContents content={markdown} />);

      expect(screen.getByRole("navigation", { name: "Table of contents" })).toBeInTheDocument();
      const link1 = screen.getByRole("link", { name: "Drivetrain Architecture" });
      const link2 = screen.getByRole("link", { name: "Odometry Sensor Fusion" });
      const link3 = screen.getByRole("link", { name: "Autonomous Pathing" });

      expect(link1).toHaveAttribute("href", "#drivetrain-architecture");
      expect(link2).toHaveAttribute("href", "#odometry-sensor-fusion");
      expect(link3).toHaveAttribute("href", "#autonomous-pathing");

      // Clicking link updates active item and scrolls
      fireEvent.click(link2);
      expect(link2).toHaveAttribute("aria-current", "location");
      expect(scrollIntoViewMock).toHaveBeenCalled();

      // Collapsible mobile toggle
      const toggleBtn = screen.getByRole("button", { name: /Table of Contents/i });
      fireEvent.click(toggleBtn);
      document.body.removeChild(div);
    });

    it("supports IntersectionObserver when available and updates active item on intersection", async () => {
      let observerCallback: IntersectionObserverCallback | null = null;
      const observeMock = vi.fn();
      const disconnectMock = vi.fn();

      class MockIntersectionObserver {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe = observeMock;
        unobserve = vi.fn();
        disconnect = disconnectMock;
      }

      // @ts-expect-error mock observer
      window.IntersectionObserver = MockIntersectionObserver;

      const d1 = document.createElement("div");
      d1.id = "section-1";
      document.body.appendChild(d1);
      const d2 = document.createElement("div");
      d2.id = "section-2";
      document.body.appendChild(d2);

      const items = [
        { id: "section-1", text: "Section 1", level: 2 },
        { id: "section-2", text: "Section 2", level: 2 },
      ];

      const { unmount } = render(<BlogTableOfContents content="" items={items} />);

      expect(observerCallback).not.toBeNull();

      // Trigger intersection with entries
      if (observerCallback) {
        (observerCallback as IntersectionObserverCallback)(
          [
            {
              isIntersecting: true,
              target: d2,
              boundingClientRect: { top: 100 } as DOMRectReadOnly,
            } as unknown as IntersectionObserverEntry,
            {
              isIntersecting: true,
              target: d1,
              boundingClientRect: { top: 200 } as DOMRectReadOnly,
            } as unknown as IntersectionObserverEntry,
          ],
          // @ts-expect-error mock instance
          {}
        );
      }

      await waitFor(() => {
        const activeLink = screen.getByRole("link", { name: "Section 2" });
        expect(activeLink).toHaveAttribute("aria-current", "location");
      });

      unmount();
      expect(disconnectMock).toHaveBeenCalled();

      document.body.removeChild(d1);
      document.body.removeChild(d2);

      // @ts-expect-error cleanup mock
      delete window.IntersectionObserver;
    });

    it("renders null if content has no headings", () => {
      const { container } = render(<BlogTableOfContents content="No headings here." />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("RSS 2.0 and Atom XML Feed Generation", () => {
    const mockPosts = [
      {
        slug: "odometry-breakthrough",
        title: "Odometry & Localization <Breakthrough>",
        date: "August 12, 2026",
        snippet: "Fusion with optical flow & IMU.",
        author: "Chief Software Architect",
        category: "Software",
      },
      {
        slug: "outreach-2026",
        title: "Community Outreach in Morgantown",
        date: "August 5, 2026",
        snippet: "Mentoring FLL teams.",
        author: "Outreach Lead",
        category: "Outreach",
      },
    ];

    it("escapes XML special characters", () => {
      expect(escapeXml('Rock & Roll <music> "quoted" \'single\'')).toBe(
        "Rock &amp; Roll &lt;music&gt; &quot;quoted&quot; &apos;single&apos;"
      );
      expect(escapeXml(null)).toBe("");
    });

    it("generates valid RSS 2.0 XML with items, guid, pubDate, categories, and channels", () => {
      const rss = generateRssFeed({
        posts: mockPosts,
        siteUrl: "https://aresfirst.org",
        title: "ARES 23247 Blog",
        description: "Official robotics engineering posts.",
      });

      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(rss).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
      expect(rss).toContain("<title>ARES 23247 Blog</title>");
      expect(rss).toContain("<link>https://aresfirst.org/blog</link>");
      expect(rss).toContain('<atom:link href="https://aresfirst.org/rss.xml" rel="self" type="application/rss+xml" />');
      expect(rss).toContain("<title>Odometry &amp; Localization &lt;Breakthrough&gt;</title>");
      expect(rss).toContain("<link>https://aresfirst.org/blog/odometry-breakthrough</link>");
      expect(rss).toContain("<category>Software</category>");
      expect(rss).toContain("<category>Outreach</category>");
      expect(rss).toContain("<pubDate>");
      expect(rss).toContain("</channel>\n</rss>");
    });

    it("generates valid Atom 1.0 XML with entries, id, updated, link alternate, and summaries", () => {
      const atom = generateAtomFeed({
        posts: mockPosts,
        siteUrl: "https://aresfirst.org",
        title: "ARES 23247 Blog",
        description: "Official robotics engineering posts.",
      });

      expect(atom).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
      expect(atom).toContain("<title>ARES 23247 Blog</title>");
      expect(atom).toContain("<id>https://aresfirst.org/blog</id>");
      expect(atom).toContain('<link href="https://aresfirst.org/atom.xml" rel="self" />');
      expect(atom).toContain("<title>Odometry &amp; Localization &lt;Breakthrough&gt;</title>");
      expect(atom).toContain('<link href="https://aresfirst.org/blog/odometry-breakthrough" rel="alternate" />');
      expect(atom).toContain('<category term="Software" />');
      expect(atom).toContain("<name>Chief Software Architect</name>");
      expect(atom).toContain("</feed>");
    });
  });

  describe("BlogFeedPage and BlogPostPage Integrated Features", () => {
    it("renders category filter chips and filters articles on click", async () => {
      const mockDocs = [
        {
          id: "intake-v2",
          data: () => ({
            title: "Intake Mechanism V2",
            date: "August 12, 2026",
            snippet: "Active roller speed tuning.",
            category: "Engineering",
            author: "Mech Lead",
            status: "published",
            isDeleted: 0,
          }),
        },
        {
          id: "cv-odometry",
          data: () => ({
            title: "Computer Vision & Odometry",
            date: "August 10, 2026",
            snippet: "AprilTag detection pipeline.",
            category: "Software",
            author: "Code Lead",
            status: "published",
            isDeleted: 0,
          }),
        },
      ];

      vi.mocked(onSnapshot).mockImplementation((_query: unknown, onNext: unknown) => {
        (onNext as (snap: { docs: typeof mockDocs }) => void)({ docs: mockDocs });
        return () => undefined;
      });

      render(
        <HelmetProvider>
          <MemoryRouter>
            <BlogFeedPage />
          </MemoryRouter>
        </HelmetProvider>
      );

      // Verify category filter chips render
      expect(await screen.findByRole("button", { name: /Engineering/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Software/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Outreach/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Business/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Competitions/i })).toBeInTheDocument();

      // Verify both posts initially appear
      expect(screen.getByText("Intake Mechanism V2")).toBeInTheDocument();
      expect(screen.getByText("Computer Vision & Odometry")).toBeInTheDocument();

      // Verify RSS and Atom discovery buttons in header
      expect(screen.getByRole("link", { name: "Subscribe to RSS 2.0 feed" })).toHaveAttribute("href", "/rss.xml");
      expect(screen.getByRole("link", { name: "Subscribe to Atom feed" })).toHaveAttribute("href", "/atom.xml");

      // Filter by Software
      const softwareChip = screen.getByRole("button", { name: /Software/i });
      fireEvent.click(softwareChip);

      expect(screen.getByText("Computer Vision & Odometry")).toBeInTheDocument();
      expect(screen.queryByText("Intake Mechanism V2")).not.toBeInTheDocument();

      // Filter by Outreach (no posts matching)
      const outreachChip = screen.getByRole("button", { name: /Outreach/i });
      fireEvent.click(outreachChip);

      expect(screen.getByText('No articles found in "Outreach"')).toBeInTheDocument();
      const showAllBtn = screen.getByRole("button", { name: "Show all articles" });
      fireEvent.click(showAllBtn);

      expect(screen.getByText("Intake Mechanism V2")).toBeInTheDocument();
      expect(screen.getByText("Computer Vision & Odometry")).toBeInTheDocument();
    });

    it("renders BlogPostPage with reading time, category tag, and sticky TOC", async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          title: "Autonomous Feedforward Control",
          date: "August 10, 2026",
          snippet: "PIDF tuning principles for 23247 linear slides.",
          category: "Engineering",
          author: "Lead Mechanist",
          content: `
# Overview
Introduction to the feedforward design.

## Gravity Compensation
Detailed derivation of constant force spring dynamics.

## Velocity Feedforward
KV parameter tuning steps.

> Testing on the real robot revealed immediate trajectory stability.
`,
          status: "published",
          isDeleted: 0,
        }),
      };

      vi.mocked(onSnapshot).mockImplementation((_docRef: unknown, onNext: unknown) => {
        (onNext as (snap: typeof mockDocSnap) => void)(mockDocSnap);
        return () => undefined;
      });

      render(
        <HelmetProvider>
          <MemoryRouter initialEntries={["/blog/autonomous-feedforward-control"]}>
            <Routes>
              <Route path="/blog/:slug" element={<BlogPostPage />} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      );

      expect(await screen.findByRole("heading", { name: "Autonomous Feedforward Control" })).toBeInTheDocument();
      expect(screen.getAllByText("Engineering")[0]).toBeInTheDocument();
      expect(screen.getByText(/min read/i)).toBeInTheDocument();

      // TOC should contain sections
      expect(screen.getAllByText("Gravity Compensation")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Velocity Feedforward")[0]).toBeInTheDocument();

      // Quote callout is rendered with copy action
      expect(screen.getByText(/Testing on the real robot revealed immediate trajectory stability/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy quote to clipboard" })).toBeInTheDocument();
    });
  });
});