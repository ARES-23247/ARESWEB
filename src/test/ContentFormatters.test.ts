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
      expect(toPlainText("Usual Sunday practice")).toBe("Usual Sunday practice");
      expect(toPlainText("Concert in the Park / Spark Outreach")).toBe("Concert in the Park / Spark Outreach");
    });

    it("filters out default event placeholder text", () => {
      expect(toPlainText("Describe your upcoming event or write a full recap here...")).toBe("");
      
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
        "Show off the activity we created at Spark! Goes WILD, the Spark! Sunday dedicated to West Virginia Wildlife and conservation."
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

      expect(toPlainText(jsonStr)).toBe("Usual practice. Will start designing the new robot.");
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
      const text = "This is a long sentence meant to be truncated at thirty characters.";
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
      const ast = toTiptapAst('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Sample text"}]}]}');
      expect(ast).not.toBeNull();
      expect(ast?.type).toBe("doc");
      expect(Array.isArray(ast?.content)).toBe(true);
      expect(extractTextFromAst(ast)).toBe("Sample text");
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
      expect(md).toBe("## Watchparty Details\n\nJoin us for **pizza and scouting**!");
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

      expect(normalizeForMarkdownEditor(jsonStr)).toBe("Regular Sunday build session.");
    });
  });
});
