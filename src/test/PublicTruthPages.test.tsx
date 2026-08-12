import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AboutPage from "../app/about/page";
import GalleryPage from "../app/gallery/page";
import LeaderboardPage from "../app/leaderboard/page";
import OutreachPage from "../app/outreach/page";
import SponsorsPage from "../app/sponsors/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderPage(page: React.ReactElement) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe("public truth and reliability pages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("publishes no fabricated leaderboard identities or ranks", () => {
    renderPage(<LeaderboardPage />);

    expect(screen.getByRole("heading", { name: "No standings are published" })).toBeInTheDocument();
    expect(screen.getByText(/removed placeholder names, avatars, badge totals, and ranks/i)).toBeInTheDocument();
    expect(screen.queryByText(/badges$/i)).not.toBeInTheDocument();
  });

  it("marks missing gallery metadata instead of inventing it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      photos: [{ id: "internal-photo-id", publicUrl: "https://images.example.org/drive-practice.jpg" }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderPage(<GalleryPage />);

    expect(await screen.findByRole("heading", { name: "Title not provided" })).toBeInTheDocument();
    expect(screen.getByText("Description not provided")).toBeInTheDocument();
    expect(screen.getByText("Location not provided")).toBeInTheDocument();
    expect(screen.getByText("Date not provided")).toBeInTheDocument();
    expect(screen.queryByText("MARS Laboratory")).not.toBeInTheDocument();
    expect(screen.queryByText(/Google Photos synced/i)).not.toBeInTheDocument();
    expect(screen.queryByText("internal-photo-id")).not.toBeInTheDocument();
    const cardImage = screen.getByRole("img", { name: /Published team photo; description not provided/i });
    expect(cardImage).toHaveAttribute("loading", "lazy");
    expect(cardImage).toHaveAttribute("decoding", "async");
    expect(cardImage).toHaveAttribute("fetchpriority", "low");
    expect(cardImage).toHaveAttribute("width", "4");
    expect(cardImage).toHaveAttribute("height", "3");
  });

  it("keeps the last gallery data visible when refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ photos: [{ id: "photo-1", caption: "Verified build photo", publicUrl: "https://images.example.org/build.jpg" }] }))
      .mockResolvedValueOnce(jsonResponse({}, 503, "Service Unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<GalleryPage />);

    expect(await screen.findByRole("heading", { name: "Verified build photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh photos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.getByRole("heading", { name: "Verified build photo" })).toBeInTheDocument();
  });

  it("loads the next bounded gallery page with the server cursor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        photos: [{ id: "photo-1", caption: "First page", publicUrl: "https://images.example.org/first.jpg" }],
        hasMore: true,
        nextCursor: "cursor/with spaces",
      }))
      .mockResolvedValueOnce(jsonResponse({
        photos: [{ id: "photo-2", caption: "Second page", publicUrl: "https://images.example.org/second.jpg" }],
        hasMore: false,
        nextCursor: null,
      }));
    vi.stubGlobal("fetch", fetchMock);

    renderPage(<GalleryPage />);
    fireEvent.click(await screen.findByRole("button", { name: /load more photos/i }));

    expect(await screen.findByText("Second page")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/photos/public?limit=30&cursor=cursor%2Fwith%20spaces");
    expect(screen.getByText("First page")).toBeInTheDocument();
  });

  it("loads sponsors from the public API and preserves them after a failed refresh", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ sponsors: [{ id: "private-sponsor-id", name: "Mountain Tools", tier: "Gold", websiteUrl: "https://example.org" }] }))
      .mockResolvedValueOnce(jsonResponse({}, 502, "Bad Gateway"));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<SponsorsPage />);

    expect(await screen.findByText("Mountain Tools")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/sponsors");
    expect(screen.queryByText("private-sponsor-id")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh partners" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 502");
    expect(screen.getByText("Mountain Tools")).toBeInTheDocument();
  });

  it("keeps verified outreach records and reports refresh failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ logs: [{ id: "internal-log-id", title: "Library robot demo", hours: 4, peopleReached: 35 }] }))
      .mockResolvedValueOnce(jsonResponse({}, 429, "Too Many Requests"));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<OutreachPage />);

    expect(await screen.findByRole("heading", { name: "Library robot demo" })).toBeInTheDocument();
    expect(screen.getByText("Location not provided")).toBeInTheDocument();
    expect(screen.getByText("Date not provided")).toBeInTheDocument();
    expect(screen.queryByText("internal-log-id")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh records" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 429");
    expect(screen.getByRole("heading", { name: "Library robot demo" })).toBeInTheDocument();
  });

  it("opens and closes the labeled STEM demo request dialog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ logs: [] })));
    renderPage(<OutreachPage />);

    await screen.findByRole("heading", { name: /No outreach events are published yet/i });
    fireEvent.click(screen.getByRole("button", { name: /Request a STEM Demo/i }));

    expect(screen.getByRole("dialog", { name: /Request a STEM Demo/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Your Name *")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address *")).toBeInTheDocument();
    expect(screen.getByLabelText("Details & Dates *")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the youth-safe nickname fallback and ignores student PII", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        members: [{
          userId: "internal-user-id",
          memberType: "student",
          fullName: "Private Legal Name",
          email: "student@example.org",
          colleges: ["Private School"],
          bio: "Build team member",
          subteams: ["Programming"],
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({}, 503, "Service Unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<AboutPage />);

    expect(await screen.findByRole("heading", { name: "ARES Member" })).toBeInTheDocument();
    expect(screen.queryByText("Private Legal Name")).not.toBeInTheDocument();
    expect(screen.queryByText("student@example.org")).not.toBeInTheDocument();
    expect(screen.queryByText("Private School")).not.toBeInTheDocument();
    expect(screen.queryByText("internal-user-id")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh roster" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503"));
    expect(screen.getByRole("heading", { name: "ARES Member" })).toBeInTheDocument();
  });
});
