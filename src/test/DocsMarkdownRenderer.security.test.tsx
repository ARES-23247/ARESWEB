import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DocsMarkdownRenderer, { validateEmbedUrl } from "@/components/docs/DocsMarkdownRenderer";

describe("DocsMarkdownRenderer embed policy", () => {
  it("demotes authored Markdown H1 headings below the route title", () => {
    render(<DocsMarkdownRenderer content="# Lesson section" />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Lesson section" })).toBeVisible();
  });

  it("allows only HTTPS embed routes on approved media hosts", () => {
    expect(validateEmbedUrl("https://www.youtube-nocookie.com/embed/827aNTABAho?rel=0")).toContain("/embed/827aNTABAho");
    expect(validateEmbedUrl("https://player.vimeo.com/video/12345")).toContain("/video/12345");
    expect(validateEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBeUndefined();
    expect(validateEmbedUrl("https://attacker.example/embed/abc123")).toBeUndefined();
    expect(validateEmbedUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("lets approved external players use their own storage and provides a watch fallback", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://www.youtube-nocookie.com/embed/827aNTABAho"></iframe>'} />);
    const frame = screen.getByTitle("Embedded media");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
    expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(screen.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=827aNTABAho");
  });

  it.each([
    undefined, "not a URL", "/embed/827aNTABAho", "https://aresfirst.org/embed/827aNTABAho",
    "https://www.youtube.com.attacker.example/embed/827aNTABAho",
    "https://www.youtube.com:8443/embed/827aNTABAho",
    "https://user:password@www.youtube.com/embed/827aNTABAho",
    "https://www.youtube.com/embed/", "https://www.youtube.com/embed/827aNTABAho/extra",
    "https://player.vimeo.com/video/not-a-video",
  ])("rejects non-player URL %s before granting provider-origin access", (url) => {
    expect(validateEmbedUrl(url)).toBeUndefined();
  });

  it("strips authored frame code and permissions, and preserves a supplied title", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://www.youtube.com/embed/827aNTABAho" title="Team montage" srcdoc="<script>alert(1)</script>" sandbox="allow-top-navigation" allow="camera; microphone"></iframe>'} />);
    const frame = screen.getByTitle("Team montage");
    expect(frame).not.toHaveAttribute("srcdoc");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-top-navigation");
    expect(frame.getAttribute("allow")).not.toMatch(/camera|microphone/);
  });

  it("provides a direct fallback for the existing Vimeo provider", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://player.vimeo.com/video/12345"></iframe>'} />);
    expect(screen.getByRole("link", { name: "Open video in a new tab" })).toHaveAttribute("href", "https://player.vimeo.com/video/12345");
  });

  it("blocks unapproved frames instead of rendering them", () => {
    render(<DocsMarkdownRenderer content={'<iframe src="https://attacker.example/embed"></iframe>'} />);
    expect(screen.queryByTitle("Embedded media")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("blocked");
  });

  it("runs only interactions that completed Academy review", async () => {
    const { rerender } = render(<DocsMarkdownRenderer content="<mechanismratioexplorer />" />);
    expect(await screen.findByRole("heading", { name: "Mechanism Ratio Explorer" })).toBeVisible();

    rerender(<DocsMarkdownRenderer content="<cyclinggearratios />" />);
    expect(screen.getByRole("note")).toHaveTextContent("not been approved");
    expect(screen.queryByText("Cycling Gear Ratios & Cadence")).not.toBeInTheDocument();
  });
});
