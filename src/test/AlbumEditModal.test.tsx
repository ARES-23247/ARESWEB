import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import AlbumEditModal, { AlbumItem } from "../app/dashboard/photos/components/AlbumEditModal";

describe("AlbumEditModal", () => {
  const mockAlbum: AlbumItem = {
    id: "album-1",
    title: "Swerve Design",
    description: "CAD for swerve modules",
    coverImageUrl: "https://example.com/cover.jpg",
    category: "CAD Design",
    mediaCount: 12,
    createdAt: "2026-06-18T10:00:00Z"
  };

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <AlbumEditModal
        isOpen={false}
        onClose={vi.fn()}
        editingAlbum={null}
        newAlbumTitle=""
        setNewAlbumTitle={vi.fn()}
        newAlbumCategory="Robot Specs"
        setNewAlbumCategory={vi.fn()}
        newAlbumCoverUrl=""
        setNewAlbumCoverUrl={vi.fn()}
        newAlbumDesc=""
        setNewAlbumDesc={vi.fn()}
        newAlbumIsPublic={false}
        setNewAlbumIsPublic={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with 'Create New Album' when editingAlbum is null", () => {
    render(
      <AlbumEditModal
        isOpen={true}
        onClose={vi.fn()}
        editingAlbum={null}
        newAlbumTitle="New Title"
        setNewAlbumTitle={vi.fn()}
        newAlbumCategory="Robot Specs"
        setNewAlbumCategory={vi.fn()}
        newAlbumCoverUrl=""
        setNewAlbumCoverUrl={vi.fn()}
        newAlbumDesc=""
        setNewAlbumDesc={vi.fn()}
        newAlbumIsPublic={false}
        setNewAlbumIsPublic={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(screen.getByText("Create New Album")).toBeInTheDocument();
    expect(screen.getByLabelText("Album Title")).toHaveValue("New Title");
  });

  it("renders with 'Edit Album Details' when editingAlbum is provided", () => {
    render(
      <AlbumEditModal
        isOpen={true}
        onClose={vi.fn()}
        editingAlbum={mockAlbum}
        newAlbumTitle={mockAlbum.title}
        setNewAlbumTitle={vi.fn()}
        newAlbumCategory={mockAlbum.category}
        setNewAlbumCategory={vi.fn()}
        newAlbumCoverUrl={mockAlbum.coverImageUrl || ""}
        setNewAlbumCoverUrl={vi.fn()}
        newAlbumDesc={mockAlbum.description}
        setNewAlbumDesc={vi.fn()}
        newAlbumIsPublic={false}
        setNewAlbumIsPublic={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(screen.getByText("Edit Album Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Album Title")).toHaveValue("Swerve Design");
    expect(screen.getByLabelText("Category Type")).toHaveValue("CAD Design");
    expect(screen.getByLabelText("Cover Image URL (Optional)")).toHaveValue("https://example.com/cover.jpg");
    expect(screen.getByLabelText("Description")).toHaveValue("CAD for swerve modules");
  });

  it("triggers form state setters when inputs change", () => {
    const mockSetNewAlbumTitle = vi.fn();
    const mockSetNewAlbumDesc = vi.fn();
    
    render(
      <AlbumEditModal
        isOpen={true}
        onClose={vi.fn()}
        editingAlbum={null}
        newAlbumTitle=""
        setNewAlbumTitle={mockSetNewAlbumTitle}
        newAlbumCategory="Robot Specs"
        setNewAlbumCategory={vi.fn()}
        newAlbumCoverUrl=""
        setNewAlbumCoverUrl={vi.fn()}
        newAlbumDesc=""
        setNewAlbumDesc={mockSetNewAlbumDesc}
        newAlbumIsPublic={false}
        setNewAlbumIsPublic={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText("Album Title"), { target: { value: "Robot Practice" } });
    expect(mockSetNewAlbumTitle).toHaveBeenCalledWith("Robot Practice");

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Practice desc" } });
    expect(mockSetNewAlbumDesc).toHaveBeenCalledWith("Practice desc");
  });

  it("triggers onSubmit when save/submit button is clicked", () => {
    const mockOnSubmit = vi.fn((e) => e.preventDefault());
    render(
      <AlbumEditModal
        isOpen={true}
        onClose={vi.fn()}
        editingAlbum={null}
        newAlbumTitle="Title"
        setNewAlbumTitle={vi.fn()}
        newAlbumCategory="Robot Specs"
        setNewAlbumCategory={vi.fn()}
        newAlbumCoverUrl=""
        setNewAlbumCoverUrl={vi.fn()}
        newAlbumDesc=""
        setNewAlbumDesc={vi.fn()}
        newAlbumIsPublic={false}
        setNewAlbumIsPublic={vi.fn()}
        onSubmit={mockOnSubmit}
        isSubmitting={false}
      />
    );

    fireEvent.submit(screen.getByRole("button", { name: "Create Album" }));
    expect(mockOnSubmit).toHaveBeenCalled();
  });
});
