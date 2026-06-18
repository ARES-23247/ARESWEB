import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import PhotoDetailsDrawer, { ImportedPhoto } from "../app/dashboard/photos/components/PhotoDetailsDrawer";
import { AlbumItem } from "../app/dashboard/photos/components/AlbumEditModal";

describe("PhotoDetailsDrawer", () => {
  const mockPhoto: ImportedPhoto = {
    id: "photo-1",
    storagePath: "photos/image.jpg",
    publicUrl: "https://example.com/image.jpg",
    originalFilename: "image.jpg",
    fileSize: 204800, // 200 KB
    mimeType: "image/jpeg",
    importedAt: "2026-06-18T10:00:00Z",
    caption: "Robot chassis close-up",
    altText: "Chassis with wheels",
    albumId: "album-1",
    labels: ["chassis", "wheels"]
  };

  const mockAlbums: AlbumItem[] = [
    {
      id: "album-1",
      title: "Chassis Development",
      description: "Robot chassis pics",
      category: "Robot Specs",
      coverImageUrl: "https://example.com/cover.jpg",
      mediaCount: 1,
      createdAt: "2026-06-18T09:00:00Z"
    }
  ];

  it("does not render when selectedPhoto is null", () => {
    const { container } = render(
      <PhotoDetailsDrawer
        selectedPhoto={null}
        onClose={vi.fn()}
        canEdit={true}
        albums={mockAlbums}
        editAlbumId=""
        setEditAlbumId={vi.fn()}
        editAltText=""
        setEditAltText={vi.fn()}
        editCaption=""
        setEditCaption={vi.fn()}
        editLabels={[]}
        newTagInput=""
        setNewTagInput={vi.fn()}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
        onSetAlbumCover={vi.fn()}
        onDeletePhoto={vi.fn()}
        onSaveDetails={vi.fn()}
        isSavingDetails={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders photo properties and metadata correctly", () => {
    render(
      <PhotoDetailsDrawer
        selectedPhoto={mockPhoto}
        onClose={vi.fn()}
        canEdit={true}
        albums={mockAlbums}
        editAlbumId="album-1"
        setEditAlbumId={vi.fn()}
        editAltText="Chassis with wheels"
        setEditAltText={vi.fn()}
        editCaption="Robot chassis close-up"
        setEditCaption={vi.fn()}
        editLabels={["chassis", "wheels"]}
        newTagInput=""
        setNewTagInput={vi.fn()}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
        onSetAlbumCover={vi.fn()}
        onDeletePhoto={vi.fn()}
        onSaveDetails={vi.fn()}
        isSavingDetails={false}
      />
    );

    expect(screen.getByText("Manage Photo")).toBeInTheDocument();
    expect(screen.getByText("ID: photo-1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe what is in the photo/i)).toHaveValue("Chassis with wheels");
    expect(screen.getByPlaceholderText(/Enter a description or write a caption/i)).toHaveValue("Robot chassis close-up");
    expect(screen.getByText("image/jpeg")).toBeInTheDocument();
    expect(screen.getByText("200.0 KB")).toBeInTheDocument();
  });

  it("handles Set Album Cover correctly", async () => {
    const mockOnSetAlbumCover = vi.fn();
    render(
      <PhotoDetailsDrawer
        selectedPhoto={mockPhoto}
        onClose={vi.fn()}
        canEdit={true}
        albums={mockAlbums}
        editAlbumId="album-1"
        setEditAlbumId={vi.fn()}
        editAltText="Alt"
        setEditAltText={vi.fn()}
        editCaption="Caption"
        setEditCaption={vi.fn()}
        editLabels={[]}
        newTagInput=""
        setNewTagInput={vi.fn()}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
        onSetAlbumCover={mockOnSetAlbumCover}
        onDeletePhoto={vi.fn()}
        onSaveDetails={vi.fn()}
        isSavingDetails={false}
      />
    );

    const setCoverButton = screen.getByRole("button", { name: "Set Album Cover" });
    expect(setCoverButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(setCoverButton);
    });
    expect(mockOnSetAlbumCover).toHaveBeenCalled();
  });

  it("disables Set Album Cover button if the photo is already the cover image", () => {
    const albumsWithThisPhotoAsCover = [
      {
        ...mockAlbums[0],
        coverImageUrl: mockPhoto.publicUrl
      }
    ];

    render(
      <PhotoDetailsDrawer
        selectedPhoto={mockPhoto}
        onClose={vi.fn()}
        canEdit={true}
        albums={albumsWithThisPhotoAsCover}
        editAlbumId="album-1"
        setEditAlbumId={vi.fn()}
        editAltText="Alt"
        setEditAltText={vi.fn()}
        editCaption="Caption"
        setEditCaption={vi.fn()}
        editLabels={[]}
        newTagInput=""
        setNewTagInput={vi.fn()}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
        onSetAlbumCover={vi.fn()}
        onDeletePhoto={vi.fn()}
        onSaveDetails={vi.fn()}
        isSavingDetails={false}
      />
    );

    const setCoverButton = screen.getByRole("button", { name: "✓ Album Cover" });
    expect(setCoverButton).toBeInTheDocument();
    expect(setCoverButton).toBeDisabled();
  });
});
