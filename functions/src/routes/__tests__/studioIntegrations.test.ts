import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  installationGet: vi.fn(),
  transactionGet: vi.fn(),
  transactionSet: vi.fn(),
  runTransaction: vi.fn(),
}));

interface FakeRef {
  collectionName: string;
  id: string;
  get?: typeof mocks.installationGet;
  collection?: (name: string) => { doc: (id: string) => FakeRef };
}

function ref(collectionName: string, id: string): FakeRef {
  return {
    collectionName,
    id,
    ...(collectionName === "studio_integrations" ? { get: mocks.installationGet } : {}),
    ...(collectionName === "posts" ? {
      collection: (name: string) => ({
        doc: (childId: string) => ref(`${collectionName}/${id}/${name}`, childId),
      }),
    } : {}),
  };
}

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id?: string) => ref(name, id || "auto-id")),
    })),
    runTransaction: mocks.runTransaction,
  },
}));

import studioIntegrationsRouter, {
  hashStudioToken,
  studioNotebookContentHash,
  type StudioNotebookEntry,
} from "../studioIntegrations";

const INSTALLATION_ID = "ares-team-23247";
const TOKEN_SECRET = "a".repeat(43);
const TOKEN = `ares_studio_${INSTALLATION_ID}.${TOKEN_SECRET}`;
const TOKEN_SALT = "b".repeat(32);

function routeHandler() {
  const layer = studioIntegrationsRouter.stack.find(
    (candidate) => candidate.route?.path === "/v1/notebook-drafts" && candidate.route.methods.post,
  );
  if (!layer?.route) throw new Error("Studio notebook route not found.");
  return layer.route.stack.at(-1)!.handle;
}

function routeStackNames(): string[] {
  const layer = studioIntegrationsRouter.stack.find(
    (candidate) => candidate.route?.path === "/v1/notebook-drafts" && candidate.route.methods.post,
  );
  if (!layer?.route) throw new Error("Studio notebook route not found.");
  return layer.route.stack.map((entry) => entry.name);
}

function entry(overrides: Partial<StudioNotebookEntry> = {}): StudioNotebookEntry {
  const base: StudioNotebookEntry = {
    entryId: "entry-2026-001",
    revision: 1,
    entryType: "ROBOT_ISSUE",
    workspace: { teamId: "23247", seasonId: "2026", robotId: "Lightbot" },
    markdownBody: "# Brownout investigation\n\nBattery sag was reproduced under load.",
    evidence: [{
      kind: "session",
      referenceId: "session-1",
      sha256: "c".repeat(64),
      label: "Match log",
      uri: "https://drive.google.com/file/d/example",
    }],
    visibility: "TEAM",
    reviewState: "APPROVED",
    humanAuthorId: "software-team",
    humanReviewerId: "mentor-reviewer",
    aiProvenance: {
      provider: "openai",
      model: "gpt-test",
      promptSchemaVersion: 1,
      generatedAtMs: 1_000,
      evidenceHashes: ["d".repeat(64)],
    },
    contentHash: "0".repeat(64),
    createdAtMs: 1_000,
    updatedAtMs: 2_000,
    schemaVersion: 1,
  };
  const candidate = { ...base, ...overrides };
  return { ...candidate, contentHash: studioNotebookContentHash(candidate) };
}

