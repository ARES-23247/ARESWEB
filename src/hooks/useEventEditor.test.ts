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

const mockUploadFile = vi.fn();
const mockConfirm = vi.fn().mockResolvedValue(true);

// Only mock things unrelated to network requests/state management
vi.mock("./useAdminSettings", () => ({
  useAdminSettings: () => ({ availableSocials: ["discord", "bluesky"] }),
}));

vi.mock("./useImageUpload", () => ({
  useImageUpload: () => ({
    uploadFile: mockUploadFile,
    isUploading: false,
    errorMsg: "",
    setErrorMsg: vi.fn(),
  }),
}));

vi.mock("../contexts/ModalContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../contexts/ModalContext")>();
  return {
    ...actual,
    useModal: () => ({
      confirm: mockConfirm,
    }),
  };
});

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

  it("should handle saving as draft", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Draft Event",
        dateStart: "2024-06-01T10:00:00.000Z",
      });
    });

    act(() => {
      result.current.handlePublish(true); // Save as draft
    });

    await waitFor(() => {
      expect(result.current.successMsg).toContain("Event published successfully");
    });
  });

  it("should handle file upload successfully", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    mockUploadFile.mockResolvedValueOnce({ url: "https://ares23247.com/new-image.png" });

    const file = new File(["dummy content"], "test.png", { type: "image/png" });
    
    await act(async () => {
      await result.current.handleFileUpload(file);
    });

    expect(result.current.form.coverImage).toBe("https://ares23247.com/new-image.png");
  });

  it("should handle file upload failure", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    mockUploadFile.mockRejectedValueOnce(new Error("Upload failed"));

    const file = new File(["dummy content"], "test.png", { type: "image/png" });
    
    await act(async () => {
      await result.current.handleFileUpload(file);
    });

    expect(result.current.errorMsg).toBe("Error: Upload failed");
  });

  it("should handle event deletion successfully", async () => {
    mockConfirm.mockResolvedValueOnce(true);

    const existingEvent = mockEventState.events[0];
    const { result } = renderWithProviders(() => useEventEditor(existingEvent.id, mockEditor));
    
    await waitFor(() => expect(result.current.form.title).toBe(existingEvent.title));

    act(() => {
      result.current.handleDelete();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
  });

  it("should handle event deletion failure", async () => {
    mockConfirm.mockResolvedValueOnce(true);
    server.use(
      http.delete("*/api/admin/events/:id", () => {
        return HttpResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
      })
    );

    const existingEvent = mockEventState.events[0];
    const { result } = renderWithProviders(() => useEventEditor(existingEvent.id, mockEditor));
    
    await waitFor(() => expect(result.current.form.title).toBe(existingEvent.title));

    act(() => {
      result.current.handleDelete();
    });

    await waitFor(() => {
      expect(result.current.errorMsg).toBe("Failed to delete the event. Please try again.");
    });
  });

  it("should not delete if user cancels", async () => {
    mockConfirm.mockResolvedValueOnce(false);

    const existingEvent = mockEventState.events[0];
    const { result } = renderWithProviders(() => useEventEditor(existingEvent.id, mockEditor));
    
    await waitFor(() => expect(result.current.form.title).toBe(existingEvent.title));

    act(() => {
      result.current.handleDelete();
    });

    expect(result.current.isPending).toBe(false);
  });

  it("should handle location fetch failure", async () => {
    server.use(
      http.get("*/api/locations", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    // Wait for initial queries
    await waitFor(() => expect(result.current.isPending).toBe(false));
    // Check that it didn't crash (locations would be empty array)
  });

  it("should handle non-JSON description in fetch", async () => {
    const eventWithTextDesc = { 
      ...mockEventState.events[0], 
      description: "Just plain text, not JSON" 
    };
    server.use(
      http.get("*/api/admin/events/:id", () => {
        return HttpResponse.json({ success: true, event: eventWithTextDesc });
      })
    );

    renderWithProviders(() => useEventEditor("e1", mockEditor));
    
    await waitFor(() => {
      expect(mockEditor.commands.setContent).toHaveBeenCalledWith("<p>Just plain text, not JSON</p>");
    });
  });

  it("should handle Zod validation errors", async () => {
    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Valid Title",
        dateStart: "2024-05-01T10:00:00.000Z",
        category: "invalid" as any,
      });
    });

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() => {
      expect(result.current.errorMsg).toBeTruthy();
    });
  });

  it("should show warnings from server", async () => {
    server.use(
      http.post("*/api/admin/events", () => {
        return HttpResponse.json({ success: true, id: "e1", warning: "Social broadcast failed" }, { status: 207 });
      })
    );

    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Test Event",
        dateStart: "2024-05-01T10:00:00.000Z",
      });
    });

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() => {
      expect(result.current.warningMsg).toBe("Social broadcast failed");
    });
  });

  it("should block publish/delete when pending", async () => {
    // We need to trigger a mutation that stays pending
    server.use(
      http.post("*/api/admin/events", async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Test Event",
        dateStart: "2024-05-01T10:00:00.000Z",
      });
    });

    // Start a publish
    act(() => {
      result.current.handlePublish();
    });

    // Now it should be pending
    expect(result.current.isPending).toBe(true);

    // Try to publish again
    act(() => {
      result.current.handlePublish();
    });

    // Try to delete
    act(() => {
      result.current.handleDelete();
    });

    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("should handle author role publish path", async () => {
    // Mock the session to be an author
    server.use(
      http.get("*/api/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "author" },
          member_type: "student",
        });
      })
    );

    const { result } = renderWithProviders(() => useEventEditor(undefined, mockEditor));
    
    act(() => {
      result.current.setForm({
        ...result.current.form,
        title: "Author Event",
        dateStart: "2024-05-01T10:00:00.000Z",
      });
    });

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() => {
      expect(result.current.successMsg).toBe("Event submitted for review!");
    });
  });
});
