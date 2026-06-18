import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import PhotoPickerModal from "../components/PhotoPickerModal";
import { authenticatedFetch } from "../lib/api";

// Mock api helper
vi.mock("../lib/api", () => {
  return {
    authenticatedFetch: vi.fn(),
  };
});

describe("PhotoPickerModal", () => {
  const mockPhotos = [
    {
      id: "photo-1",
      publicUrl: "https://example.com/photo-1.jpg",
      originalFilename: "photo-1.jpg",
      albumId: "album-1"
    },
    {
      id: "photo-2",
      publicUrl: "https://example.com/photo-2.jpg",
      originalFilename: "photo-2.jpg",
      albumId: "album-2"
    }
  ];

  const mockAlbums = [
    {
      id: "album-1",
      title: "Chassis",
      category: "Robot Specs",
      coverImageUrl: "https://example.com/photo-1.jpg"
    },
    {
      id: "album-2",
      title: "Outreach 2026",
      category: "Outreach",
      coverImageUrl: "https://example.com/photo-2.jpg"
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PhotoPickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("fetches albums and photos and filters by album ID in gallery tab", async () => {
    (authenticatedFetch as any).mockImplementation((url: string) => {
      if (url === "/api/photos") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ photos: mockPhotos })
        });
      }
      if (url === "/api/photos/albums") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ albums: mockAlbums })
        });
      }
      return Promise.reject(new Error("Unknown endpoint"));
    });

    await act(async () => {
      render(<PhotoPickerModal isOpen={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    });

    // Go to ARES Gallery tab
    const galleryTab = screen.getByText("ARES Gallery");
    await act(async () => {
      fireEvent.click(galleryTab);
    });

    // Verify photos fetched and selector is populated
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/photos");
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/photos/albums");

    // Check if album selector dropdown is rendered
    const select = screen.getByLabelText("Filter by Album");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "All Albums" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chassis (Robot Specs)" })).toBeInTheDocument();

    // Verify both photos are in the document initially
    expect(screen.getByAltText("photo-1.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("photo-2.jpg")).toBeInTheDocument();

    // Filter to Chassis
    await act(async () => {
      fireEvent.change(select, { target: { value: "album-1" } });
    });

    // Verify photo-2 is filtered out
    expect(screen.getByAltText("photo-1.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("photo-2.jpg")).not.toBeInTheDocument();
  });

  it("renders the Albums tab and supports selecting/inserting an entire album", async () => {
    const mockOnSelect = vi.fn();
    (authenticatedFetch as any).mockImplementation((url: string) => {
      if (url === "/api/photos/albums") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ albums: mockAlbums })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos: [] }) });
    });

    await act(async () => {
      render(<PhotoPickerModal isOpen={true} onClose={vi.fn()} onSelect={mockOnSelect} />);
    });

    // Go to Albums tab
    const albumsTab = screen.getByText("Insert Albums");
    await act(async () => {
      fireEvent.click(albumsTab);
    });

    // Check if the album is rendered
    expect(screen.getByText("Chassis")).toBeInTheDocument();
    expect(screen.getByText("Outreach 2026")).toBeInTheDocument();

    // Click on Chassis album to insert
    const insertButtons = screen.getAllByRole("button", { name: "Insert Album" });
    expect(insertButtons.length).toBe(2);

    await act(async () => {
      fireEvent.click(insertButtons[0]);
    });

    // Verify onSelect is called with the markdown widget structure
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.stringContaining(`[album:album-1]`),
      "Chassis"
    );
  });
});
