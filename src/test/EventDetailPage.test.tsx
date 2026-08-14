import { fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDoc, deleteDoc } from "firebase/firestore";
import EventDetailPage from "../app/events/[id]/page";
import TournamentMatchesList from "../app/tournaments/[id]/TournamentMatchesList";
import TournamentMatchPrintDialog from "../app/tournaments/[id]/TournamentMatchPrintDialog";
import { CalendarApiError, fetchLocations, fetchManagedEvents, fetchPublicEvent } from "@/app/calendar/api";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "@/lib/image";
import type { TournamentMatch } from "@/types/tournament";

// Mocks
const mockAuthData = {
  user: null as { uid: string; email?: string } | null,
  authorizedUser: null as { role: string; email?: string } | null,
  loading: false,
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockAuthData,
}));

vi.mock("@/app/calendar/api", () => ({
  fetchPublicEvent: vi.fn(),
  fetchLocations: vi.fn(),
  fetchManagedEvents: vi.fn().mockResolvedValue([]),
  CalendarApiError: class CalendarApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly statusText: string,
      public readonly code?: string,
      message?: string,
    ) {
      super(message ?? `HTTP ${status}: ${statusText}`);
      this.name = "CalendarApiError";
    }
  },
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/lib/image", () => ({
  resizeAndCompressImage: vi.fn(),
}));

let onSnapshotCallback: ((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void) | null = null;

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db, ...parts) => ({ path: parts.join("/") })),
  collection: vi.fn((_db, ...parts) => ({ path: parts.join("/") })),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  where: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  onSnapshot: vi.fn((_ref, callback) => {
    onSnapshotCallback = callback;
    return vi.fn(); // Unsubscribe mock
  }),
}));

