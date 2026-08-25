import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcademyPage from "../app/academy/page";
import { addDoc } from "firebase/firestore";
import {
  fetchPublicDocument,
  fetchPublicDocuments,
  PublicContentApiError,
} from "@/lib/publicContentApi";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/EducationalCredentialSchema", () => ({
  default: () => null,
  ARES_CREDENTIALS: [],
}));
vi.mock("@/components/ZulipThread", () => ({ default: () => null }));
vi.mock("@/lib/firebaseFirestore", () => ({ db: {} }));
vi.mock("@/lib/publicContentApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/publicContentApi")>(),
  fetchPublicDocument: vi.fn(),
  fetchPublicDocuments: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  useOptionalAuth: () => undefined,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ id: path, path })),
  addDoc: vi.fn(),
}));

class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

const mockDocsList = [
  {
    learningSchemaVersion: 1,
    metadataStatus: "complete" as const,
    subject: "computing-ai" as const,
    topics: ["artificial intelligence"],
    contentType: "lesson" as const,
    level: "beginner" as const,
    estimatedMinutes: 30,
    pathMemberships: [{ pathId: "ai-ml-foundations" as const, order: 1 }],
    prerequisites: [],
    objectives: ["Describe foundational AI concepts."],
    platforms: ["web" as const],
    sourceReferences: [],
    safetyScope: "none" as const,
    slug: "ai-101-intro",
    title: "Introduction to Artificial Intelligence",
    category: "AI 101",
    sortOrder: 1,
    description: "Foundational concepts of artificial intelligence in FTC robotics.",
    content: "# Intro to AI\n\nArtificial intelligence powers modern autonomous navigation.",
    displayInMathCorner: 1,
    displayInScienceCorner: 0,
    displayInAreslib: 0,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    status: "published",
    isDeleted: 0,
    original_authorNickname: "AlphaCoder",
    updatedAt: "2026-08-10T12:00:00Z",
  },
  {
    learningSchemaVersion: 1,
    metadataStatus: "complete" as const,
    subject: "computing-ai" as const,
    topics: ["neural networks", "computer vision"],
    contentType: "lesson" as const,
    level: "intermediate" as const,
    estimatedMinutes: 45,
    pathMemberships: [{ pathId: "ai-ml-foundations" as const, order: 2 }],
    prerequisites: ["ai-101-intro"],
    objectives: ["Explain how convolutional filters process images."],
    platforms: ["web" as const],
    sourceReferences: [],
    safetyScope: "none" as const,
    slug: "neural-networks-basics",
    title: "Neural Networks for Computer Vision",
    category: "Neural Networks",
    sortOrder: 2,
    description: "Understanding perceptrons and convolutional layers.",
    content: "# Neural Networks\n\nConvolutional filters extract spatial features from camera frames.",
    displayInMathCorner: 0,
    displayInScienceCorner: 1,
    displayInAreslib: 0,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    status: "published",
    isDeleted: 0,
    original_authorNickname: "VisionLead",
    updatedAt: "2026-08-11T12:00:00Z",
  },
];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-probe">{location.pathname}{location.search}</output>;
}

