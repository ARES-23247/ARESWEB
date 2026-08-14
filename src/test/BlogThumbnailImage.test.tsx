import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BlogThumbnailImage, {
  getBlogThumbnailFallback,
  getBlogThumbnailSource,
} from "@/components/BlogThumbnailImage";

const identity = {
  title: "WDTV 5 Newscast!",
  author: "ARES 23247",
  date: "2026-06-28",
};

describe("BlogThumbnailImage", () => {
  it("preserves encoded Firebase object paths", () => {
    const thumbnail =
      "https://firebasestorage.googleapis.com/v0/b/aresfirst-portal.firebasestorage.app/o/blog%2Fthumbnails%2Fwdtv.webp?alt=media&token=download-token";

    render(
      <BlogThumbnailImage
        {...identity}
        thumbnail={thumbnail}
        data-testid="thumbnail"
      />,
    );

    expect(screen.getByTestId("thumbnail")).toHaveAttribute("src", thumbnail);
  });

  it("uses a generated card when a post has no selected thumbnail", () => {
    const fallback = getBlogThumbnailFallback(identity);
    expect(getBlogThumbnailSource(identity)).toBe(fallback);

    render(<BlogThumbnailImage {...identity} data-testid="thumbnail" />);

    expect(screen.getByTestId("thumbnail")).toHaveAttribute("src", fallback);
    expect(screen.getByTestId("thumbnail")).toHaveAttribute("alt", "");
  });

  it("replaces a failed selected image with the generated card", () => {
    const fallback = getBlogThumbnailFallback(identity);
    render(
      <BlogThumbnailImage
        {...identity}
        thumbnail="https://images.example.test/missing.webp"
        data-testid="thumbnail"
      />,
    );
    const thumbnail = screen.getByTestId("thumbnail");

    fireEvent.error(thumbnail);
    expect(thumbnail).toHaveAttribute("src", fallback);

    fireEvent.error(thumbnail);
    expect(thumbnail).toHaveAttribute("src", fallback);
  });
});
