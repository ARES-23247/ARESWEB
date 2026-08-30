import { describe, expect, it } from "vitest";
import { collectEmbeddedAcademyInteractionFolders } from "./academy-interaction-bundles.mjs";

describe("Academy interaction bundle discovery", () => {
  const simulations = [
    { id: "workspaceownershiplab", path: "./workspace-ownership-lab", academyApproved: true },
    { id: "tasksequencelab", path: "./task-sequence-lab", academyApproved: true },
    { id: "privateprototype", path: "./private-prototype", academyApproved: false },
  ];

  it("counts approved interactions embedded in authored lessons", () => {
    expect(collectEmbeddedAcademyInteractionFolders([
      "# One\n\n<workspaceownershiplab />",
      "# Two\n\n<tasksequencelab />\n\n<workspaceownershiplab />",
    ], simulations)).toEqual(["task-sequence-lab", "workspace-ownership-lab"]);
  });

  it("ignores unapproved, unknown, and merely named interactions", () => {
    expect(collectEmbeddedAcademyInteractionFolders([
      "Plan for workspaceownershiplab without embedding it.\n\n<privateprototype />\n\n<unknownlab />",
    ], simulations)).toEqual([]);
  });
});
