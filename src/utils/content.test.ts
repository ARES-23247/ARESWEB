/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { extractTextFromAst } from "./content";

describe("extractTextFromAst", () => {
  it("returns empty string for null or undefined", () => {
    expect(extractTextFromAst(null)).toBe("");
    expect(extractTextFromAst(undefined as any)).toBe("");
  });

  it("extracts text from plain string if not JSON", () => {
    expect(extractTextFromAst("hello world")).toBe("hello world");
  });

  it("extracts text from stringified AST", () => {
    const ast = { type: "doc", content: [{ type: "text", text: "hello JSON" }] };
    expect(extractTextFromAst(JSON.stringify(ast))).toBe("hello JSON");
  });

  it("extracts text from node with text field", () => {
    const node = { type: "text", text: "direct text" };
    expect(extractTextFromAst(node)).toBe("direct text");
  });

  it("extracts and concatenates text from nested content array", () => {
    const node = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Paragraph 1." }] },
        { type: "paragraph", content: [{ type: "text", text: "Paragraph 2." }] },
      ]
    };
    expect(extractTextFromAst(node)).toBe("Paragraph 1. Paragraph 2.");
  });

  it("returns empty string for nodes with no text or content", () => {
    const node = { type: "horizontalRule" };
    expect(extractTextFromAst(node)).toBe("");
  });
});

