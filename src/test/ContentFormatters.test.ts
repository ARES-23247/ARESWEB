import { describe, it, expect } from "vitest";
import {
  toPlainText,
  toTiptapAst,
  extractTextFromAst,
  astToMarkdown,
  normalizeForMarkdownEditor,
} from "@/lib/contentFormatters";

describe("Content Formatters & AST Normalization", () => {
  describe("toPlainText", () => {
    it("handles null, undefined, and empty string safely", () => {
      expect(toPlainText(null)).toBe("");
      expect(toPlainText(undefined)).toBe("");
      expect(toPlainText("")).toBe("");
    });

    it("returns plain text unchanged", () => {
      expect(toPlainText("Usual Sunday practice")).toBe(
        "Usual Sunday practice",
      );
      expect(toPlainText("Concert in the Park / Spark Outreach")).toBe(
        "Concert in the Park / Spark Outreach",
      );
    });

    it("filters out default event placeholder text", () => {
      expect(
        toPlainText(
          "Describe your upcoming event or write a full recap here...",
        ),
      ).toBe("");

      const jsonPlaceholder = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Describe your upcoming event or write a full recap here...",
              },
            ],
          },
        ],
      });
      expect(toPlainText(jsonPlaceholder)).toBe("");
    });

    it("extracts text from Tiptap JSON AST string (Spark Goes Wild fixture)", () => {
      const jsonStr = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Show off the activity we created at Spark! Goes WILD, the Spark! Sunday dedicated to West Virginia Wildlife and conservation.",
              },
            ],
          },
        ],
      });

      expect(toPlainText(jsonStr)).toBe(
        "Show off the activity we created at Spark! Goes WILD, the Spark! Sunday dedicated to West Virginia Wildlife and conservation.",
      );
    });

    it("extracts text from complex Tiptap AST with images and multiple paragraphs (5/15 Practice fixture)", () => {
      const jsonStr = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Usual practice. Will start designing the new robot. ",
              },
            ],
          },
          { type: "paragraph" },
          {
            type: "imageResize",
            attrs: {
              src: "/api/media/1776644957855-ARES_duck.webp",
              alt: "ARES 23247 Team Media Image",
              title: "ARES 23247 Team Media Image",
              width: "197",
              height: null,
            },
          },
          { type: "paragraph" },
        ],
      });

      expect(toPlainText(jsonStr)).toBe(
        "Usual practice. Will start designing the new robot.",
      );
    });

    it("extracts text from multi-heading Tiptap AST (Watchparty fixture)", () => {
      const jsonStr = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [
              {
                type: "text",
                text: "Come Learn more about FTC and watch the World Championship",
              },
            ],
          },
          { type: "paragraph" },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Potluck is provided. " }],
          },
          { type: "paragraph" },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Public/prospective students are welcome. Note if you are not a current student we ask that a responsible adult accompanies you to the party/potluck. ",
              },
            ],
          },
        ],
      });

      const extracted = toPlainText(jsonStr);
      expect(extracted).toContain("Come Learn more about FTC");
      expect(extracted).toContain("Potluck is provided.");
      expect(extracted).toContain("Public/prospective students are welcome.");
      expect(extracted).not.toContain('{"type":"doc"');
    });

    it("supports maxLength truncation with ellipses", () => {
      const text =
        "This is a long sentence meant to be truncated at thirty characters.";
      expect(toPlainText(text, 30)).toBe("This is a long sentence meant...");
    });
  });

  describe("toTiptapAst", () => {
    it("returns null for non-JSON or invalid objects", () => {
      expect(toTiptapAst("Hello World")).toBeNull();
      expect(toTiptapAst("{ not json }")).toBeNull();
      expect(toTiptapAst({ type: "other" })).toBeNull();
    });

    it("parses valid Tiptap JSON string", () => {
      const ast = toTiptapAst(
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Sample text"}]}]}',
      );
      expect(ast).not.toBeNull();
      expect(ast?.type).toBe("doc");
      expect(Array.isArray(ast?.content)).toBe(true);
      expect(extractTextFromAst(ast)).toBe("Sample text");
    });

    it("accepts object documents and rejects empty or structurally invalid input", () => {
      const ast = { type: "doc", content: [] };
      expect(toTiptapAst(ast)).toBe(ast);
      expect(toTiptapAst(null)).toBeNull();
      expect(toTiptapAst("{}")).toBeNull();
      expect(toTiptapAst({ type: "doc", content: "invalid" })).toBeNull();
      expect(extractTextFromAst(undefined)).toBe("");
      expect(extractTextFromAst({ type: "image" })).toBe("");
    });
  });

  describe("astToMarkdown and normalizeForMarkdownEditor", () => {
    it("converts headings, paragraphs, and formatting to Markdown", () => {
      const ast = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Watchparty Details" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Join us for ",
              },
              {
                type: "text",
                marks: [{ type: "bold" }],
                text: "pizza and scouting",
              },
              {
                type: "text",
                text: "!",
              },
            ],
          },
        ],
      };

      const md = astToMarkdown(ast);
      expect(md).toBe(
        "## Watchparty Details\n\nJoin us for **pizza and scouting**!",
      );
    });

    it("normalizes Tiptap JSON string for Markdown editor", () => {
      const jsonStr = JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Regular Sunday build session." }],
          },
        ],
      });

      expect(normalizeForMarkdownEditor(jsonStr)).toBe(
        "Regular Sunday build session.",
      );
    });

    it("covers every supported Markdown block and text mark", () => {
      const markedText = {
        type: "text",
        text: "details",
        marks: [
          { type: "bold" },
          { type: "italic" },
          { type: "code" },
          { type: "strike" },
          { type: "link", attrs: { href: "https://aresfirst.org" } },
        ],
      };
      expect(astToMarkdown(markedText)).toBe(
        "[~~`***details***`~~](https://aresfirst.org)",
      );
      expect(
        astToMarkdown({
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "text", text: "one" }] },
          ],
        }),
      ).toBe("- one");
      expect(
        astToMarkdown({
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "text", text: "one" }] },
          ],
        }),
      ).toBe("1. one");
      expect(
        astToMarkdown({
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "quote" }] },
          ],
        }),
      ).toBe("> quote");
      expect(
        astToMarkdown({
          type: "imageResize",
          attrs: { src: "/photo.webp", alt: "Robot" },
        }),
      ).toBe("![Robot](/photo.webp)");
      expect(astToMarkdown({ type: "image", src: "/fallback.webp" })).toBe(
        "![Image](/fallback.webp)",
      );
      expect(
        astToMarkdown({
          type: "codeBlock",
          content: [{ type: "text", text: "const x = 1;" }],
        }),
      ).toBe("```\nconst x = 1;\n```");
      expect(astToMarkdown({ type: "horizontalRule" })).toBe("---");
      expect(astToMarkdown({ type: "hardBreak" })).toBe("  \n");
      expect(
        astToMarkdown({
          type: "unknown",
          content: [{ type: "text", text: "kept" }],
        }),
      ).toBe("kept");
      expect(astToMarkdown(null)).toBe("");
    });

    it("normalizes placeholders, plain strings, objects, and primitive fallbacks", () => {
      expect(normalizeForMarkdownEditor(null)).toBe("");
      expect(normalizeForMarkdownEditor("  plain text  ")).toBe("plain text");
      expect(
        normalizeForMarkdownEditor(
          "Describe your upcoming event or write a full recap here...",
        ),
      ).toBe("");
      expect(normalizeForMarkdownEditor(42)).toBe("42");
      expect(toPlainText(42)).toBe("42");
      expect(toPlainText({ type: "other" })).toBe("");
      expect(
        toPlainText({
          type: "doc",
          content: [{ type: "hardBreak" }, { type: "text", text: "next" }],
        }),
      ).toBe("next");
      expect(
        toPlainText(
          {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "long value" }],
              },
            ],
          },
          4,
        ),
      ).toBe("long...");
    });
  });
});
