import { describe, expect, it } from "vitest";
import {
  formatOnshapeEvent,
  sanitizeOnshapeText,
  type OnshapeEvent,
} from "../onshape";

const baseEvent: OnshapeEvent = {
  eventType: "version.created",
  documentId: "a1b2c3d4e5f6g7h8i9j0",
  documentName: "2027 Robot",
  userName: "Jane Doe",
  versionName: "v42",
};

describe("sanitizeOnshapeText", () => {
  it("returns an empty string for non-string input", () => {
    expect(sanitizeOnshapeText(undefined)).toBe("");
  });

  it("strips markdown metacharacters and collapses whitespace", () => {
    expect(sanitizeOnshapeText("  **bold** [link](url) `code`  ")).toBe(
      "bold linkurl code",
    );
  });
});

describe("formatOnshapeEvent", () => {
  it("formats version.created with every field present", () => {
    const message = formatOnshapeEvent(baseEvent, "engineering");

    expect(message).not.toBeNull();
    expect(message!.stream).toBe("engineering");
    expect(message!.topic).toBe("CAD \u00b7 2027 Robot");
    expect(message!.content).toBe(
      "**[CAD]** Jane Doe created version v42 in *2027 Robot*\n\n" +
        "[Open in Onshape](https://cad.onshape.com/documents/a1b2c3d4e5f6g7h8i9j0)",
    );
  });

  it("falls back to identifier phrasing when names are missing", () => {
    const message = formatOnshapeEvent(
      {
        eventType: "version.created",
        documentId: "a1b2c3d4e5f6g7h8i9j0",
      },
      "engineering",
    );

    expect(message!.content).toContain("A team member created a new version");
    expect(message!.topic).toBe("CAD \u00b7 document a1b2c3d4e5f6g7h8i9j0");
  });

  it("formats document.created events", () => {
    const message = formatOnshapeEvent(
      { ...baseEvent, eventType: "document.created", versionName: undefined },
      "cad-alerts",
    );

    expect(message!.stream).toBe("cad-alerts");
    expect(message!.content).toContain("created the CAD document *2027 Robot*");
  });

  it("formats comment.created events", () => {
    const message = formatOnshapeEvent(
      { ...baseEvent, eventType: "comment.created", versionName: undefined },
      "engineering",
    );

    expect(message!.content).toContain("Jane Doe commented on *2027 Robot*");
  });

  it("formats revision.created events", () => {
    const message = formatOnshapeEvent(
      { ...baseEvent, eventType: "revision.created", versionName: undefined },
      "engineering",
    );

    expect(message!.content).toContain(
      "Jane Doe released a revision of *2027 Robot*",
    );
  });

  it("ignores noisy and unknown event types", () => {
    for (const eventType of [
      "document.modified",
      "document.trashed",
      "translation.completed",
      "totally-unknown",
    ]) {
      expect(
        formatOnshapeEvent({ ...baseEvent, eventType }, "engineering"),
      ).toBeNull();
    }
  });

  it("truncates long topics to the Zulip limit", () => {
    const message = formatOnshapeEvent(
      {
        ...baseEvent,
        documentName:
          "Extremely long CAD document name that exceeds the Zulip topic limit by a wide margin",
      },
      "engineering",
    );

    expect(message!.topic.length).toBeLessThanOrEqual(60);
    expect(message!.topic.endsWith("\u2026")).toBe(true);
  });
});
