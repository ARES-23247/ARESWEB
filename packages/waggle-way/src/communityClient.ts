import type { CommunityClient } from "./core/community";
import { validateLevel } from "./core/level";

type Transport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class CommunityRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CommunityRequestError";
  }
}

const messages: Record<number, string> = {
  400: "This request could not be accepted. Check the garden and try again.",
  401: "Sign in again to continue.",
  403: "Your account does not currently have access to this action.",
  404: "This garden is no longer available. Refresh the collection.",
  409: "This garden changed while you were viewing it. Reload it before making another change.",
  413: "This garden and its recordings are too large to submit.",
  429: "The community is receiving too many requests. Please try again later.",
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid community response.");
  return value as Record<string, unknown>;
}

function entries(value: unknown, max: number, check: (item: unknown) => void) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid community collection.");
  value.forEach(check);
}

function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Invalid community text.");
}

function integer(value: unknown, min = 1) {
  if (!Number.isSafeInteger(value) || (value as number) < min)
    throw new Error("Invalid community number.");
}

function choice(value: unknown, options: readonly unknown[]) {
  if (!options.includes(value)) throw new Error("Invalid community choice.");
}

const reasons = ["text", "identity", "unsafe", "misleading", "other"];
function metadata(value: unknown) {
  const row = record(value);
  text(row.nickname, 24);
  choice(row.difficulty, ["gentle", "moderate", "challenging"]);
  choice(row.estimatedLength, ["short", "medium", "long"]);
}

function card(value: unknown) {
  const row = record(value);
  metadata(row);
  text(row.id, 64);
  text(row.title, 80);
  integer(row.revision);
  integer(row.population);
  integer(row.rescueTarget);
  choice(row.theme, ["sunny", "meadow", "glasshouse", "rainy", "wildflower"]);
  entries(row.mechanics, 12, (kind) =>
    choice(kind, [
      "hive",
      "flowers",
      "terrain",
      "water",
      "perch",
      "fan",
      "shelter",
      "switch",
      "gate",
      "rally",
      "sprinkler",
      "pollen",
    ]),
  );
  if (row.objectives !== undefined) {
    const goals = record(row.objectives);
    integer(goals.pollen, 0);
    if (goals.maxTools !== undefined) integer(goals.maxTools, 0);
  }
}

function owned(value: unknown) {
  const row = record(value);
  text(row.id, 64);
  text(row.title, 80);
  integer(row.version);
  if (row.publishedRevision !== null) integer(row.publishedRevision);
  if (row.candidateRevision !== null) integer(row.candidateRevision);
  choice(row.status, [
    "pending",
    "rejected",
    "published",
    "removed",
    "deleted",
  ]);
  choice(row.reviewReason, [null, ...reasons]);
}

function page(value: unknown, key: string, check: (item: unknown) => void) {
  const row = record(value);
  entries(row[key], 12, check);
  if (row.nextCursor !== null) text(row.nextCursor, 4096);
}

function garden(value: unknown) {
  card(value);
  const row = record(value);
  validateLevel(row.level);
  if (row.parent !== undefined) {
    const parent = record(row.parent);
    text(parent.id, 64);
    text(parent.title, 80);
    text(parent.nickname, 24);
  }
}

function ownRevision(value: unknown) {
  const row = record(value);
  owned(row.garden);
  metadata(row.metadata);
  validateLevel(row.level);
}

function review(value: unknown) {
  const row = record(value);
  owned(row.garden);
  garden(row.candidate);
  if (
    typeof row.reviewDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(row.reviewDigest)
  )
    throw new Error("Invalid review revision.");
  choice(row.allBeesProven, [true, false]);
  integer(row.bestPollen, 0);
  integer(row.fewestTools, 0);
}

function report(value: unknown) {
  const row = record(value);
  text(row.id, 64);
  text(row.levelId, 64);
  integer(row.revision);
  choice(row.reason, reasons);
  if (row.publication !== null) {
    const publication = record(row.publication);
    card(publication.card);
    integer(publication.version);
  }
}

/** The host owns authentication/App Check. No automatic retries of mutations. */
export function createCommunityClient(transport: Transport): CommunityClient {
  async function request<T>(
    path: string,
    check: ((value: unknown) => void) | null,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    let expire!: (error: Error) => void;
    const deadline = new Promise<never>((_resolve, reject) => {
      expire = reject;
    });
    const timer = setTimeout(() => {
      controller.abort();
      expire(new Error("Community request deadline exceeded."));
    }, 20_000);
    try {
      const response = await Promise.race([
        transport(`/api/waggle-way${path}`, {
          method,
          signal: controller.signal,
          cache: "no-store",
          ...(body === undefined
            ? {}
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }),
        }),
        deadline,
      ]);
      if (!response.ok)
        throw new CommunityRequestError(
          messages[response.status] ??
            "The community service is unavailable. Please try again later.",
          response.status,
        );
      if (!check) {
        if (response.status !== 204)
          throw new Error("Invalid community acknowledgement.");
        return undefined as T;
      }
      const value: unknown = await Promise.race([response.json(), deadline]);
      check(value);
      return value as T;
    } catch (cause) {
      if (cause instanceof CommunityRequestError) throw cause;
      throw new CommunityRequestError(
        method === "GET"
          ? "Could not load the community. Check your connection and try again."
          : "Could not confirm this change. Reload the garden before trying again.",
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }
  function query(values: Record<string, string | undefined>) {
    const result = new URLSearchParams();
    for (const [key, value] of Object.entries(values))
      if (value !== undefined) result.set(key, value);
    return result.size ? `?${result}` : "";
  }
  const id = encodeURIComponent;
  return {
    browse: (filters = {}) =>
      request(`/gardens${query({ ...filters })}`, (value) =>
        page(value, "gardens", card),
      ),
    get: (key) => request(`/gardens/${id(key)}`, garden),
    mine: () => request("/mine", (value) => entries(value, 20, owned)),
    getOwn: (key) => request(`/mine/${id(key)}`, ownRevision),
    submit: (key, submission) =>
      request(`/mine/${id(key)}`, owned, "PUT", submission),
    removeOwn: (key, expectedVersion) =>
      request(`/mine/${id(key)}`, owned, "DELETE", { expectedVersion }),
    pending: (cursor) =>
      request(`/review${query({ cursor })}`, (value) =>
        page(value, "gardens", owned),
      ),
    review: (key) => request(`/review/${id(key)}`, review),
    decide: (key, expectedVersion, reviewDigest, decision, reason) =>
      request(`/review/${id(key)}`, owned, "POST", {
        expectedVersion,
        reviewDigest,
        decision,
        ...(reason ? { reason } : {}),
      }),
    removePublished: (key, expectedVersion, reason) =>
      request(`/gardens/${id(key)}/remove`, owned, "POST", {
        expectedVersion,
        reason,
      }),
    report: (key, reason) =>
      request(`/gardens/${id(key)}/report`, null, "POST", { reason }),
    reports: (cursor) =>
      request(`/reports${query({ cursor })}`, (value) =>
        page(value, "reports", report),
      ),
    resolveReport: (key) =>
      request(`/reports/${id(key)}/resolve`, null, "POST", {}),
  };
}
