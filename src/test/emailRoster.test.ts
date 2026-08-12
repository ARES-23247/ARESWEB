import { describe, expect, it } from "vitest";
import {
  buildBccList,
  buildEmailRosterCsv,
  buildEmailRosterRequestBody,
  parseEmailRosterResponse,
  type EmailRosterRecipient,
} from "../app/dashboard/users/emailRoster";

const recipients: EmailRosterRecipient[] = [
  { name: "CircuitFox", email: "student@example.org", role: "member", memberType: "student", subteams: ["Programming"] },
  { name: '=Formula "Name"', email: "+alias@example.org", role: "mentor", memberType: "mentor", subteams: ["CAD", "Mechanical"] },
];

describe("email roster utilities", () => {
  it("parses an explicit response and rejects malformed or count-mismatched payloads", () => {
    const valid = { recipients, recipientCount: 2, generatedAt: "2026-08-12T00:00:00.000Z" };
    expect(parseEmailRosterResponse(valid)).toEqual(valid);
    expect(parseEmailRosterResponse(null)).toBeNull();
    expect(parseEmailRosterResponse({ ...valid, recipientCount: 1 })).toBeNull();
    expect(parseEmailRosterResponse({ ...valid, recipients: [{ email: "missing-fields@example.org" }] })).toBeNull();
  });

  it("builds explicit request bodies and client-specific BCC separators", () => {
    expect(buildEmailRosterRequestBody("all", "")).toEqual({ audience: "all" });
    expect(buildEmailRosterRequestBody("students", "Programming")).toEqual({ audience: "students", subteam: "Programming" });
    expect(buildBccList(recipients, "gmail")).toBe("student@example.org, +alias@example.org");
    expect(buildBccList(recipients, "outlook")).toBe("student@example.org; +alias@example.org");
  });

  it("creates quoted CSV and neutralizes spreadsheet formulas", () => {
    const csv = buildEmailRosterCsv(recipients);
    expect(csv).toContain('"Name","Email","Portal role","Member type","Subteams"');
    expect(csv).toContain('"\'=Formula ""Name"""');
    expect(csv).toContain('"\'+alias@example.org"');
    expect(csv).toContain('"CAD; Mechanical"');
  });
});
