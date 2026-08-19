import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcademyPage from "../app/academy/page";
import { addDoc, getDoc, getDocs } from "firebase/firestore";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/EducationalCredentialSchema", () => ({
  default: () => null,
  ARES_CREDENTIALS: [],
}));
vi.mock("@/components/ZulipThread", () => ({ default: () => null }));
vi.mock("@/lib/firebaseFirestore", () => ({ db: {} }));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  useOptionalAuth: () => undefined,
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ id: path, path })),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, path: string, id: string) => ({ id, path: `${path}/${id}` })),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  or: vi.fn(),
  and: vi.fn(),
  limit: vi.fn(),
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
    slug: "ai-101-intro",
    title: "Introduction to Artificial Intelligence",
    category: "AI 101",
    description: "Foundational concepts of artificial intelligence in FTC robotics.",
    content: "# Intro to AI\n\nArtificial intelligence powers modern autonomous navigation.",
    displayInMathCorner: 1,
    displayInScienceCorner: 0,
    status: "published",
    isDeleted: 0,
    original_authorNickname: "AlphaCoder",
    updatedAt: "2026-08-10T12:00:00Z",
  },
  {
    slug: "neural-networks-basics",
    title: "Neural Networks for Computer Vision",
    category: "Neural Networks",
    description: "Understanding perceptrons and convolutional layers.",
    content: "# Neural Networks\n\nConvolutional filters extract spatial features from camera frames.",
    displayInMathCorner: 0,
    displayInScienceCorner: 1,
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

  it("loads doc list and displays the active lesson with author lifecycle and navigation links", async () => {
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: mockDocsList.map((docItem) => ({
          id: docItem.slug,
          data: () => docItem,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    vi.mocked(getDoc).mockImplementation(async () => {
      return {
        exists: () => true,
        id: mockDocsList[0].slug,
        data: () => mockDocsList[0],
      } as unknown as Awaited<ReturnType<typeof getDoc>>;
    });

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

    // Next navigation button to neural networks lesson
    expect(screen.getByRole("link", { name: /Next.*Neural Networks for Computer Vision/i })).toHaveAttribute(
      "href",
      "/academy/neural-networks-basics"
    );
  });

  it("allows searching documents with quick search modal and navigating to selected lesson", async () => {
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: mockDocsList.map((docItem) => ({
          id: docItem.slug,
          data: () => docItem,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    vi.mocked(getDoc).mockImplementation(async (reference) => {
      const requested = mockDocsList.find((item) => item.slug === (reference as { id?: string }).id) ?? mockDocsList[0];
      return {
        exists: () => true,
        id: requested.slug,
        data: () => requested,
      } as unknown as Awaited<ReturnType<typeof getDoc>>;
    });

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
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: mockDocsList.map((docItem) => ({
          id: docItem.slug,
          data: () => docItem,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    vi.mocked(getDoc).mockImplementation(async () => {
      return {
        exists: () => true,
        id: mockDocsList[0].slug,
        data: () => mockDocsList[0],
      } as unknown as Awaited<ReturnType<typeof getDoc>>;
    });

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
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: mockDocsList.map((docItem) => ({
          id: docItem.slug,
          data: () => docItem,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    vi.mocked(getDoc).mockImplementation(async () => {
      return {
        exists: () => true,
        id: mockDocsList[0].slug,
        data: () => mockDocsList[0],
      } as unknown as Awaited<ReturnType<typeof getDoc>>;
    });

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
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: mockDocsList.map((docItem) => ({
          id: docItem.slug,
          data: () => docItem,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    vi.mocked(getDoc).mockImplementation(async () => {
      return {
        exists: () => false,
      } as unknown as Awaited<ReturnType<typeof getDoc>>;
    });

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
