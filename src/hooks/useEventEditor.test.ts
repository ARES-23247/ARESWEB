import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { useEventEditor } from "./useEventEditor";
import { renderWithProviders } from "../test/utils";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { mockEventState } from "../test/mocks/handlers/events";
import type { Editor } from "@tiptap/react";

// Mock an editor object to satisfy the useQuery 'enabled' check
const mockEditor = {
  commands: {
    setContent: vi.fn(),
    clearContent: vi.fn(),
  },
  getJSON: () => ({ type: "doc", content: [] }),
} as unknown as Editor;

// Only mock things unrelated to network requests/state management
vi.mock("./useAdminSettings", () => ({
  useAdminSettings: () => ({ availableSocials: ["discord", "bluesky"] }),
}));
vi.mock("./useImageUpload", () => ({
  useImageUpload: () => ({
    uploadFile: vi.fn(),
    isUploading: false,
    errorMsg: "",
    setErrorMsg: vi.fn(),
  }),
}));

describe("useEventEditor (MSW Integrated)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default form values for new event", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    expect(result.current.form.title).toBe("");
    expect(result.current.form.category).toBe("internal");
    expect(result.current.isDeleted).toBe(false);
    
    // Wait for locations query to resolve via MSW
    await waitFor(() => {
      expect(result.current.locations.length).toBeGreaterThan(0);
    });
  });

  it("should fetch and populate event data when editId is provided", async () => {
    const existingEvent = mockEventState.events[0];
    const { result } = renderWithProviders(() => useEventEditor(existingEvent.id, mockEditor));
    
    // Wait for the React Query fetching the event to resolve
    await waitFor(() => {
      expect(result.current.form.title).toBe(existingEvent.title);
    });

    expect(result.current.form.location).toBe(existingEvent.location);
  });

  it("should validate required fields before publishing", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.handlePublish();
    });

    expect(result.current.errorMsg).toBe("Title and Start Date are required.");
  });

  it("should handle publishing a new event", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    // Set valid form data
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Championship Finals",
        dateStart: "2024-05-01T10:00:00.000Z",
        coverImage: "https://ares23247.com/valid-image.png",
      });
    });

    // Publish event
    act(() => {
      result.current.handlePublish();
    });

    // Wait for success message from MSW handler response
    await waitFor(() => {
      expect(result.current.successMsg).toContain("Event published successfully");
    });
  });

  it("should handle server errors gracefully", async () => {
    // Override the MSW handler to return 500
    server.use(
      http.post("*/api/admin/events", () => {
        return HttpResponse.json({ success: false, error: "Database error" }, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Test Event",
        dateStart: "2024-05-01T10:00:00.000Z",
        coverImage: "https://ares23247.com/valid-image.png",
      });
    });

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() => {
      expect(result.current.errorMsg).toContain("Database error");
    });
  });

  it("should handle event deletion", async () => {
    const existingEvent = mockEventState.events[0];
    const { result } = renderWithProviders(() => useEventEditor(existingEvent.id, mockEditor));
    
    // Wait for data load
    await waitFor(() => expect(result.current.form.title).toBe(existingEvent.title));

    act(() => {
      // the confirm mock in test/utils.tsx always resolves true
      result.current.handleDelete();
    });

    // Deletion should clear out the state via MSW and navigate (which we could assert if we tracked the router history)
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });
});