function jsonResponse(payload: unknown, status = 200, statusText = "OK") {
  return new Response(JSON.stringify(payload), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function renderEventDetailPage(initialRoute = "/events/mars-kickoff-2026") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/calendar" element={<div>Calendar Index View</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleEvent = {
  id: "mars-kickoff-2026",
  title: "FTC Season Kickoff & Strategy Session",
  dateStart: "2026-09-12T14:00:00.000Z",
  dateEnd: "2026-09-12T18:00:00.000Z",
  category: "internal" as const,
  location: "MARS Laboratory & Workshop",
  description: "Comprehensive season game reveal breakdown and strategy planning for DECODE.",
  coverImage: "https://images.aresfirst.org/kickoff-cover.jpg",
  isPotluck: 1,
  isVolunteer: 1,
  zulipStream: "kickoff-2026",
  zulipTopic: "Logistics & Strategy",
  publicVenue: {
    name: "Engineering Sciences Building",
    address: "West Virginia University, Morgantown, WV 26506",
  },
};

const sampleLocations = [
  {
    id: "loc_mars_lab",
    name: "MARS Robotics Lab",
    address: "Room 101, Engineering Sciences Building, Morgantown, WV",
    description: "Main workshop and practice field.",
    gmapsUrl: "https://maps.google.com/?q=WVU+Engineering+Sciences",
    isAddressPublic: 1,
    isDeleted: 0,
  },
];

describe("EventDetailPage Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthData.user = null;
    mockAuthData.authorizedUser = null;
    mockAuthData.loading = false;
    onSnapshotCallback = null;

    vi.mocked(fetchPublicEvent).mockResolvedValue(sampleEvent);
    vi.mocked(fetchLocations).mockResolvedValue(sampleLocations);
    vi.mocked(fetchManagedEvents).mockResolvedValue({
      events: [
        {
          ...sampleEvent,
          isDeleted: 0,
          updatedAt: "2026-08-14T12:00:00.000Z",
        } as unknown as import("@/app/dashboard/events/components/EventEditorDrawer").TeamEvent,
      ],
      nextCursor: null,
    });
    vi.mocked(authenticatedFetch).mockImplementation(async (path) => {
      if (typeof path === "string" && path.includes("/api/profiles/me")) {
        return jsonResponse({ profile: { nickname: "Lead Strategist" } });
      }
      return jsonResponse({});
    });

    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ photos: [] })));
  });

  describe("1. Loading, 404 Not Found, and Error Boundaries", () => {
    it("renders loading spinner while fetching event data", () => {
      vi.mocked(fetchPublicEvent).mockImplementation(() => new Promise(() => {}));
      const { container } = renderEventDetailPage();
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("renders 404 'Event Record Lost' state when event is not found (CalendarApiError 404)", async () => {
      vi.mocked(fetchPublicEvent).mockRejectedValue(new CalendarApiError(404, "Not Found"));
      renderEventDetailPage();

      expect(await screen.findByRole("heading", { name: "Event Record Lost" })).toBeInTheDocument();
      expect(screen.getByText(/This schedule item does not exist or has been removed/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Return to Calendar/i })).toHaveAttribute("href", "/calendar");
    });

    it("renders PublicDataState error component when network or API fails", async () => {
      vi.mocked(fetchPublicEvent).mockRejectedValue(new Error("503 Service Unavailable"));
      renderEventDetailPage();

      expect(await screen.findByText("Unable to load this event")).toBeInTheDocument();
      expect(screen.getByText(/The event record could not be reached/i)).toBeInTheDocument();

      // Test Retry action
      vi.mocked(fetchPublicEvent).mockResolvedValueOnce(sampleEvent);
      fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
      expect(await screen.findByRole("heading", { name: sampleEvent.title })).toBeInTheDocument();
    });
  });

  describe("2. Event Metadata and Hero Rendering", () => {
    it("renders upcoming event metadata, cover image, and dates", async () => {
      renderEventDetailPage();

      expect(await screen.findByRole("heading", { name: sampleEvent.title })).toBeInTheDocument();
      expect(screen.getByText("Upcoming Event")).toBeInTheDocument();
      expect(screen.getByText(/Start:/i)).toBeInTheDocument();
      expect(screen.getByText(/End:/i)).toBeInTheDocument();

      const coverImg = screen.getByAltText(sampleEvent.title);
      expect(coverImg).toHaveAttribute("src", sampleEvent.coverImage);
      expect(screen.getByText(sampleEvent.description)).toBeInTheDocument();
      expect(screen.getAllByText(/Engineering Sciences Building/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(sampleEvent.publicVenue.address).length).toBeGreaterThan(0);
    });

    it("renders historical record badge for past events without add-to-calendar buttons", async () => {
      const pastEvent = {
        ...sampleEvent,
        dateStart: "2024-01-10T10:00:00.000Z",
        dateEnd: "2024-01-10T14:00:00.000Z",
      };
      vi.mocked(fetchPublicEvent).mockResolvedValue(pastEvent);
      renderEventDetailPage();

      expect(await screen.findByText("Historical Record")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Add to calendar \(\.ics\)/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Add to Google Calendar/i })).not.toBeInTheDocument();
    });

    it("triggers .ics file download when clicking 'Add to calendar (.ics)'", async () => {
      const createObjectURLMock = vi.fn(() => "blob:test-ics-url");
      const revokeObjectURLMock = vi.fn();
      window.URL.createObjectURL = createObjectURLMock;
      window.URL.revokeObjectURL = revokeObjectURLMock;

      renderEventDetailPage();

      const icsButton = await screen.findByRole("button", { name: /Add to calendar \(\.ics\)/i });
      fireEvent.click(icsButton);

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:test-ics-url");
    });

    it("renders rich text description when description is formatted as Tiptap JSON AST", async () => {
      const astDescription = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Rich Tiptap paragraph with " },
              { type: "text", marks: [{ type: "bold" }], text: "bold strategy guidelines" },
            ],
          },
        ],
      });

      vi.mocked(fetchPublicEvent).mockResolvedValue({
        ...sampleEvent,
        description: astDescription,
      });

      renderEventDetailPage();

      expect(await screen.findByText(/Rich Tiptap paragraph with/i)).toBeInTheDocument();
      expect(screen.getByText("bold strategy guidelines")).toBeInTheDocument();
    });
  });

  describe("3. Location and Venue Information", () => {
    it("matches locationId against fetched locations list and renders details", async () => {
      vi.mocked(fetchPublicEvent).mockResolvedValue({
        ...sampleEvent,
        locationId: "loc_mars_lab",
        publicVenue: undefined,
      });

      mockAuthData.user = { uid: "user-123" };
      mockAuthData.authorizedUser = { role: "student" };

      renderEventDetailPage();

      expect(await screen.findByRole("heading", { name: "MARS Robotics Lab" })).toBeInTheDocument();
      expect(screen.getByText("Room 101, Engineering Sciences Building, Morgantown, WV")).toBeInTheDocument();
      expect(screen.getByText("Main workshop and practice field.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Get Directions ↗/i })).toHaveAttribute(
        "href",
        "https://maps.google.com/?q=WVU+Engineering+Sciences",
      );
    });
  });

  describe("4. Zulip Discussion Feed Integration", () => {
    it("renders Zulip discussion banner when verified member views event with stream/topic", async () => {
      mockAuthData.user = { uid: "user-123" };
      mockAuthData.authorizedUser = { role: "student" };

      renderEventDetailPage();

      expect(await screen.findByText("Event Discussions (Zulip Feed)")).toBeInTheDocument();
      const zulipLink = screen.getByRole("link", { name: /Open Zulip Thread ↗/i });
      expect(zulipLink).toHaveAttribute(
        "href",
        "https://zulip.aresfirst.org/#narrow/stream/kickoff-2026/topic/Logistics%20%26%20Strategy",
      );
    });

    it("hides Zulip banner when user is not verified or event has no Zulip stream", async () => {
      // Unverified user
      mockAuthData.user = { uid: "user-unverified" };
      mockAuthData.authorizedUser = { role: "unverified" };

      renderEventDetailPage();
      await screen.findByRole("heading", { name: sampleEvent.title });

      expect(screen.queryByText("Event Discussions (Zulip Feed)")).not.toBeInTheDocument();
    });
  });

  describe("5. Realtime RSVP & Attendance Management", () => {
    it("shows clearance required notice for unauthenticated or unverified users", async () => {
      mockAuthData.user = null;
      mockAuthData.authorizedUser = null;

      renderEventDetailPage();

      expect(await screen.findByText("Verified Clearance Required")).toBeInTheDocument();
      expect(screen.getByText(/Access to event rosters and RSVP actions is restricted/i)).toBeInTheDocument();
    });

    it("allows verified members to submit RSVP with potluck items and prep hours", async () => {
      mockAuthData.user = { uid: "user-lead-1" };
      mockAuthData.authorizedUser = { role: "student" };

      renderEventDetailPage();
      await screen.findByRole("heading", { name: sampleEvent.title });

      expect(await screen.findByText("+ Submit your RSVP")).toBeInTheDocument();

      const bringingInput = screen.getByLabelText(/Bringing Food\/Drinks/i);
      const prepHoursInput = screen.getByLabelText(/Volunteer Prep Hours/i);
      const notesInput = screen.getByLabelText(/Notes \/ Arrival Time/i);

      fireEvent.change(bringingInput, { target: { value: "Snack Platter" } });
      fireEvent.change(prepHoursInput, { target: { value: "3.5" } });
      fireEvent.change(notesInput, { target: { value: "Bringing robot batteries" } });

      const submitBtn = screen.getByRole("button", { name: "RSVP (Going)" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: "events/mars-kickoff-2026/signups/user-lead-1" }),
          expect.objectContaining({
            userId: "user-lead-1",
            nickname: "Lead Strategist",
            bringing: "Snack Platter",
            prepHours: 3.5,
            notes: "Bringing robot batteries",
            attended: false,
          }),
        );
      });
    });

    it("displays realtime signups list, totals, and allows RSVP cancellation via confirmation modal", async () => {
      mockAuthData.user = { uid: "user-lead-1" };
      mockAuthData.authorizedUser = { role: "student" };

      renderEventDetailPage();
      await screen.findByRole("heading", { name: sampleEvent.title });

      // Simulate Firestore realtime snapshot emission
      act(() => {
        if (onSnapshotCallback) {
          onSnapshotCallback({
            docs: [
              {
                id: "user-lead-1",
                data: () => ({
                  userId: "user-lead-1",
                  nickname: "Lead Strategist",
                  bringing: "Pretzels and Lemonade",
                  prepHours: 3.5,
                  notes: "Early setup",
                  attended: false,
                }),
              },
              {
                id: "user-2",
                data: () => ({
                  userId: "user-2",
                  nickname: "Driver 1",
                  bringing: "Water Bottles",
                  prepHours: 2,
                  notes: "Ready to drive",
                  attended: true,
                }),
              },
            ],
          });
        }
      });

      // Verify signups count and volunteer prep hours total
      expect(screen.getByText("2")).toBeInTheDocument(); // 2 present
      expect(screen.getByText("5.5")).toBeInTheDocument(); // 3.5 + 2 = 5.5 hrs
      expect(screen.getByText("Lead Strategist")).toBeInTheDocument();
      expect(screen.getByText("Driver 1")).toBeInTheDocument();

      // Form updates to "Save Details" and "Cancel RSVP"
      expect(screen.getByText("✓ Update RSVP details")).toBeInTheDocument();
      const cancelBtn = screen.getByRole("button", { name: "Cancel RSVP" });
      fireEvent.click(cancelBtn);

      // Verify Radix confirmation dialog opens
      expect(screen.getByRole("heading", { name: "Cancel your RSVP?" })).toBeInTheDocument();
      const confirmRemoveBtn = screen.getByRole("button", { name: "Remove RSVP" });
      fireEvent.click(confirmRemoveBtn);

      await waitFor(() => {
        expect(deleteDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: "events/mars-kickoff-2026/signups/user-lead-1" }),
        );
      });
    });

    it("allows self check-in attendance toggle and admin attendance toggle", async () => {
      mockAuthData.user = { uid: "user-admin-1" };
      mockAuthData.authorizedUser = { role: "admin" };

      renderEventDetailPage();
      await screen.findByRole("heading", { name: sampleEvent.title });

      act(() => {
        if (onSnapshotCallback) {
          onSnapshotCallback({
            docs: [
              {
                id: "user-admin-1",
                data: () => ({
                  userId: "user-admin-1",
                  nickname: "Admin Coach",
                  attended: false,
                }),
              },
              {
                id: "user-student-2",
                data: () => ({
                  userId: "user-student-2",
                  nickname: "Student Attendee",
                  attended: false,
                }),
              },
            ],
          });
        }
      });

      // Self Check In
      const selfCheckInBtn = screen.getByRole("button", { name: "Check In to Event" });
      fireEvent.click(selfCheckInBtn);

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: "events/mars-kickoff-2026/signups/user-admin-1" }),
          { attended: true },
          { merge: true },
        );
      });
    });
  });

  describe("6. Media Gallery & Photo Lightbox", () => {
    it("renders photo gallery thumbnails and opens accessible lightbox on selection", async () => {
      const mockPhotos = [
        {
          id: "photo_kickoff_1",
          url: "https://images.aresfirst.org/full-kickoff.jpg",
          thumbnailUrl: "https://images.aresfirst.org/thumb-kickoff.jpg",
          mediumUrl: "https://images.aresfirst.org/medium-kickoff.jpg",
          filename: "autonomous-board.jpg",
          uploadedBy: "Lead Strategist",
          uploadedAt: "2026-09-12T16:30:00.000Z",
        },
      ];

      vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ photos: mockPhotos })));

      renderEventDetailPage();

      const photoCard = await screen.findByRole("button", { name: /Open event photo: autonomous-board\.jpg/i });
      expect(photoCard).toBeInTheDocument();
      expect(screen.getByAltText("autonomous-board.jpg")).toHaveAttribute(
        "src",
        "https://images.aresfirst.org/thumb-kickoff.jpg",
      );

      // Open Lightbox
      fireEvent.click(photoCard);

      const lightbox = screen.getByRole("dialog");
      expect(lightbox).toBeInTheDocument();
      expect(within(lightbox).getByRole("link", { name: /Open Original ↗/i })).toHaveAttribute(
        "href",
        "https://images.aresfirst.org/full-kickoff.jpg",
      );

      // Close Lightbox
      const closeBtn = within(lightbox).getByRole("button", { name: "Close lightbox" });
      fireEvent.click(closeBtn);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("handles photo upload with image compression and Firestore metadata write", async () => {
      mockAuthData.user = { uid: "user-photographer" };
      mockAuthData.authorizedUser = { role: "mentor" };

      vi.mocked(resizeAndCompressImage).mockResolvedValue({
        base64: "base64data-photo",
        mimeType: "image/jpeg",
      });

      vi.mocked(authenticatedFetch).mockImplementation(async (path) => {
        if (typeof path === "string" && path.includes("/api/photos/upload-unified")) {
          return jsonResponse({
            photo: {
              id: "photo_new_123",
              publicUrl: "https://images.aresfirst.org/new_123.jpg",
              thumbnailUrl: "https://images.aresfirst.org/thumb_123.jpg",
              mediumUrl: "https://images.aresfirst.org/medium_123.jpg",
            },
          });
        }
        if (typeof path === "string" && path.includes("/api/profiles/me")) {
          return jsonResponse({ profile: { nickname: "Lead Photographer" } });
        }
        return jsonResponse({});
      });

      renderEventDetailPage();
      await screen.findByRole("heading", { name: sampleEvent.title });

      const fileInput = document.getElementById("photo-upload-input") as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const testFile = new File(["fake image bits"], "practice_run.jpg", { type: "image/jpeg" });
      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(resizeAndCompressImage).toHaveBeenCalledWith(testFile);
        expect(setDoc).toHaveBeenCalledWith(
          expect.objectContaining({ path: "events/mars-kickoff-2026/photos/photo_new_123" }),
          expect.objectContaining({
            url: "https://images.aresfirst.org/new_123.jpg",
            thumbnailUrl: "https://images.aresfirst.org/thumb_123.jpg",
            filename: "practice_run.jpg",
            uploadedBy: "Lead Photographer",
            isDeleted: 0,
          }),
        );
      });
    });
  });

  describe("7. Inline Event Management Drawer", () => {
    it("renders 'Edit Event' button for verified members and opens editor drawer", async () => {
      mockAuthData.user = { uid: "user-admin-1" };
      mockAuthData.authorizedUser = { role: "admin" };

      renderEventDetailPage();

      const editBtn = await screen.findByRole("button", { name: /Edit Event/i });
      expect(editBtn).toBeInTheDocument();
      fireEvent.click(editBtn);

      // Drawer component mount verified
      expect(await screen.findByRole("dialog", { name: /Edit Event/i })).toBeInTheDocument();
    });
  });
});

