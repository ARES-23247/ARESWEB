import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPublicEvent: vi.fn(),
  fetchLocations: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null, authorizedUser: null }),
  useOptionalAuth: () => undefined,
}));
vi.mock("@/app/calendar/api", () => ({
  fetchPublicEvent: mocks.fetchPublicEvent,
  fetchLocations: mocks.fetchLocations,
}));
vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/ShareButtons", () => ({ default: () => null }));
vi.mock("@/components/events/EventHero", () => ({
  default: () => <div>Event hero</div>,
}));
vi.mock("@/components/events/EventDescription", () => ({
  default: () => null,
}));
vi.mock("@/components/events/EventZulipLink", () => ({ default: () => null }));
vi.mock("@/components/events/EventRsvps", () => ({ default: () => null }));
vi.mock("@/components/events/EventVenueInfo", () => ({ default: () => null }));
vi.mock("@/components/events/PhotoLightbox", () => ({ default: () => null }));
vi.mock("@/app/dashboard/events/page", () => ({ default: () => null }));

import EventDetailPage from "../app/events/[id]/page";

function jsonResponse(payload: unknown, status = 200, statusText = "OK") {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage(initialEntry = "/events/practice-1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("public event photo privacy and failure states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPublicEvent.mockResolvedValue({
      id: "practice-1",
      title: "Drive Practice",
      dateStart: "2026-08-20T18:00:00.000Z",
      category: "internal",
    });
    mocks.fetchLocations.mockResolvedValue([]);
  });

  it("uses the bounded public DTO and retains safe photos after refresh failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          photos: [
            {
              id: "photo-1",
              url: "https://images.example.test/practice.jpg",
              filename: "Drive practice.jpg",
              uploadedBy: "private-student-id",
              uploadedAt: "2026-08-10T12:00:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, 503, "Service Unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    const photoButton = await screen.findByRole("button", {
      name: "Open event photo: Drive practice.jpg",
    });
    expect(photoButton).toBeInTheDocument();
    expect(screen.queryByText(/private-student-id/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/calendar/events/practice-1/photos?limit=50",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh event photos" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503: Service Unavailable");
    expect(photoButton).toBeInTheDocument();
  });

  it("does not present a failed initial request as an empty successful gallery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 502, "Bad Gateway")));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 502: Bad Gateway");
    expect(screen.queryByText("No photos have been uploaded for this event.")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading event photos…")).not.toBeInTheDocument());
  });

  it("loads a recurring instance while keeping media on the parent event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ photos: [] })));

    renderPage("/events/practice-1?occurrence=2026-08-20");

    await waitFor(() => {
      expect(mocks.fetchPublicEvent).toHaveBeenCalledWith("practice-1", "2026-08-20");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/calendar/events/practice-1/photos?limit=50&occurrence=2026-08-20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
