import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LazyImage from "./LazyImage";

describe("LazyImage Component", () => {
  beforeEach(() => {
    // Mock IntersectionObserver for lazy loading
    vi.stubGlobal("IntersectionObserver", class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders with required props", () => {
    render(<LazyImage src="/test.jpg" alt="Test image" />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Test image");
    expect(img).toHaveAttribute("src", "/test.jpg");
  });

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" className="custom-wrapper" />
    );

    const wrapper = container.querySelector(".custom-wrapper");
    expect(wrapper).toBeInTheDocument();
  });

  it("applies custom imgClassName to picture element", () => {
    render(
      <LazyImage src="/test.jpg" alt="Test" imgClassName="custom-img" />
    );

    const picture = screen.getByRole("img").closest("picture");
    expect(picture).toHaveClass("custom-img");
  });

  it("renders with loading attribute set to lazy", () => {
    render(<LazyImage src="/test.jpg" alt="Test" />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("shows skeleton before image loads", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" />
    );

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("hides skeleton after image loads", async () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" />
    );

    const img = screen.getByRole("img");

    // Simulate image load
    fireEvent.load(img);

    await waitFor(() => {
      const skeleton = container.querySelector(".animate-pulse") as HTMLElement;
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveStyle({ opacity: "0" });
    });
  });

  it("generates WebP source from JPEG source", () => {
    render(<LazyImage src="/image.jpg" alt="Test" />);

    const source = screen.getByRole("img").previousElementSibling;
    expect(source?.tagName.toLowerCase()).toBe("source");
    expect(source).toHaveAttribute("type", "image/webp");
    expect(source).toHaveAttribute("srcset", "/image.webp");
  });

  it("generates WebP source from PNG source", () => {
    render(<LazyImage src="/image.png" alt="Test" />);

    const source = screen.getByRole("img").previousElementSibling;
    expect(source?.tagName.toLowerCase()).toBe("source");
    expect(source).toHaveAttribute("srcset", "/image.webp");
  });

  it("generates WebP source from JPEG source", () => {
    render(<LazyImage src="/image.jpeg" alt="Test" />);

    const source = screen.getByRole("img").previousElementSibling;
    expect(source).toHaveAttribute("srcset", "/image.webp");
  });

  it("uses custom srcset when provided", () => {
    render(
      <LazyImage
        src="/image.jpg"
        alt="Test"
        srcset="/image-small.jpg 480w, /image-large.jpg 1024w"
      />
    );

    const source = screen.getByRole("img").previousElementSibling;
    expect(source).toHaveAttribute("srcset", "/image-small.jpg 480w, /image-large.jpg 1024w");
  });

  it("uses custom sizes when provided", () => {
    render(
      <LazyImage
        src="/image.jpg"
        alt="Test"
        sizes="(max-width: 600px) 480px, 1024px"
      />
    );

    const source = screen.getByRole("img").previousElementSibling;
    expect(source).toHaveAttribute("sizes", "(max-width: 600px) 480px, 1024px");
  });

  it("handles image error and shows fallback", async () => {
    render(<LazyImage src="/broken.jpg" alt="Test" />);

    const img = screen.getByRole("img") as HTMLImageElement;

    // Simulate image error
    fireEvent.error(img);

    await waitFor(() => {
      // Should load fallback image
      expect(img.src).toContain("/news_1.png");
    });
  });

  it("only attempts fallback once to prevent infinite loop", async () => {
    render(<LazyImage src="/broken.jpg" alt="Test" />);

    const img = screen.getByRole("img") as HTMLImageElement;

    // First error should trigger fallback
    fireEvent.error(img);

    await waitFor(() => {
      expect(img.src).toContain("/news_1.png");
    });

    // Second error should not change the source again
    const srcAfterFirstError = img.src;
    fireEvent.error(img);

    await waitFor(() => {
      expect(img.src).toBe(srcAfterFirstError);
    });
  });

  it("does not convert unknown file extensions to WebP", () => {
    render(<LazyImage src="/image.svg" alt="Test" />);

    const source = screen.getByRole("img").previousElementSibling;
    // SVG should pass through unchanged (no WebP conversion)
    expect(source).toHaveAttribute("srcset", "/image.svg");
  });

  it("does not convert URLs without image extension", () => {
    render(<LazyImage src="/api/image/abc123" alt="Test" />);

    const source = screen.getByRole("img").previousElementSibling;
    // URLs without extension should pass through
    expect(source).toHaveAttribute("srcset", "/api/image/abc123");
  });

  it("applies proper CSS classes for animations", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("relative", "overflow-hidden");

    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toHaveClass("bg-marble/5");
  });

  it("renders picture element with proper structure", () => {
    const { container } = render(
      <LazyImage src="/test.jpg" alt="Test" />
    );

    const picture = container.querySelector("picture");
    expect(picture).toBeInTheDocument();

    const source = picture?.querySelector("source");
    expect(source).toBeInTheDocument();

    const img = picture?.querySelector("img");
    expect(img).toBeInTheDocument();
  });

  it("handles empty src gracefully", () => {
    render(<LazyImage src="" alt="Test" />);

    const img = screen.getByRole("img");
    // Component renders with empty src, but img element exists
    expect(img).toBeInTheDocument();
    // When src is empty, getAttribute returns null (browser normalizes empty src)
    expect(img.getAttribute("src")).toBeNull();
  });
});
