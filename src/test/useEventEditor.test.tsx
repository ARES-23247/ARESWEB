import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useEventEditor } from "../app/dashboard/events/hooks/useEventEditor";
import { useAuth } from "../context/AuthContext";
import { doc, setDoc, onSnapshot, getDocs } from "firebase/firestore";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage } from "../lib/image";
import { archiveEvent, createEvent, restoreEvent, updateEvent } from "@/app/calendar/api";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock Firestore functions
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}));

vi.mock("@/hooks/useCurrentProfile", () => ({
  useCurrentProfile: () => ({
    data: { profile: { nickname: "Member Nickname", avatar: "" } },
    error: null,
  }),
}));

vi.mock("@/app/calendar/api", () => ({
  archiveEvent: vi.fn(),
  createEvent: vi.fn(),
  restoreEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  cleanUndefined: (obj: any) => obj,
}));

// Mock image compression
vi.mock("../lib/image", () => ({
  resizeAndCompressImage: vi.fn(),
}));

// Mock logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("useEventEditor custom hook", () => {
  const mockLocations = [
    { id: "mars-building", name: "Mars Building", address: "123 Mars Way" }
  ];
  const mockSetLocations = vi.fn();
  const mockTeamMembers = [
    { uid: "member-1", nickname: "Aariketh", avatar: "avatar1" }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set Auth mock
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", displayName: "Test User", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
    });

    // Set Firestore mock implementations (avoids issues with vitest mockReset: true)
    (onSnapshot as any).mockImplementation((ref: any, callback: any) => {
      if (typeof callback === "function") {
        setTimeout(() => {
          callback({
            docs: []
          });
        }, 0);
      }
      return () => {}; // return unsub function
    });

    (setDoc as any).mockResolvedValue(undefined);
    (archiveEvent as any).mockResolvedValue(undefined);
    (createEvent as any).mockResolvedValue({ id: "new-event" });
    (restoreEvent as any).mockResolvedValue(undefined);
    (updateEvent as any).mockResolvedValue({ id: "event-123" });
    
    (getDocs as any).mockResolvedValue({
      docs: []
    });

    // Set utility and fetch mock implementations
    (resizeAndCompressImage as any).mockResolvedValue({
      base64: "mockbase64",
      mimeType: "image/jpeg"
    });

    (authenticatedFetch as any).mockImplementation(async (path: string) => path === "/api/profiles/me"
      ? { ok: true, status: 200, statusText: "OK", json: async () => ({ profile: { nickname: "Member Nickname", avatar: "" } }) }
      : {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        json: async () => ({
          photo: {
            id: "photo-1",
            publicUrl: "photo.jpg",
            googleMediaItemId: "g-1"
          }
        })
      });
  });

  it("initializes hook states for Create Mode when eventToEdit is null", () => {
    const { result } = renderHook(() =>
      useEventEditor({
        isOpen: true,
        onClose: vi.fn(),
        eventToEdit: null,
        locations: mockLocations,
        setLocations: mockSetLocations,
        teamMembers: mockTeamMembers,
      })
    );

    expect(result.current.formTitle).toBe("");
    expect(result.current.formLocationId).toBe("");
    expect(result.current.formCategory).toBe("internal");
    expect(result.current.formStatus).toBe("published");
  });

  it("initializes hook states for Edit Mode when eventToEdit is provided", () => {
    const mockEvent = {
      id: "event-123",
      title: "Existing Event",
      dateStart: "2026-06-30T10:00:00.000Z",
      dateEnd: "2026-06-30T12:00:00.000Z",
      locationId: "mars-building",
      description: "Sample Description",
      category: "outreach" as const,
      coverImage: "cover.jpg",
      isPotluck: 1,
      isVolunteer: 1,
      status: "published" as const,
    };

    const { result } = renderHook(() =>
      useEventEditor({
        isOpen: true,
        onClose: vi.fn(),
        eventToEdit: mockEvent,
        locations: mockLocations,
        setLocations: mockSetLocations,
        teamMembers: mockTeamMembers,
      })
    );

    expect(result.current.formTitle).toBe("Existing Event");
    expect(result.current.formLocationId).toBe("mars-building");
    expect(result.current.formCategory).toBe("outreach");
    expect(result.current.formDescription).toBe("Sample Description");
    expect(result.current.formCoverImage).toBe("cover.jpg");
    expect(result.current.formIsPotluck).toBe(1);
    expect(result.current.formIsVolunteer).toBe(1);
  });

  it("handles event save and delete action flows", async () => {
    const mockEvent = {
      id: "event-123",
      title: "Existing Event",
      dateStart: "2026-06-30T10:00:00.000Z",
      category: "internal" as const,
    };

    const mockOnClose = vi.fn();

    const { result } = renderHook(() =>
      useEventEditor({
        isOpen: true,
        onClose: mockOnClose,
        eventToEdit: mockEvent,
        locations: mockLocations,
        setLocations: mockSetLocations,
        teamMembers: mockTeamMembers,
      })
    );

    await act(async () => {
      const e = { preventDefault: vi.fn() } as any;
      await result.current.handleSaveEvent(e);
    });

    expect(updateEvent).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDeleteEvent();
    });

    expect(archiveEvent).toHaveBeenCalledWith("event-123");
  });

  it("restores archived events without exposing a permanent delete action", async () => {
    const mockEvent = {
      id: "event-123",
      title: "Existing Event",
      dateStart: "2026-06-30T10:00:00.000Z",
      category: "internal" as const,
    };

    const mockOnClose = vi.fn();

    const { result } = renderHook(() =>
      useEventEditor({
        isOpen: true,
        onClose: mockOnClose,
        eventToEdit: mockEvent,
        locations: mockLocations,
        setLocations: mockSetLocations,
        teamMembers: mockTeamMembers,
      })
    );

    await act(async () => {
      await result.current.handleRestoreEvent();
    });

    expect(restoreEvent).toHaveBeenCalledWith("event-123");
    expect(result.current).not.toHaveProperty("handlePermanentDeleteEvent");
  });

  it("fetches revisions list when activeTab shifts to revisions", async () => {
    const mockEvent = {
      id: "event-123",
      title: "Existing Event",
      dateStart: "2026-06-30T10:00:00.000Z",
      category: "internal" as const,
    };

    (getDocs as any).mockResolvedValueOnce({
      docs: [
        {
          id: "rev-1",
          data: () => ({
            title: "Old Title",
            editedByName: "Editor",
            timestamp: "2026-06-30T10:00:00.000Z",
          }),
        },
      ],
    });

    const { result } = renderHook(
      (props) => useEventEditor(props),
      {
        initialProps: {
          isOpen: true,
          onClose: vi.fn(),
          eventToEdit: mockEvent,
          locations: mockLocations,
          setLocations: mockSetLocations,
          teamMembers: mockTeamMembers,
        },
      }
    );

    // Initial tab is 'edit'
    expect(result.current.activeTab).toBe("edit");

    // Change tab to 'revisions'
    await act(async () => {
      result.current.setActiveTab("revisions");
    });

    // Check revisions list populated
    expect(result.current.revisions).toHaveLength(1);
    expect(result.current.revisions[0].title).toBe("Old Title");
  });

  it("handles image uploads and deleting photos", async () => {
    const mockEvent = {
      id: "event-123",
      title: "Existing Event",
      dateStart: "2026-06-30T10:00:00.000Z",
      category: "internal" as const,
    };

    const { result } = renderHook(() =>
      useEventEditor({
        isOpen: true,
        onClose: vi.fn(),
        eventToEdit: mockEvent,
        locations: mockLocations,
        setLocations: mockSetLocations,
        teamMembers: mockTeamMembers,
      })
    );

    const mockFile = new File(["dummy"], "test.jpg", { type: "image/jpeg" });
    const mockEventArg = {
      target: {
        files: [mockFile]
      }
    } as any;

    await act(async () => {
      await result.current.handleImageUpload(mockEventArg);
    });

    expect(setDoc).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDeletePhoto("photo-1");
    });

    const lastWrite = vi.mocked(setDoc).mock.calls.at(-1);
    expect(lastWrite?.[1]).toEqual(expect.objectContaining({ isDeleted: 1 }));
    expect(lastWrite?.[2]).toEqual({ merge: true });
  });
});
