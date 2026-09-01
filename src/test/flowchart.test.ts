import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFlowchart } from "@/components/docs/flowchart";

describe("bounded flowchart parser", () => {
  it("parses decisions, branch labels, dashed evidence, and subgraphs", () => {
    const parsed = parseFlowchart(`
      %% aria: A safe branch with separate evidence.
      flowchart LR
        subgraph S["Safety"]
          A["Input"] --> B{"Valid?"}
          B -->|"Yes"| C["Use result"]
          B -- No --> D["Block"]
        end
        C -. "separate evidence" .-> E["Review"]
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.direction).toBe("LR");
    expect(parsed?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "B", label: "Valid?", kind: "decision" }),
        expect.objectContaining({ id: "E", label: "Review" }),
      ]),
    );
    expect(parsed?.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "B", target: "C", label: "Yes" }),
        expect.objectContaining({ source: "B", target: "D", label: "No" }),
        expect.objectContaining({
          source: "C",
          target: "E",
          label: "separate evidence",
          dashed: true,
        }),
      ]),
    );
  });

  it("keeps cycle layout bounded and supports right-to-left flow", () => {
    const parsed = parseFlowchart(`
      flowchart RL
        A["One"] --> B["Two"]
        B --> A
    `);

    expect(parsed?.direction).toBe("RL");
    expect(parsed?.nodes).toHaveLength(2);
    expect(parsed?.rankCount).toBeLessThanOrEqual(2);
    expect(parsed?.laneCount).toBeGreaterThan(0);
  });

  it("rejects malformed, empty, and non-flowchart sources", () => {
    expect(parseFlowchart("sequenceDiagram\nA->>B: Hi")).toBeNull();
    expect(parseFlowchart("flowchart sideways\nA --> B")).toBeNull();
    expect(parseFlowchart("flowchart TD")).toBeNull();
    expect(parseFlowchart("flowchart TD\nA --> ???")).toBeNull();
  });

  it("parses every checked-in learning diagram", () => {
    const root = join(process.cwd(), "content", "learning");
    const markdownFiles = readdirSync(root, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".md"));
    let diagramCount = 0;

    for (const file of markdownFiles) {
      const markdown = readFileSync(join(root, file), "utf8");
      for (const match of markdown.matchAll(
        /^```mermaid\s*\r?\n([\s\S]*?)^```/gmu,
      )) {
        diagramCount += 1;
        expect(parseFlowchart(match[1]), `${file} contains unsupported syntax`).not.toBeNull();
      }
    }

    expect(diagramCount).toBeGreaterThan(60);
  });
});