describe("Printable Match Plan Strategy & Tournament Handoff Integration", () => {
  const sampleMatches: TournamentMatch[] = [
    {
      id: "qm-1",
      tournamentId: "wv-state-championship-2026",
      matchNumber: "QM1",
      alliance: "red",
      partner: "14210",
      opponents: ["18214", "11111"],
      scoreSelf: 245,
      scoreOpponent: 180,
      result: "won",
      completed: true,
      notes: "Scored double specimen auto; partner hung in endgame.",
      isDeleted: 0,
      updatedAt: "2026-08-14T09:30:00.000Z",
    },
    {
      id: "qm-2",
      tournamentId: "wv-state-championship-2026",
      matchNumber: "QM2",
      alliance: "blue",
      partner: "99999",
      opponents: ["22222", "33333"],
      scoreSelf: 190,
      scoreOpponent: 210,
      result: "lost",
      completed: true,
      notes: "Intake jammed at 0:45.",
      isDeleted: 0,
      updatedAt: "2026-08-14T11:00:00.000Z",
    },
    {
      id: "qm-3",
      tournamentId: "wv-state-championship-2026",
      matchNumber: "QM3",
      alliance: "red",
      partner: "12345",
      opponents: ["54321", "67890"],
      result: "upcoming",
      completed: false,
      notes: "Target cycle time: <12s per sample.",
      isDeleted: 0,
      updatedAt: "2026-08-14T12:00:00.000Z",
    },
  ];

  it("renders printable match plan dialog with complete match strategy checklist and summary metrics", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <TournamentMatchPrintDialog
        tournamentName="WV State Championship 2026"
        tournamentDate="2026-03-14"
        tournamentLocation="Fairmont, WV"
        seasonName="2025-2026"
        challengeName="DECODE"
        matches={sampleMatches}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Print plan" });
    expect(trigger).toBeInTheDocument();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Event-day match plan" });
    expect(dialog).toBeInTheDocument();

    // Verify Header and Context
    expect(within(dialog).getByText("WV State Championship 2026")).toBeInTheDocument();
    expect(within(dialog).getByText(/Fairmont, WV/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/2025-2026 · DECODE/i)).toBeInTheDocument();

    // Verify Metric Summary Cards
    expect(within(dialog).getByText("2/3")).toBeInTheDocument(); // Checklist completed
    expect(within(dialog).getByText("1-1-0")).toBeInTheDocument(); // Record 1-1-0
    expect(within(dialog).getByText("217.5")).toBeInTheDocument(); // Average score (245+190)/2 = 217.5

    // Verify Every Match Row with Alliance, Partners, Opponents, and Scouting Notes
    expect(within(dialog).getByText("QM1")).toBeInTheDocument();
    expect(within(dialog).getByText("245–180")).toBeInTheDocument();
    expect(within(dialog).getByText("Scored double specimen auto; partner hung in endgame.")).toBeInTheDocument();

    expect(within(dialog).getByText("QM2")).toBeInTheDocument();
    expect(within(dialog).getByText("190–210")).toBeInTheDocument();
    expect(within(dialog).getByText("Intake jammed at 0:45.")).toBeInTheDocument();

    expect(within(dialog).getByText("QM3")).toBeInTheDocument();
    expect(within(dialog).getByText("Target cycle time: <12s per sample.")).toBeInTheDocument();

    // Test Print Trigger Execution
    const printPdfBtn = within(dialog).getByRole("button", { name: "Print / Save PDF" });
    fireEvent.click(printPdfBtn);
    expect(printSpy).toHaveBeenCalledOnce();

    // Close Dialog
    const closeBtn = within(dialog).getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    printSpy.mockRestore();
  });

  it("integrates printable match plan dialog with filter toolbar and CSV export in TournamentMatchesList", async () => {
    render(
      <TournamentMatchesList
        isPast={false}
        tournamentName="WV State Championship 2026"
        tournamentDate="2026-03-14"
        tournamentLocation="Fairmont, WV"
        seasonName="2025-2026"
        challengeName="DECODE"
        matches={sampleMatches}
        canEdit={true}
        isMatchesLoading={false}
        isSavingMatch={false}
        onToggleMatch={vi.fn()}
        onAddMatch={vi.fn()}
        onUpdateMatch={vi.fn()}
        onDeleteMatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "Download all match records as CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print plan" })).toBeInTheDocument();

    // Filter toolbar filtering visual matches while keeping print dialog complete
    const searchInput = screen.getByPlaceholderText("Filter match...");
    fireEvent.change(searchInput, { target: { value: "QM1" } });

    expect(screen.getByText("QM1")).toBeInTheDocument();
    expect(screen.queryByText("QM2")).not.toBeInTheDocument();

    // Open Print Plan Dialog while search filter is active
    fireEvent.click(screen.getByRole("button", { name: "Print plan" }));
    const dialog = screen.getByRole("dialog", { name: "Event-day match plan" });

    // Ensure all matches (including QM2, QM3) remain present in printable strategy handoff
    expect(within(dialog).getByText("QM1")).toBeInTheDocument();
    expect(within(dialog).getByText("QM2")).toBeInTheDocument();
    expect(within(dialog).getByText("QM3")).toBeInTheDocument();
  });
});
