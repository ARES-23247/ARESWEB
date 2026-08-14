import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TiptapRenderer, { type ASTNode } from "@/components/TiptapRenderer";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import { safeContentImageUrl, safeContentLinkUrl } from "@/lib/contentUrls";

describe("untrusted content URL boundaries", () => {
  it("allows supported links while rejecting executable, credentialed, and ambiguous URLs", () => {
    expect(safeContentLinkUrl("/docs/controls#pid")).toBe("/docs/controls#pid");
    expect(safeContentLinkUrl("https://docs.example.org/guide")).toBe("https://docs.example.org/guide");
    expect(safeContentLinkUrl("http://docs.example.org/guide")).toBe("http://docs.example.org/guide");
    expect(safeContentLinkUrl("mailto:team@example.org")).toBe("mailto:team@example.org");
    expect(safeContentLinkUrl("tel:+13045550100")).toBe("tel:+13045550100");
    expect(safeContentLinkUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeContentLinkUrl("https://user:secret@example.org/private")).toBeUndefined();
    expect(safeContentLinkUrl("//attacker.example/path")).toBeUndefined();
    expect(safeContentLinkUrl("\\attacker.example\\path")).toBeUndefined();
    expect(safeContentLinkUrl("https://[")).toBeUndefined();
    expect(safeContentLinkUrl("line\nbreak")).toBeUndefined();
    expect(safeContentLinkUrl("x".repeat(4_097))).toBeUndefined();
    expect(safeContentLinkUrl(null)).toBeUndefined();
  });

  it("limits images to relative or credential-free HTTPS sources", () => {
    expect(safeContentImageUrl("/images/robot.webp")).toBe("/images/robot.webp");
    expect(safeContentImageUrl("https://images.example.org/robot.webp")).toBe(
      "https://images.example.org/robot.webp",
    );
    expect(safeContentImageUrl("http://images.example.org/robot.webp")).toBeUndefined();
    expect(safeContentImageUrl("data:image/svg+xml,<svg onload=alert(1) />")).toBeUndefined();
    expect(safeContentImageUrl("https://user:secret@example.org/robot.webp")).toBeUndefined();
    expect(safeContentImageUrl("https://[")).toBeUndefined();
    expect(safeContentImageUrl("//attacker.example/robot.webp")).toBeUndefined();
    expect(safeContentImageUrl(null)).toBeUndefined();
  });

  it("renders safe Tiptap links, blocks unsafe media, and clamps heading levels", () => {
    const document: ASTNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Blocked link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
            { type: "text", text: "Safe link", marks: [{ type: "link", attrs: { href: "https://example.org" } }] },
          ],
        },
        { type: "heading", attrs: { level: 99 }, content: [{ type: "text", text: "Bounded heading" }] },
        { type: "heading", attrs: { level: "unknown" }, content: [{ type: "text", text: "Fallback heading" }] },
        { type: "image", attrs: { src: "javascript:alert(1)", alt: "Robot render" } },
        { type: "image", attrs: { src: "https://images.example.org/robot.webp", alt: "Safe robot", title: "Prototype" } },
      ],
    };

    render(<TiptapRenderer node={document} />);

    expect(screen.getByText("Blocked link").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Safe link" })).toHaveAttribute("href", "https://example.org");
    expect(screen.getByRole("heading", { name: "Bounded heading", level: 6 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fallback heading", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Robot render" })).not.toBeInTheDocument();
    expect(screen.getByText("Image unavailable: Robot render")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Safe robot" })).toHaveAttribute(
      "src",
      "https://images.example.org/robot.webp",
    );
    expect(screen.getByText("Prototype")).toBeInTheDocument();
  });

  it("ignores malformed rich attributes instead of crashing public content", () => {
    const malformedDocument = {
      type: "doc",
      content: [
        { type: "text", text: { unexpected: true }, marks: [null] },
        { type: "interactiveComponent", attrs: { componentName: { unexpected: true } } },
        {
          type: "image",
          attrs: {
            src: "/images/robot.webp",
            alt: { unexpected: true },
            title: { unexpected: true },
          },
        },
      ],
    } as unknown as ASTNode;

    const { container } = render(<TiptapRenderer node={malformedDocument} />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/images/robot.webp");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it("blocks unsafe Markdown images after schema sanitization", () => {
    render(<DocsMarkdownRenderer content="![Robot render](javascript:alert(1))" />);

    expect(screen.queryByRole("img", { name: "Robot render" })).not.toBeInTheDocument();
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("preserves supported Markdown links while leaving executable links inactive", () => {
    render(
      <DocsMarkdownRenderer
        content={"[Call the team](tel:+13045550100) [Read the guide](https://example.org/guide) [Blocked](javascript:alert(1))"}
      />,
    );

    expect(screen.getByRole("link", { name: "Call the team" })).toHaveAttribute(
      "href",
      "tel:+13045550100",
    );
    expect(screen.getByRole("link", { name: "Read the guide" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByText("Blocked").closest("a")).toBeNull();
  });
});
