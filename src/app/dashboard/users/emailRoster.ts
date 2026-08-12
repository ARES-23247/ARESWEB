export type EmailRosterAudience = "all" | "students" | "parents" | "mentors" | "alumni";
export type EmailRosterClient = "gmail" | "outlook";

export interface EmailRosterRecipient {
  name: string;
  email: string;
  role: string;
  memberType: string;
  subteams: string[];
}

export interface EmailRosterResponse {
  recipients: EmailRosterRecipient[];
  recipientCount: number;
  generatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseEmailRosterResponse(value: unknown): EmailRosterResponse | null {
  if (!isRecord(value) || !Array.isArray(value.recipients)
    || typeof value.recipientCount !== "number" || !Number.isInteger(value.recipientCount)
    || typeof value.generatedAt !== "string") return null;

  const recipients: EmailRosterRecipient[] = [];
  for (const candidate of value.recipients) {
    if (!isRecord(candidate)
      || typeof candidate.name !== "string"
      || typeof candidate.email !== "string"
      || typeof candidate.role !== "string"
      || typeof candidate.memberType !== "string"
      || !Array.isArray(candidate.subteams)
      || !candidate.subteams.every(item => typeof item === "string")) return null;
    recipients.push({
      name: candidate.name,
      email: candidate.email,
      role: candidate.role,
      memberType: candidate.memberType,
      subteams: candidate.subteams,
    });
  }

  if (value.recipientCount !== recipients.length) return null;
  return { recipients, recipientCount: value.recipientCount, generatedAt: value.generatedAt };
}

export function buildEmailRosterRequestBody(audience: EmailRosterAudience, subteam: string): {
  audience: EmailRosterAudience;
  subteam?: string;
} {
  return subteam ? { audience, subteam } : { audience };
}

export function buildBccList(recipients: EmailRosterRecipient[], client: EmailRosterClient): string {
  return recipients.map(recipient => recipient.email).join(client === "outlook" ? "; " : ", ");
}

function csvCell(value: string): string {
  const formulaSafe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function buildEmailRosterCsv(recipients: EmailRosterRecipient[]): string {
  const header = ["Name", "Email", "Portal role", "Member type", "Subteams"];
  const rows = recipients.map(recipient => [
    recipient.name,
    recipient.email,
    recipient.role,
    recipient.memberType,
    recipient.subteams.join("; "),
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
