import { describe, it, expect } from "vitest";
import { toPlainText, extractTextFromAst } from "../contentFormatters";

describe("functions contentFormatters", () => {
  it("handles null, undefined, and empty string", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(toPlainText("Regular Friday practice")).toBe(
      "Regular Friday practice",
    );
  });

  it("extracts text from Tiptap JSON AST string", () => {
    const jsonStr = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Usual Friday Night Practice.",
            },
          ],
        },
      ],
    });

    expect(toPlainText(jsonStr)).toBe("Usual Friday Night Practice.");
  });

  it("strips default placeholder", () => {
    expect(
      toPlainText("Describe your upcoming event or write a full recap here..."),
    ).toBe("");
  });

  it("truncates if maxLength provided", () => {
    expect(
      toPlainText(
        "A very long description for this specific tournament event",
        20,
      ),
    ).toBe("A very long descript...");
  });

  it("supports object AST, hard breaks, containers, and primitive fallbacks", () => {
    expect(
      toPlainText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Line one" },
              { type: "hardBreak" },
              { type: "text", text: "Line two" },
            ],
          },
        ],
      }),
    ).toBe("Line one\nLine two");
    expect(
      extractTextFromAst({
        type: "unknown",
        content: [{ type: "text", text: "kept" }],
      }),
    ).toBe("kept");
    expect(extractTextFromAst({ type: "image" })).toBe("");
    expect(toPlainText({ type: "other" })).toBe("[object Object]");
    expect(toPlainText(42)).toBe("42");
  });

  it("falls back safely for malformed JSON and truncates parsed AST", () => {
    expect(toPlainText("{ malformed }")).toBe("{ malformed }");
    const ast = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Long calendar description" }],
        },
      ],
    });
    expect(toPlainText(ast, 4)).toBe("Long...");
  });
});
