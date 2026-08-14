import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcademyLibraryPage from "@/app/academy/library/page";
import {
  STEM_RESOURCES,
  filterStemResources,
  formatCitation,
  getCategoryStats,
  getFormatStats,
  getDifficultyStats,
  type StemResource,
} from "@/lib/stemLibraryData";

vi.mock("@/components/SEO", () => ({ default: () => null }));

describe("STEM & Robotics Resource Library Component & Filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders catalog hero, search bar, category chips, and resource cards", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /STEM & Robotics Resource Library/i, level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by title, author, topic tags/i)).toBeInTheDocument();

    // Check category filter chips
    expect(screen.getByRole("button", { name: /All Disciplines/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Controls & Math/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mechanical Design/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Software Architecture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vision & Sensors/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Team Operations/i })).toBeInTheDocument();

    // Verify presence of sample whitepapers
    expect(
      screen.getByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /FTC Drivetrain Master Modeling & Top-Down CAD in Onshape/i })
    ).toBeInTheDocument();
  });

  it("filters resources by category when category chip is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const controlsButton = screen.getByRole("button", { name: /Controls & Math/i });
    fireEvent.click(controlsButton);

    expect(
      screen.getByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /FIRST Tech Challenge Engineering Portfolio Blueprint/i })
    ).not.toBeInTheDocument();

    // Switch to Team Operations
    const opsButton = screen.getByRole("button", { name: /Team Operations/i });
    fireEvent.click(opsButton);

    expect(
      screen.getByRole("heading", { name: /FIRST Tech Challenge Engineering Portfolio Blueprint/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).not.toBeInTheDocument();

    // Reset to All Disciplines
    const allButton = screen.getByRole("button", { name: /All Disciplines/i });
    fireEvent.click(allButton);

    expect(
      screen.getByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /FIRST Tech Challenge Engineering Portfolio Blueprint/i })
    ).toBeInTheDocument();
  });

  it("filters resources by format (Whitepaper, Guide, Interactive Tutorial, Video)", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const videoButton = screen.getByRole("button", { name: "Video" });
    fireEvent.click(videoButton);

    expect(
      screen.getByRole("heading", { name: /High-FPS Multi-Camera Vision Setup & Limelight\/PhotonVision Masterclass/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).not.toBeInTheDocument();
  });

  it("filters resources by difficulty level (Novice, Intermediate, Advanced)", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const advancedButton = screen.getByRole("button", { name: "Advanced" });
    fireEvent.click(advancedButton);

    expect(
      screen.getByRole("heading", { name: /Extended Kalman Filtering & State-Space Fusion for FTC Localization/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes/i })
    ).not.toBeInTheDocument();
  });
  it("filters resources in real-time by search query (title, author, tags, reading duration)", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by title, author, topic tags/i);

    // Search by title substring
    fireEvent.change(searchInput, { target: { value: "AprilTag" } });
    expect(
      screen.getByRole("heading", { name: /Real-Time AprilTag 3D Pose Estimation & Camera Calibration/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Feedforward & Motion Profiling/i })
    ).not.toBeInTheDocument();

    // Search by author name
    fireEvent.change(searchInput, { target: { value: "Samantha Chen" } });
    expect(
      screen.getByRole("heading", { name: /FIRST Tech Challenge Engineering Portfolio Blueprint/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Real-Time AprilTag/i })
    ).not.toBeInTheDocument();

    // Search by topic tag
    fireEvent.change(searchInput, { target: { value: "Coroutines" } });
    expect(
      screen.getByRole("heading", { name: /Reactive Subsystem Architecture & Coroutines in FTC Kotlin/i })
    ).toBeInTheDocument();

    // Search by reading duration filter (e.g. "< 15 min")
    fireEvent.change(searchInput, { target: { value: "< 13 min" } });
    expect(
      screen.getByRole("heading", { name: /Hybrid Manufacturing: 3D Printing & Laser-Cut Polycarbonate Intakes/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Extended Kalman Filtering/i })
    ).not.toBeInTheDocument();

    // Clear search
    const clearButton = screen.getByRole("button", { name: /Clear search input/i });
    fireEvent.click(clearButton);
    expect(
      screen.getByRole("heading", { name: /Feedforward & Motion Profiling/i })
    ).toBeInTheDocument();
  });

  it("filters by tag when clicking a tag button in a resource card", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const onshapeTagButton = screen.getByRole("button", { name: /Filter by tag Onshape/i });
    fireEvent.click(onshapeTagButton);

    expect(
      screen.getByRole("heading", { name: /FTC Drivetrain Master Modeling & Top-Down CAD in Onshape/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Extended Kalman Filtering/i })
    ).not.toBeInTheDocument();

    // Remove tag filter via indicator
    const removeTagButton = screen.getByRole("button", { name: /Remove tag filter Onshape/i });
    fireEvent.click(removeTagButton);

    expect(
      screen.getByRole("heading", { name: /Extended Kalman Filtering/i })
    ).toBeInTheDocument();
  });

  it("sorts resources by criteria (Fastest Read, Alphabetical, Newest)", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const sortSelect = screen.getByLabelText(/Sort:/i);
    fireEvent.change(sortSelect, { target: { value: "alphabetical" } });

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0].textContent).toMatch(/Color-Space Pipeline Optimization|Command-Based Robotics Patterns|Community STEM Outreach/i);
  });

  it("shows empty state and allows resetting when query matches no resources", () => {
    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search by title, author, topic tags/i);
    fireEvent.change(searchInput, { target: { value: "NonExistentZzZQuery99" } });

    expect(screen.getByRole("heading", { name: /No Matching Resources Found/i })).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /Reset All Filters/i });
    fireEvent.click(resetButton);

    expect(
      screen.getByRole("heading", { name: /Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i })
    ).toBeInTheDocument();
  });
  it("opens citation modal, allows switching citation formats, and copies citation to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const citeButton = screen.getByRole("button", {
      name: /Cite Feedforward & Motion Profiling for Holonomic FTC Drivetrains/i,
    });
    fireEvent.click(citeButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Cite This Resource/i })).toBeInTheDocument();

    // Default is IEEE format
    const apaButton = screen.getByRole("button", { name: "apa" });
    fireEvent.click(apaButton);
    expect(screen.getByText(/Vance, E., Sterling, M./i)).toBeInTheDocument();

    // Switch to BibTeX
    const bibtexButton = screen.getByRole("button", { name: "bibtex" });
    fireEvent.click(bibtexButton);
    expect(screen.getByText(/@article{vance2025holonomic/i)).toBeInTheDocument();

    // Click Copy Citation
    const copyButton = screen.getByRole("button", { name: /Copy Citation/i });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining("@article{vance2025holonomic"));
    expect(await screen.findByText(/Copied to Clipboard!/i)).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole("button", { name: /Close citation modal/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("verifies strict security attributes on all external and download links", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/academy/library"]}>
        <Routes>
          <Route path="/academy/library" element={<AcademyLibraryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const externalLinks = container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
    expect(externalLinks.length).toBeGreaterThan(0);

    for (const link of externalLinks) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("href")).not.toContain("javascript:");
      expect(link.getAttribute("href")).not.toContain("data:");
      // Ensure no tracking query params
      expect(link.getAttribute("href")).not.toMatch(/utm_|fbclid|gclid/i);
    }
  });
});
describe("STEM Library Data Helper Functions", () => {
  const sampleResource: StemResource = {
    id: "sample-control-paper",
    title: "Test Feedforward Paper",
    authors: ["Jane Doe", "John Smith"],
    publishedYear: 2025,
    category: "Controls & Math",
    format: "Whitepaper",
    difficulty: "Advanced",
    readingTimeMinutes: 20,
    summary: "A test summary for control loops.",
    description: "Full description of sample control paper.",
    tags: ["PID", "Testing"],
    externalUrl: "https://github.com/ARES-23247/ARESLib",
    downloadUrl: "https://github.com/ARES-23247/ARESLib/raw/master/paper.pdf",
    citation: {
      ieee: "J. Doe and J. Smith, Test Feedforward Paper, 2025.",
      apa: "Doe, J., & Smith, J. (2025). Test Feedforward Paper.",
      bibtex: "@article{doe2025test, title={Test Feedforward Paper}}",
    },
  };

  it("formats citations correctly with pre-provided citations and fallback generation", () => {
    expect(formatCitation(sampleResource, "ieee")).toBe(sampleResource.citation.ieee);
    expect(formatCitation(sampleResource, "apa")).toBe(sampleResource.citation.apa);
    expect(formatCitation(sampleResource, "bibtex")).toBe(sampleResource.citation.bibtex);

    // Resource with empty citation object to trigger generator fallback
    const fallbackResource: StemResource = {
      ...sampleResource,
      citation: { ieee: "", apa: "", bibtex: "" },
    };

    expect(formatCitation(fallbackResource, "ieee")).toContain("Jane Doe, John Smith, \"Test Feedforward Paper,\"");
    expect(formatCitation(fallbackResource, "apa")).toContain("Jane Doe, & John Smith (2025). Test Feedforward Paper.");
    expect(formatCitation(fallbackResource, "bibtex")).toContain("@article{smith2025samplecont");
  });

  it("filters and sorts resources with diverse filter combinations", () => {
    // Default filter
    const all = filterStemResources({ resources: [sampleResource] });
    expect(all).toHaveLength(1);

    // Category filter
    expect(
      filterStemResources({
        resources: [sampleResource],
        category: "Mechanical Design",
      })
    ).toHaveLength(0);

    expect(
      filterStemResources({
        resources: [sampleResource],
        category: "Controls & Math",
      })
    ).toHaveLength(1);

    // Format filter
    expect(
      filterStemResources({
        resources: [sampleResource],
        format: "Video",
      })
    ).toHaveLength(0);

    // Difficulty filter
    expect(
      filterStemResources({
        resources: [sampleResource],
        difficulty: "Novice",
      })
    ).toHaveLength(0);

    // Tag filter
    expect(
      filterStemResources({
        resources: [sampleResource],
        tag: "PID",
      })
    ).toHaveLength(1);
    expect(
      filterStemResources({
        resources: [sampleResource],
        tag: "UnknownTag",
      })
    ).toHaveLength(0);

    // Search filter across fields
    expect(
      filterStemResources({
        resources: [sampleResource],
        search: "Jane Doe",
      })
    ).toHaveLength(1);

    expect(
      filterStemResources({
        resources: [sampleResource],
        search: "2025",
      })
    ).toHaveLength(1);

    expect(
      filterStemResources({
        resources: [sampleResource],
        search: "20 min",
      })
    ).toHaveLength(1);

    expect(
      filterStemResources({
        resources: [sampleResource],
        search: "Nonexistent",
      })
    ).toHaveLength(0);

    // Sort by options
    const resourceA: StemResource = { ...sampleResource, id: "a", title: "Alpha", publishedYear: 2024, readingTimeMinutes: 30 };
    const resourceB: StemResource = { ...sampleResource, id: "b", title: "Beta", publishedYear: 2026, readingTimeMinutes: 10 };

    const sortedNewest = filterStemResources({ resources: [resourceA, resourceB], sortBy: "newest" });
    expect(sortedNewest[0].id).toBe("b");

    const sortedReadingTime = filterStemResources({ resources: [resourceA, resourceB], sortBy: "readingTime" });
    expect(sortedReadingTime[0].id).toBe("b");

    const sortedAlpha = filterStemResources({ resources: [resourceB, resourceA], sortBy: "alphabetical" });
    expect(sortedAlpha[0].id).toBe("a");
  });

  it("calculates category, format, and difficulty frequency statistics", () => {
    const catStats = getCategoryStats(STEM_RESOURCES);
    expect(catStats["Controls & Math"]).toBeGreaterThan(0);
    expect(catStats["Mechanical Design"]).toBeGreaterThan(0);
    expect(catStats["Software Architecture"]).toBeGreaterThan(0);
    expect(catStats["Vision & Sensors"]).toBeGreaterThan(0);
    expect(catStats["Team Operations"]).toBeGreaterThan(0);

    const fmtStats = getFormatStats(STEM_RESOURCES);
    expect(fmtStats.Whitepaper).toBeGreaterThan(0);
    expect(fmtStats.Guide).toBeGreaterThan(0);
    expect(fmtStats["Interactive Tutorial"]).toBeGreaterThan(0);
    expect(fmtStats.Video).toBeGreaterThan(0);

    const diffStats = getDifficultyStats(STEM_RESOURCES);
    expect(diffStats.Novice).toBeGreaterThan(0);
    expect(diffStats.Intermediate).toBeGreaterThan(0);
    expect(diffStats.Advanced).toBeGreaterThan(0);
  });
});
