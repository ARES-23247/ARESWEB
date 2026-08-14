import { describe, it, expect } from "vitest";
import { toPlainText, extractTextFromAst } from "../contentFormatters";

describe("functions contentFormatters", () => {
  it("handles null, undefined, and empty string", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(toPlainText("Regular Friday practice")).toBe("Regular Friday practice");
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
    expect(toPlainText("Describe your upcoming event or write a full recap here...")).toBe("");
  });

  it("truncates if maxLength provided", () => {
    expect(toPlainText("A very long description for this specific tournament event", 20)).toBe("A very long descript...");
  });
});
