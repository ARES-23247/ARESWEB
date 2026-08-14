import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BlogFeedPage from "../app/blog/page";
import BlogPostPage from "../app/blog/[slug]/page";
import { onSnapshot } from "firebase/firestore";

vi.mock("@/components/SEO", () => ({
  default: () => null,
  getOgImageUrl: vi.fn().mockReturnValue("https://aresfirst.org/api/og?title=Mock"),
}));
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

describe("Blog Public Pages UX & Resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BlogFeedPage", () => {
    it("renders published articles with titles, snippets, authors, and links", async () => {
      const mockDocs = [
        {
          id: "into-the-deep-odometry",
          data: () => ({
            title: "Into the Deep Odometry Breakthrough",
            date: "August 12, 2026",
            snippet: "How we achieved millimeter accuracy with optical flow sensor fusion.",
            thumbnail: "https://example.com/thumb1.jpg",
            author: "Lead Programmer",
            status: "published",
            isDeleted: 0,
          }),
        },
        {
          id: "regional-outreach-retrospective",
          data: () => ({
            title: "Morgantown Library STEM Demo",
            date: "August 5, 2026",
            snippet: "Reflections on introducing 45 elementary students to FIRST robotics.",
            author: "Outreach Lead",
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
        <MemoryRouter>
          <BlogFeedPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "Into the Deep Odometry Breakthrough" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Morgantown Library STEM Demo" })).toBeInTheDocument();
      expect(screen.getByText(/How we achieved millimeter accuracy/i)).toBeInTheDocument();
      expect(screen.getByText("Lead Programmer")).toBeInTheDocument();
      expect(screen.getByText("Outreach Lead")).toBeInTheDocument();
    });

    it("displays empty state when no articles are published", async () => {
      vi.mocked(onSnapshot).mockImplementation((_query: unknown, onNext: unknown) => {
        (onNext as (snap: { docs: unknown[] }) => void)({ docs: [] });
        return () => undefined;
      });

      render(
        <MemoryRouter>
          <BlogFeedPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "No published articles yet" })).toBeInTheDocument();
      expect(screen.getByText("New engineering and outreach stories will appear here.")).toBeInTheDocument();
    });

    it("renders PublicDataState when Firestore snapshot fails", async () => {
      vi.mocked(onSnapshot).mockImplementation((_query: unknown, _onNext: unknown, onError: unknown) => {
        (onError as (err: Error) => void)(new Error("Firestore connection dropped"));
        return () => undefined;
      });

      render(
        <MemoryRouter>
          <BlogFeedPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("Unable to load the team blog")).toBeInTheDocument();
      expect(screen.getByText("The published articles could not be reached. Check your connection and try again.")).toBeInTheDocument();
    });
  });

  describe("BlogPostPage", () => {
    it("renders article content, author, date, and share links for a published post", async () => {
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          title: "Autonomous Feedforward Control",
          date: "August 10, 2026",
          snippet: "PIDF tuning principles for 23247 linear slides.",
          author: "Lead Mechanist",
          content: "# Feedforward Overview\n\nLinear slides require gravity compensation.",
          status: "published",
          isDeleted: 0,
        }),
      };

      vi.mocked(onSnapshot).mockImplementation((_docRef: unknown, onNext: unknown) => {
        (onNext as (snap: typeof mockDocSnap) => void)(mockDocSnap);
        return () => undefined;
      });

      render(
        <MemoryRouter initialEntries={["/blog/autonomous-feedforward-control"]}>
          <Routes>
            <Route path="/blog/:slug" element={<BlogPostPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "Autonomous Feedforward Control" })).toBeInTheDocument();
      expect(screen.getByText("Lead Mechanist")).toBeInTheDocument();
      expect(screen.getByText("August 10, 2026")).toBeInTheDocument();
      expect(screen.getByText("Feedforward Overview")).toBeInTheDocument();
      expect(screen.getByText(/Linear slides require gravity compensation/i)).toBeInTheDocument();
    });

    it("shows 404 state when the post does not exist or is unpublished", async () => {
      const mockDocSnap = {
        exists: () => false,
        data: () => undefined,
      };

      vi.mocked(onSnapshot).mockImplementation((_docRef: unknown, onNext: unknown) => {
        (onNext as (snap: typeof mockDocSnap) => void)(mockDocSnap);
        return () => undefined;
      });

      render(
        <MemoryRouter initialEntries={["/blog/missing-post"]}>
          <Routes>
            <Route path="/blog/:slug" element={<BlogPostPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText("Blog Post Not Found")).toBeInTheDocument();
      expect(screen.getByText("The blog post you requested does not exist, has been unpublished, or was moved.")).toBeInTheDocument();
    });
  });
});
