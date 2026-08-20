import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EventGalleryTab from "@/app/dashboard/events/components/EventGalleryTab";

const photos = [
  {
    id: "photo-1",
    url: "https://example.test/photo.jpg",
    filename: "Progress photo",
    uploadedBy: "ARES Member",
    uploadedAt: "2026-08-20T12:00:00.000Z",
    uploadedByUid: "owner-1",
    publicationStatus: "pending" as const,
  },
];

function renderGallery(currentUserId: string, canApprove = false) {
  const handleDeletePhoto = vi.fn();
  render(
    <EventGalleryTab
      photos={photos}
      canEdit
      uploadingImage={false}
      uploadError={null}
      handleImageUpload={vi.fn()}
      handleDeletePhoto={handleDeletePhoto}
      handleApprovePhoto={vi.fn()}
      canApprove={canApprove}
      currentUserId={currentUserId}
      setSelectedPhoto={vi.fn()}
    />,
  );
  return handleDeletePhoto;
}

describe("EventGalleryTab", () => {
  it("does not offer archive controls for another member's photo", () => {
    renderGallery("different-member");
    expect(
      screen.queryByRole("button", { name: /archive progress photo/i }),
    ).not.toBeInTheDocument();
  });

  it("lets the uploader confirm an archive", () => {
    const handleDeletePhoto = renderGallery("owner-1");
    fireEvent.click(
      screen.getByRole("button", { name: /archive progress photo/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^archive photo$/i }));
    expect(handleDeletePhoto).toHaveBeenCalledWith("photo-1");
  });
});