describe("AcademyPage Documentation & Interactive Lessons UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      authorizedUser: null,
    });
  });

  it("keeps the Academy root as a subject and learning-path landing page", async () => {
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);

    render(
      <MemoryRouter initialEntries={["/academy"]}>
        <Routes>
          <Route path="/academy" element={<><AcademyPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "ARES Academy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning paths" })).toBeInTheDocument();
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/academy");
    expect(fetchPublicDocument).not.toHaveBeenCalled();
    expect(screen.getByText("Showing 2 of 2 items.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /AI and Machine Learning Foundations/i }));
    expect(screen.getByText("Showing 2 of 2 items.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search titles and topics"), { target: { value: "not present" } });
    expect(screen.getByRole("heading", { name: "No matching lessons" })).toBeInTheDocument();
  });

  it("loads doc list and displays the active lesson with author lifecycle and navigation links", async () => {
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);
    vi.mocked(fetchPublicDocument).mockResolvedValue(mockDocsList[0]);

    render(
      <MemoryRouter initialEntries={["/academy/ai-101-intro"]}>
        <Routes>
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/academy/:slug" element={<AcademyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Introduction to Artificial Intelligence" })).toBeInTheDocument();
    expect(screen.getByText(/Foundational concepts of artificial intelligence/i)).toBeInTheDocument();
    expect(screen.getByText("AlphaCoder")).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorized team members can sign in to leave documentation feedback/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yes, it was/i })).not.toBeInTheDocument();

    // Next navigation button to neural networks lesson
    expect(screen.getByRole("link", { name: /Next.*Neural Networks for Computer Vision/i })).toHaveAttribute(
      "href",
      "/academy/neural-networks-basics"
    );
  });

  it("allows searching documents with quick search modal and navigating to selected lesson", async () => {
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);
    vi.mocked(fetchPublicDocument).mockImplementation(async (requestedSlug) => (
      mockDocsList.find((item) => item.slug === requestedSlug) ?? mockDocsList[0]
    ));

    render(
      <MemoryRouter initialEntries={["/academy/ai-101-intro?q=Neural&view=full"]}>
        <Routes>
          <Route path="/academy/:slug" element={<><AcademyPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    );

    const searchDialog = await screen.findByRole("dialog", { name: "Search documentation" });
    expect(await screen.findByText("Understanding perceptrons and convolutional layers.")).toBeInTheDocument();
    expect(searchDialog).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Neural Networks for Computer Vision/i }));

    await waitFor(() => {
      expect(screen.getByTestId("location-probe")).toHaveTextContent("/academy/neural-networks-basics?view=full");
    });
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Search documentation" }));
    expect(await screen.findByRole("heading", { name: "Neural Networks for Computer Vision" })).toBeInTheDocument();
  });

  it("submits helpful reader feedback to Firestore docs_feedback collection", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "member-user" },
      authorizedUser: { role: "member" },
    });
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);
    vi.mocked(fetchPublicDocument).mockResolvedValue(mockDocsList[0]);

    vi.mocked(addDoc).mockResolvedValue({ id: "feedback-1" } as unknown as Awaited<ReturnType<typeof addDoc>>);

    render(
      <MemoryRouter initialEntries={["/academy/ai-101-intro"]}>
        <Routes>
          <Route path="/academy/:slug" element={<AcademyPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Introduction to Artificial Intelligence" });

    const yesButton = screen.getByRole("button", { name: /Yes, it was/i });
    fireEvent.click(yesButton);

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slug: "ai-101-intro",
          isHelpful: 1,
        })
      );
    });

    expect(await screen.findByText("Thanks for your feedback!")).toBeInTheDocument();
  });

  it("submits detailed constructive feedback through the modal dialog", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "member-user" },
      authorizedUser: { role: "member" },
    });
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);
    vi.mocked(fetchPublicDocument).mockResolvedValue(mockDocsList[0]);

    vi.mocked(addDoc).mockResolvedValue({ id: "feedback-2" } as unknown as Awaited<ReturnType<typeof addDoc>>);

    render(
      <MemoryRouter initialEntries={["/academy/ai-101-intro"]}>
        <Routes>
          <Route path="/academy/:slug" element={<AcademyPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Introduction to Artificial Intelligence" });

    const noButton = screen.getByRole("button", { name: /No, it wasn't/i });
    fireEvent.click(noButton);

    expect(screen.getByRole("dialog", { name: "How can we improve this page?" })).toBeInTheDocument();

    const textarea = screen.getByLabelText("Feedback");
    fireEvent.change(textarea, { target: { value: "Please add more code examples for autonomous pathing." } });

    const submitBtn = screen.getByRole("button", { name: "Send Feedback" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slug: "ai-101-intro",
          isHelpful: 0,
          comment: "Please add more code examples for autonomous pathing.",
        })
      );
    });

    expect(await screen.findByText("Thank you! We will use your feedback to improve this page.")).toBeInTheDocument();
  });

  it("renders 404 state when the requested lesson slug does not exist", async () => {
    vi.mocked(fetchPublicDocuments).mockResolvedValue(mockDocsList);
    vi.mocked(fetchPublicDocument).mockRejectedValue(
      new PublicContentApiError(404, "Published document not found."),
    );

    render(
      <MemoryRouter initialEntries={["/academy/non-existent-lesson"]}>
        <Routes>
          <Route path="/academy/:slug" element={<AcademyPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Lesson not found" })).toBeInTheDocument();
  });
});
