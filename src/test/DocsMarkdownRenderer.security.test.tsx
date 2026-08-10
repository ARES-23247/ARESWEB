import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DocsMarkdownRenderer, { validateEmbedUrl } from "@/components/docs/DocsMarkdownRenderer";

describe("DocsMarkdownRenderer embed policy", () => {
  it("allows only HTTPS embed routes on approved media hosts", () => {
    expect(validateEmbedUrl("https://www.youtube-nocookie.com/embed/abc123")).toContain("/embed/abc123");
    expect(validateEmbedUrl("https://player.vimeo.com/video/12345")).toContain("/video/12345");
    expect(validateEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBeUndefined();
    expect(validateEmbedUrl("https://attacker.example/embed/abc123")).toBeUndefined();
    expect(validateEmbedUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("renders approved frames with an opaque sandbox and accessible title", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>'} />);
    const frame = screen.getByTitle("Embedded media");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-presentation");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  });

  it("blocks unapproved frames instead of rendering them", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://attacker.example/embed"></iframe>'} />);
    expect(screen.queryByTitle("Embedded media")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("blocked");
  });
});