function installation(overrides: Record<string, unknown> = {}) {
  return {
    installationId: INSTALLATION_ID,
    tokenSalt: TOKEN_SALT,
    tokenHash: hashStudioToken(TOKEN_SALT, TOKEN_SECRET),
    status: "active",
    scopes: ["notebook:draft:create"],
    allowedTeamIds: ["23247"],
    allowedWorkspaceIds: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return { exists, data: () => data };
}

function request(payload: StudioNotebookEntry, overrides: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${TOKEN}`,
    "idempotency-key": `${payload.entryId}:${payload.contentHash}`,
  };
  return {
    body: payload,
    is: vi.fn(() => "application/json"),
    get: vi.fn((name: string) => headers[name.toLowerCase()]),
    ...overrides,
  };
}

function response() {
  return {
    payload: undefined as unknown,
    statusCode: 200,
    headers: new Map<string, string>(),
    set(name: string, value: string) { this.headers.set(name, value); return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.payload = payload; return this; },
  };
}

function transactionSnapshots(options: {
  receipt?: Record<string, unknown>;
  quotaCount?: unknown;
  post?: Record<string, unknown>;
  currentInstallation?: Record<string, unknown>;
} = {}) {
  mocks.transactionGet.mockImplementation((documentRef: FakeRef) => {
    if (documentRef.collectionName === "studio_integrations") {
      const data = options.currentInstallation ?? installation();
      return Promise.resolve(snapshot(Boolean(data), data));
    }
    if (documentRef.collectionName === "studio_integration_receipts") {
      return Promise.resolve(snapshot(Boolean(options.receipt), options.receipt));
    }
    if (documentRef.collectionName === "studio_integration_quotas") {
      return Promise.resolve(snapshot(options.quotaCount !== undefined, { count: options.quotaCount }));
    }
    if (documentRef.collectionName === "posts") {
      return Promise.resolve(snapshot(Boolean(options.post), options.post));
    }
    throw new Error(`Unexpected transaction read: ${documentRef.collectionName}`);
  });
}

async function invoke(payload: StudioNotebookEntry, requestOverrides: Record<string, unknown> = {}) {
  const res = response();
  const next = vi.fn();
  await routeHandler()(request(payload, requestOverrides), res, next);
  return { res, next };
}

describe("ARES Robotics Studio notebook integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABUSE_HMAC_SECRET = "test-abuse-hmac-secret-that-is-long-enough";
    mocks.installationGet.mockResolvedValue(snapshot(true, installation()));
    transactionSnapshots();
    mocks.runTransaction.mockImplementation(async (operation: (transaction: unknown) => Promise<unknown>) => operation({
      get: mocks.transactionGet,
      set: mocks.transactionSet,
    }));
  });

  it("rate limits before authenticating the installation", () => {
    expect(routeStackNames()).toHaveLength(2);
  });

  it("matches the Kotlin canonical hash contract", () => {
    const payload = entry({
      aiProvenance: undefined,
      humanAuthorId: undefined,
      evidence: [{ kind: "session", referenceId: "session-1", sha256: "a".repeat(64) }],
      markdownBody: "# Brownout investigation",
    });
    expect(payload.contentHash).toBe("93074f84203145939f8ba2c5f7d40b5699482e52385c763cd3e9b115686fc61e");
  });

  it("creates a pending blog draft, revision, receipt, quota, and redacted audit atomically", async () => {
    const payload = entry();
    const { res, next } = await invoke(payload);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.payload).toEqual(expect.objectContaining({
      draftId: expect.stringMatching(/^studio-entry-2026-001-r1-/u),
      reviewUrl: expect.stringContaining("/dashboard/blog?edit="),
      contentHash: payload.contentHash,
      duplicate: false,
    }));
    const writes = mocks.transactionSet.mock.calls.map((call) => call[1]);
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "pending_approval", approvalStatus: "pending_approval" }),
      expect.objectContaining({ action: "studio.notebook-draft.created", teamId: "23247" }),
      expect.objectContaining({ editedBy: "ares-robotics-studio" }),
      expect.objectContaining({ installationId: INSTALLATION_ID, contentHash: payload.contentHash }),
      expect.objectContaining({ count: 1 }),
    ]));
    expect(JSON.stringify(writes)).not.toContain(TOKEN_SECRET);
  });

  it("returns the stored receipt for an idempotent retry without new writes", async () => {
    const payload = entry();
    transactionSnapshots({ receipt: {
      draftId: "studio-existing",
      reviewUrl: "https://aresfirst.org/dashboard/blog?edit=studio-existing",
      contentHash: payload.contentHash,
    } });
    const { res, next } = await invoke(payload);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(expect.objectContaining({ draftId: "studio-existing", duplicate: true }));
    expect(mocks.transactionSet).not.toHaveBeenCalled();
  });

  it("rejects unapproved, tampered, malformed, and wrongly scoped requests", async () => {
    const unapproved = entry({ reviewState: "REVIEWED" });
    let result = await invoke(unapproved);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_APPROVAL_REQUIRED" }));

    const tampered = { ...entry(), contentHash: "0".repeat(64) };
    result = await invoke(tampered);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_CONTENT_HASH_MISMATCH" }));

    const approved = entry();
    result = await invoke(approved, { is: vi.fn(() => false) });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ status: 415 }));
    result = await invoke(approved, { body: { ...approved, unknown: true } });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_PAYLOAD_INVALID" }));
    result = await invoke(approved, { get: vi.fn(() => undefined) });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_IDEMPOTENCY_KEY_INVALID" }));

    mocks.installationGet.mockResolvedValueOnce(snapshot(false));
    result = await invoke(approved);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_TOKEN_INVALID" }));

    mocks.installationGet.mockResolvedValueOnce(snapshot(true, installation({ allowedTeamIds: [], allowedWorkspaceIds: [] })));
    result = await invoke(approved);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_WORKSPACE_FORBIDDEN" }));
  });

  it("fails closed for invalid installation state and transaction conflicts", async () => {
    const payload = entry({ markdownBody: "No markdown heading" });
    for (const [overrides, code] of [
      [{ tokenHash: "0".repeat(64) }, "STUDIO_TOKEN_INVALID"],
      [{ expiresAt: "2000-01-01T00:00:00.000Z" }, "STUDIO_TOKEN_EXPIRED"],
      [{ scopes: [] }, "STUDIO_SCOPE_REQUIRED"],
    ] as const) {
      mocks.installationGet.mockResolvedValueOnce(snapshot(true, installation(overrides)));
      const result = await invoke(payload);
      expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code }));
    }

    transactionSnapshots({ quotaCount: 120 });
    let result = await invoke(payload);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_QUOTA_EXCEEDED" }));

    transactionSnapshots({ quotaCount: "broken" });
    result = await invoke(payload);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_QUOTA_INVALID" }));

    transactionSnapshots({ post: { studioContentHash: "0".repeat(64) } });
    result = await invoke(payload);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_DRAFT_CONFLICT" }));
  });

  it("rejects malformed authorization and invalid durable receipts", async () => {
    const payload = entry();
    let result = await invoke(payload, {
      get: vi.fn((name: string) => name.toLowerCase() === "idempotency-key"
        ? `${payload.entryId}:${payload.contentHash}`
        : "Bearer malformed"),
    });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_TOKEN_INVALID" }));

    transactionSnapshots({ receipt: { draftId: 1 } });
    result = await invoke(payload);
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ code: "STUDIO_RECEIPT_INVALID" }));
  });
});
