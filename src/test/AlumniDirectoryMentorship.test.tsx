import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AlumniDirectoryPage from "@/app/community/alumni/page";
import {
  ALUMNI_DIRECTORY,
  INDUSTRY_CATEGORIES,
  filterAlumni,
  getUniqueUniversities,
  getIndustryCounts,
  validateZeroYouthPii,
  type AlumniProfile,
} from "@/lib/alumniDirectoryData";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { getRecaptchaToken } from "@/lib/recaptcha";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/recaptcha", () => ({
  getRecaptchaToken: vi.fn(),
}));
vi.mock("@/lib/firebaseAppCheck", () => ({
  getAppCheckHeader: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("Alumni Directory Helper & Model Unit Tests", () => {
  it("filters alumni correctly by industry category", () => {
    const aeroOnly = filterAlumni(ALUMNI_DIRECTORY, { industry: "Aerospace" });
    expect(aeroOnly.length).toBeGreaterThan(0);
    expect(aeroOnly.every((a) => a.industry === "Aerospace")).toBe(true);

    const autoOnly = filterAlumni(ALUMNI_DIRECTORY, { industry: "Autonomous Robotics" });
    expect(autoOnly.length).toBeGreaterThan(0);
    expect(autoOnly.every((a) => a.industry === "Autonomous Robotics")).toBe(true);

    const bioOnly = filterAlumni(ALUMNI_DIRECTORY, { industry: "Biomedical" });
    expect(bioOnly.length).toBeGreaterThan(0);
    expect(bioOnly.every((a) => a.industry === "Biomedical")).toBe(true);
  });

  it("filters alumni correctly by text search query across fields", () => {
    const nasaSearch = filterAlumni(ALUMNI_DIRECTORY, { searchQuery: "NASA" });
    expect(nasaSearch.length).toBeGreaterThan(0);
    expect(nasaSearch.some((a) => a.company.includes("NASA"))).toBe(true);

    const mitSearch = filterAlumni(ALUMNI_DIRECTORY, { searchQuery: "MIT" });
    expect(mitSearch.length).toBeGreaterThan(0);
    expect(mitSearch.some((a) => a.university.includes("MIT"))).toBe(true);

    const teslaSearch = filterAlumni(ALUMNI_DIRECTORY, { searchQuery: "Tesla" });
    expect(teslaSearch.length).toBeGreaterThan(0);
    expect(teslaSearch.some((a) => a.company.includes("Tesla"))).toBe(true);

    const nonExistent = filterAlumni(ALUMNI_DIRECTORY, { searchQuery: "NonExistentQueryXYZ123" });
    expect(nonExistent.length).toBe(0);
  });

  it("filters alumni correctly by university and topic criteria", () => {
    const cmuAlums = filterAlumni(ALUMNI_DIRECTORY, { university: "Carnegie Mellon" });
    expect(cmuAlums.length).toBeGreaterThan(0);
    expect(cmuAlums.every((a) => a.university.includes("Carnegie Mellon"))).toBe(true);

    const cadMentors = filterAlumni(ALUMNI_DIRECTORY, { topic: "CAD Mentoring" });
    expect(cadMentors.length).toBeGreaterThan(0);
    expect(cadMentors.every((a) => a.availableTopics.includes("CAD Mentoring"))).toBe(true);
  });

  it("returns all unique universities and accurate industry counts", () => {
    const universities = getUniqueUniversities(ALUMNI_DIRECTORY);
    expect(universities.length).toBeGreaterThan(3);
    expect(universities).toContain("Massachusetts Institute of Technology (MIT)");
    expect(universities).toContain("Carnegie Mellon University (CMU)");

    const counts = getIndustryCounts(ALUMNI_DIRECTORY);
    expect(counts.all).toBe(ALUMNI_DIRECTORY.length);
    for (const cat of INDUSTRY_CATEGORIES) {
      expect(counts[cat]).toBeGreaterThanOrEqual(1);
    }
  });

  it("enforces Strict Zero Youth PII compliance across all public profiles", () => {
    expect(validateZeroYouthPii(ALUMNI_DIRECTORY)).toBe(true);

    // Should fail if a non-adult profile is introduced
    const fakeYouthProfile: AlumniProfile = {
      ...ALUMNI_DIRECTORY[0],
      id: "fake-youth",
      // @ts-expect-error test non-adult failure
      isAdultAlum: false,
    };
    expect(validateZeroYouthPii([fakeYouthProfile])).toBe(false);

    // Should fail if raw email is found in profile fields
    const fakePiiProfile: AlumniProfile = {
      ...ALUMNI_DIRECTORY[0],
      id: "fake-pii",
      bio: "Contact me at personal.email@gmail.com for mentoring.",
    };
    expect(validateZeroYouthPii([fakePiiProfile])).toBe(false);

    // Should fail if phone number is found in profile fields
    const fakePhoneProfile: AlumniProfile = {
      ...ALUMNI_DIRECTORY[0],
      id: "fake-phone",
      bio: "Call me at 304-555-0199 anytime.",
    };
    expect(validateZeroYouthPii([fakePhoneProfile])).toBe(false);
  });
});
describe("Alumni Directory Page UI & Interactive Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecaptchaToken).mockResolvedValue("mock-recaptcha-token");
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" });
  });

  it("renders hero section, stats banner, and directory catalog", () => {
    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /Alumni Network & Mentorship/i })).toBeInTheDocument();
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(screen.getByText(/STEM College Matriculation/i)).toBeInTheDocument();
    expect(screen.getByText(/Top Research Institutions/i)).toBeInTheDocument();

    // Verify key alumni cards rendered
    expect(screen.getByText("Elena Vance")).toBeInTheDocument();
    expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
    expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();
  });

  it("filters alumni cards when searching by keyword", () => {
    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search alumni by name/i);
    fireEvent.change(searchInput, { target: { value: "Tesla" } });

    expect(screen.getByText("Elena Vance")).toBeInTheDocument();
    expect(screen.queryByText("Sarah Jenkins")).not.toBeInTheDocument();
    expect(screen.queryByText("Marcus Chen")).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
    expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
  });

  it("filters alumni cards when clicking industry filter chips", () => {
    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    // Click Aerospace chip
    const aeroButton = screen.getByRole("button", { name: /Aerospace \(/i });
    fireEvent.click(aeroButton);

    expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
    expect(screen.queryByText("Elena Vance")).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByRole("button", { name: /Reset Filters/i });
    fireEvent.click(resetButton);

    expect(screen.getByText("Elena Vance")).toBeInTheDocument();
    expect(screen.getByText("Marcus Chen")).toBeInTheDocument();
  });

  it("shows empty state when no alumni match search query and allows reset", () => {
    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(/Search alumni by name/i);
    fireEvent.change(searchInput, { target: { value: "ZebraUnknownRobot999" } });

    expect(screen.getByText(/No Alumni Match Your Current Filters/i)).toBeInTheDocument();
    expect(screen.queryByText("Elena Vance")).not.toBeInTheDocument();

    const resetAllBtn = screen.getByRole("button", { name: /Reset All Filters/i });
    fireEvent.click(resetAllBtn);

    expect(screen.getByText("Elena Vance")).toBeInTheDocument();
  });
});
describe("Mentorship Connection Request Modal & Security Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRecaptchaToken).mockResolvedValue("mock-recaptcha-token");
    vi.mocked(getAppCheckHeader).mockResolvedValue({ "X-Firebase-AppCheck": "mock-appcheck-token" });
  });

  it("opens modal, validates student input, and submits coaching request successfully", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, message: "Application submitted successfully." })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    // Open modal from hero action
    const openModalBtn = screen.getByRole("button", { name: /Request Mentorship Session/i });
    fireEvent.click(openModalBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Request Mentorship Session/i })).toBeInTheDocument();

    // Fill student form
    fireEvent.change(screen.getByLabelText(/Student Full Name \*/i), {
      target: { value: "Jordan Student" },
    });
    fireEvent.change(screen.getByLabelText(/Student \/ Parent Email Address \*/i), {
      target: { value: "jordan@example.edu" },
    });
    fireEvent.change(screen.getByLabelText(/Current School \/ Organization \*/i), {
      target: { value: "Morgantown High School" },
    });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), {
      target: { value: "11" },
    });
    fireEvent.change(screen.getByLabelText(/What would you like guidance on\? \*/i), {
      target: { value: "Need advice on CAD modeling of custom swerve drives and MIT admissions." },
    });

    // Toggle a topic
    fireEvent.click(screen.getByRole("button", { name: /College Prep/i }));

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Submit Mentorship Request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Coaching Request Received!/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inquiries",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Firebase-AppCheck": "mock-appcheck-token",
        }),
        body: expect.stringContaining("Jordan Student"),
      })
    );

    // Close modal via Done button
    const doneBtn = screen.getByRole("button", { name: /Done/i });
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("pre-selects specific alumnus when 'Book Coaching' is clicked on their card", () => {
    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    // Click book coaching on first card
    const bookButtons = screen.getAllByRole("button", { name: /Book Coaching/i });
    expect(bookButtons.length).toBeGreaterThan(0);
    fireEvent.click(bookButtons[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const select = screen.getByLabelText(/Preferred Alumnus Mentor/i) as HTMLSelectElement;
    expect(select.value).not.toBe("general");
  });

  it("displays server error message when API fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, error: "Spam check verification failed. Please try again." }, 400, "Bad Request")
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <AlumniDirectoryPage />
      </MemoryRouter>
    );

    const openModalBtn = screen.getByRole("button", { name: /Request Mentorship Session/i });
    fireEvent.click(openModalBtn);

    fireEvent.change(screen.getByLabelText(/Student Full Name \*/i), {
      target: { value: "Sam Tech" },
    });
    fireEvent.change(screen.getByLabelText(/Student \/ Parent Email Address \*/i), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Current School \/ Organization \*/i), {
      target: { value: "University High" },
    });
    fireEvent.change(screen.getByLabelText(/Current Grade \*/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/What would you like guidance on\? \*/i), {
      target: { value: "Questions about autonomous vision." },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Mentorship Request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Spam check verification failed/i)).toBeInTheDocument();
    });
  });
});
