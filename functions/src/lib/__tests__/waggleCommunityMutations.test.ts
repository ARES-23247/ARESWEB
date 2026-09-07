import { describe, expect, it, vi } from "vitest";
import {
  createBlankLevel,
  type LevelDefinition,
} from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";
import { evaluateWaggleProof } from "../waggleProof";
import {
  createWaggleCommunityMutations,
  WAGGLE_EVENTS,
  WAGGLE_HEADS,
  WAGGLE_LIMITS,
  WAGGLE_RETENTION_MS,
} from "../waggleCommunityMutations";
import type {
  CommunityHead,
  CommunityRevision,
} from "../waggleCommunityDomain";

vi.mock("../firebase-admin", () => ({ adminDb: {}, adminAuth: {} }));
type Data = Record<string, unknown>;
class MemoryDb {
  data = new Map<string, Data>();
  queue: Promise<unknown> = Promise.resolve();
  failWrite = "";
  failRead = "";
  doc(path: string) {
    return {
      path,
      id: path.split("/").at(-1)!,
      get: async () => this.snapshot(path),
      collection: (name: string) => this.collection(`${path}/${name}`),
    };
  }
  snapshot(path: string) {
    if (path === this.failRead) throw new Error("Storage unavailable");
    const value = this.data.get(path);
    return {
      id: path.split("/").at(-1)!,
      exists: value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
    };
  }
  collection(path: string, filters: [string, unknown][] = [], cap = Infinity) {
    return {
      path,
      filters,
      cap,
      doc: (id: string) => this.doc(`${path}/${id}`),
      where: (field: string, operator: string, value: unknown) => {
        expect(operator).toBe("==");
        return this.collection(path, [...filters, [field, value]], cap);
      },
      limit: (count: number) => this.collection(path, filters, count),
    };
  }
  runTransaction<T>(
    callback: (tx: {
      get: (
        ref: ReturnType<MemoryDb["doc"]> | ReturnType<MemoryDb["collection"]>,
      ) => Promise<unknown>;
      set: (ref: ReturnType<MemoryDb["doc"]>, data: Data) => void;
      delete: (ref: ReturnType<MemoryDb["doc"]>) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const result = this.queue.then(async () => {
      const writes: Array<[string, Data | null]> = [];
      const value = await callback({
        get: async (ref) => {
          if (writes.length)
            throw new Error("Firestore reads must precede writes");
          if ("filters" in ref) {
            expect(ref.cap).toBeLessThanOrEqual(21);
            const docs = [...this.data.keys()]
              .filter(
                (path) =>
                  path.startsWith(ref.path + "/") &&
                  !path.slice(ref.path.length + 1).includes("/"),
              )
              .filter((path) =>
                ref.filters.every(
                  ([field, expected]) =>
                    this.data.get(path)![field] === expected,
                ),
              )
              .slice(0, ref.cap)
              .map((path) => this.snapshot(path));
            return { docs, size: docs.length, empty: docs.length === 0 };
          }
          return this.snapshot(ref.path);
        },
        set: (ref, data) => {
          if (ref.path === this.failWrite)
            throw new Error("Storage unavailable");
          writes.push([ref.path, structuredClone(data)]);
        },
        delete: (ref) => {
          writes.push([ref.path, null]);
        },
      });
      for (const [path, data] of writes) {
        if (data === null) this.data.delete(path);
        else this.data.set(path, data);
      }
      return value;
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  actor(uid: string, role = "member", extra: Data = {}) {
    this.data.set(`authorized_users/${uid}`, { role, ...extra });
  }
  head(id: string) {
    return this.data.get(`${WAGGLE_HEADS}/${id}`) as unknown as CommunityHead;
  }
  revision(id: string, revision: number) {
    return this.data.get(
      `${WAGGLE_HEADS}/${id}/revisions/${revision}`,
    ) as unknown as CommunityRevision;
  }
  limits(uid: string) {
    return this.data.get(`${WAGGLE_LIMITS}/${uid}`);
  }
}
const identifier = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const id = identifier(1);
const level = createBlankLevel();
const metadata = {
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
};
function submission(
  expectedVersion = 0,
  garden: LevelDefinition = level,
  parent?: { id: string; revision: number },
) {
  let run = applyCommand(garden, createRun(garden), { type: "start" });
  while (run.phase !== "finished" && run.tick < 1800)
    run = stepRun(garden, run);
  return JSON.stringify({
    expectedVersion,
    metadata,
    proof: { level: garden, replays: [captureReplay(garden, run)] },
    ...(parent ? { parent } : {}),
  });
}
function setup() {
  const db = new MemoryDb();
  db.actor("creator");
  db.actor("coach", "coach");
  db.actor("admin", "admin");
  db.actor("other");
  const verifier = vi.fn(async (payload: string) =>
    evaluateWaggleProof(payload),
  );
  const service = createWaggleCommunityMutations(
    db as unknown as FirebaseFirestore.Firestore,
    verifier,
  );
  const approve = async (gardenId = id, actor = "coach") =>
    service.decide(actor, gardenId, {
      expectedVersion: db.head(gardenId).version,
      reviewDigest: db.revision(gardenId, db.head(gardenId).candidateRevision!)
        .reviewDigest,
      decision: "approve",
    });
  return { db, verifier, service, approve };
}

describe("community transactional publication", () => {
  it("submits, approves and rejects edits while preserving the published revision", async () => {
    const { db, service, approve } = setup();
    const created = await service.submit("creator", id, submission());
    expect(created).toMatchObject({
      id,
      status: "pending",
      version: 1,
      publishedRevision: null,
    });
    expect(JSON.stringify(created)).not.toMatch(
      /ownerUid|creator|verification/u,
    );
    expect(db.limits("creator")).toMatchObject({ active: 1, pending: 1 });
    const published = await approve();
    expect(published).toMatchObject({
      status: "published",
      version: 2,
      publishedRevision: 1,
    });
    expect(db.limits("creator")).toMatchObject({ active: 1, pending: 0 });
    const original = db.revision(id, 1);
    await service.submit(
      "creator",
      id,
      submission(2, { ...level, title: "A changed garden" }),
    );
    expect(db.head(id).publishedCard!.title).toBe(level.title);
    const rejected = await service.decide("admin", id, {
      expectedVersion: 3,
      reviewDigest: db.revision(id, 3).reviewDigest,
      decision: "reject",
      reason: "text",
    });
    expect(rejected).toMatchObject({
      status: "rejected",
      publishedRevision: 1,
      candidateRevision: 3,
      reviewReason: "text",
      version: 4,
    });
    expect(db.revision(id, 1)).toEqual(original);
    expect(db.limits("creator")).toMatchObject({ active: 1, pending: 0 });
    await service.submit("creator", id, submission(4));
    expect(db.revision(id, 3)).toBeUndefined();
    await approve(id, "admin");
    expect(db.head(id).publishedRevision).toBe(5);
    expect(db.revision(id, 1)).toBeUndefined();
    const event = db.data.get(`${WAGGLE_EVENTS}/${id}_6`)!;
    expect(event).toMatchObject({ action: "approve", actorUid: "admin" });
    expect(
      (event.expiresAt as Date).getTime() -
        Date.parse(event.createdAt as string),
    ).toBe(WAGGLE_RETENTION_MS);
  });
  it("rechecks authorization after proof work and rejects cross-owner or stale actions", async () => {
    const { db, service, verifier, approve } = setup();
    for (const role of ["unknown", "unverified"]) {
      db.actor("creator", role);
      await expect(
        service.submit("creator", id, submission()),
      ).rejects.toMatchObject({ status: 403 });
    }
    db.actor("creator", "member", { isDeleted: 1 });
    await expect(
      service.submit("creator", id, submission()),
    ).rejects.toMatchObject({ status: 403 });
    expect(verifier).not.toHaveBeenCalled();
    db.actor("creator");
    verifier.mockImplementationOnce(async (payload) => {
      const result = evaluateWaggleProof(payload);
      db.actor("creator", "member", { isDeleted: true });
      return result;
    });
    await expect(
      service.submit("creator", id, submission()),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.head(id)).toBeUndefined();
    db.actor("creator", "student");
    await service.submit("creator", id, submission());
    await expect(
      service.submit("other", id, submission(1)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.submit("creator", id, submission(0)),
    ).rejects.toMatchObject({ status: 409 });
    db.actor("mentor", "lead");
    await expect(approve(id, "mentor")).rejects.toMatchObject({ status: 403 });
    db.actor("coach", "coach", { isDeleted: true });
    await expect(approve()).rejects.toMatchObject({ status: 403 });
    await expect(
      service.removeOwn("other", id, { expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.removeOwn("creator", identifier(9), { expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("serializes competing submissions so only one consumes the head and pending slot", async () => {
    const { db, service } = setup();
    const results = await Promise.allSettled([
      service.submit("creator", id, submission()),
      service.submit("creator", id, submission()),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { status: 409 } });
    expect(db.limits("creator")).toMatchObject({ active: 1, pending: 1 });
    expect(db.head(id).version).toBe(1);
  });
  it("enforces the pending cap, replaces an existing candidate, and releases capacity once", async () => {
    const { db, service } = setup();
    for (let n = 1; n <= 3; n++)
      await service.submit("creator", identifier(n), submission());
    await expect(
      service.submit("creator", identifier(4), submission()),
    ).rejects.toMatchObject({ code: "WAGGLE_CREATOR_CAPACITY" });
    await service.submit("creator", id, submission(1));
    expect(db.limits("creator")).toMatchObject({ active: 3, pending: 3 });
    expect(db.revision(id, 1)).toBeUndefined();
    const deleted = await service.removeOwn("creator", id, {
      expectedVersion: 2,
    });
    expect(deleted).toMatchObject({ status: "deleted", title: "", version: 3 });
    expect(db.head(id).parent).toBeNull();
    expect(db.head(id).retireAt).not.toBeNull();
    expect(db.revision(id, 2)).toBeUndefined();
    await service.removeOwn("creator", id, { expectedVersion: 3 });
    expect(db.limits("creator")).toMatchObject({ active: 2, pending: 2 });
    await expect(
      service.removeOwn("creator", id, { expectedVersion: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit("creator", id, submission(3)),
    ).rejects.toMatchObject({ status: 409 });
    await service.submit("creator", identifier(4), submission());
  });
  it("caps all active heads even when none is pending", async () => {
    const { db, service, approve } = setup();
    for (let n = 1; n <= 20; n++) {
      await service.submit("creator", identifier(n), submission());
      await approve(identifier(n));
    }
    expect(db.limits("creator")).toMatchObject({ active: 20, pending: 0 });
    await expect(
      service.submit("creator", identifier(21), submission()),
    ).rejects.toMatchObject({ code: "WAGGLE_CREATOR_CAPACITY" });
    await service.removeOwn("creator", id, { expectedVersion: 2 });
    await service.submit("creator", identifier(21), submission());
  });
  it("preserves approved remixes after parent deletion and prevents new or unapproved publication", async () => {
    const { db, service, approve } = setup();
    await service.submit("creator", id, submission());
    await approve();
    const parentHash = db.revision(id, 1).verification.contentHash;
    await service.submit(
      "other",
      identifier(2),
      submission(0, level, { id, revision: 1 }),
    );
    await approve(identifier(2));
    await service.submit(
      "other",
      identifier(3),
      submission(0, level, { id, revision: 1 }),
    );
    await service.removeOwn("creator", id, { expectedVersion: 2 });
    expect(db.head(identifier(2))).toMatchObject({
      visibility: "published",
      parent: { id, revision: 1, contentHash: parentHash },
    });
    expect(db.revision(identifier(2), 1)).toBeDefined();
    expect(db.revision(id, 1)).toBeUndefined();
    await expect(approve(identifier(3))).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit(
        "other",
        identifier(4),
        submission(0, level, { id, revision: 1 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit("other", identifier(3), submission(1)),
    ).rejects.toMatchObject({ status: 409 });
    await service.submit("other", identifier(2), submission(2));
    await approve(identifier(2));
    expect(db.head(identifier(2)).visibility).toBe("published");
    await service.removePublished("coach", identifier(2), {
      expectedVersion: 4,
      reason: "unsafe",
    });
    expect(db.head(identifier(2)).visibility).toBe("removed");
  });
  it("does not let a reused parent identifier revive an unapproved remix", async () => {
    const { db, service, approve } = setup();
    await service.submit("creator", id, submission());
    await approve();
    const original = structuredClone(db.head(id));
    const revision = structuredClone(db.revision(id, 1));
    await service.submit(
      "other",
      identifier(2),
      submission(0, level, { id, revision: 1 }),
    );
    expect(db.head(identifier(2)).parent?.createdAt).toBe(original.createdAt);
    await service.removeOwn("creator", id, { expectedVersion: 2 });
    // Model a new publication at the same ID after the old tombstone expires.
    db.data.set(`${WAGGLE_HEADS}/${id}`, {
      ...original,
      createdAt: "2027-01-01T00:00:00.000Z",
      updatedAt: "2027-01-01T00:00:00.000Z",
    });
    db.data.set(`${WAGGLE_HEADS}/${id}/revisions/1`, revision);
    await expect(approve(identifier(2))).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit("other", identifier(2), submission(1)),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.head(identifier(2)).version).toBe(1);
    expect(db.limits("other")).toMatchObject({ active: 1, pending: 1 });
  });
  it("rejects invalid parent lineage, corrupted evidence and incorrect review decisions", async () => {
    const { db, service, approve } = setup();
    await expect(
      service.submit("creator", id, submission(0, level, { id, revision: 1 })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.submit(
        "creator",
        id,
        submission(0, level, { id: identifier(2), revision: 1 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await service.submit("creator", id, submission());
    await expect(
      service.submit(
        "other",
        identifier(2),
        submission(0, level, { id, revision: 1 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.removePublished("coach", id, {
        expectedVersion: 1,
        reason: "unsafe",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.decide("coach", id, {
        expectedVersion: 1,
        reviewDigest: "0".repeat(64),
        decision: "approve",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.decide("coach", id, {
        expectedVersion: 1,
        reviewDigest: "0".repeat(64),
        decision: "reject",
      }),
    ).rejects.toMatchObject({ status: 400 });
    const saved = db.revision(id, 1);
    db.data.delete(`${WAGGLE_HEADS}/${id}/revisions/1`);
    await expect(
      service.decide("coach", id, {
        expectedVersion: 1,
        reviewDigest: saved.reviewDigest,
        decision: "approve",
      }),
    ).rejects.toMatchObject({ status: 503 });
    db.data.set(`${WAGGLE_HEADS}/${id}/revisions/1`, {
      ...saved,
      reviewDigest: "0".repeat(64),
    });
    await expect(approve()).rejects.toMatchObject({ status: 503 });
    db.data.set(`${WAGGLE_HEADS}/${id}/revisions/1`, { ...saved });
    await approve();
    await expect(
      service.decide("coach", id, {
        expectedVersion: 2,
        reviewDigest: saved.reviewDigest,
        decision: "approve",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit(
        "other",
        identifier(2),
        submission(0, level, { id, revision: 2 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await service.submit(
      "other",
      identifier(2),
      submission(0, level, { id, revision: 1 }),
    );
    await expect(
      service.submit(
        "other",
        identifier(2),
        submission(1, level, { id: identifier(3), revision: 1 }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await service.removePublished("coach", id, {
      expectedVersion: 2,
      reason: "unsafe",
    });
    await expect(
      service.submit("creator", id, submission(3)),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("fails closed on malformed input, storage failures, and missing or corrupted capacity records", async () => {
    const { db, service, verifier } = setup();
    for (const body of [
      "{",
      "{}",
      JSON.stringify({ ...JSON.parse(submission()), ownerUid: "other" }),
      JSON.stringify({ ...JSON.parse(submission()), expectedVersion: -1 }),
    ])
      await expect(service.submit("creator", id, body)).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      service.submit("creator", id, "é".repeat(768 * 1024)),
    ).rejects.toMatchObject({ status: 413 });
    expect(verifier).not.toHaveBeenCalled();
    await expect(service.removeOwn("creator", id, {})).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.removePublished("coach", id, { expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 400 });
    db.failWrite = `${WAGGLE_HEADS}/${id}`;
    await expect(service.submit("creator", id, submission())).rejects.toThrow(
      "Storage unavailable",
    );
    expect(db.limits("creator")).toBeUndefined();
    db.failWrite = "";
    await service.submit("creator", id, submission());
    const limits = db.limits("creator")!;
    db.data.delete(`${WAGGLE_LIMITS}/creator`);
    await expect(
      service.submit("creator", identifier(2), submission()),
    ).rejects.toMatchObject({ status: 503 });
    db.data.set(`${WAGGLE_LIMITS}/creator`, {
      ...limits,
      active: 0,
      pending: 0,
    });
    await expect(
      service.removeOwn("creator", id, { expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 503 });
    db.data.set(`${WAGGLE_LIMITS}/creator`, limits);
    db.failRead = `${WAGGLE_HEADS}/${id}`;
    await expect(service.submit("creator", id, submission(1))).rejects.toThrow(
      "Storage unavailable",
    );
  });
});
