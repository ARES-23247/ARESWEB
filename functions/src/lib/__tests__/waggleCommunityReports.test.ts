import { describe, expect, it, vi } from "vitest";
import { createBlankLevel } from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";
import { evaluateWaggleProof } from "../waggleProof";
import {
  communityCard,
  prepareCommunityRevision,
  readCommunityHead,
} from "../waggleCommunityDomain";
import {
  WAGGLE_HEADS,
  WAGGLE_EVENTS,
  WAGGLE_RETENTION_MS,
} from "../waggleCommunityMutations";
import {
  createWaggleCommunityReports,
  WAGGLE_REPORTS,
} from "../waggleCommunityReports";
import { cleanupWaggleCommunity } from "../waggleCommunityCleanup";
import { WaggleStore } from "./helpers/waggleStore";

vi.mock("../firebase-admin", () => ({ adminDb: {}, adminAuth: {} }));
const time = "2026-09-06T00:00:00.000Z";
const later = "2027-09-06T00:00:00.000Z";
const identifier = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const level = createBlankLevel();
let run = applyCommand(level, createRun(level), { type: "start" });
while (run.phase !== "finished" && run.tick < 1800) run = stepRun(level, run);
const proof = evaluateWaggleProof(
  JSON.stringify({ level, replays: [captureReplay(level, run)] }),
);
function seed(db: WaggleStore, n: number, deleted = false) {
  const id = identifier(n);
  const revision = prepareCommunityRevision(
    id,
    1,
    { nickname: "Clover", difficulty: "gentle", estimatedLength: "short" },
    level,
    proof,
  );
  const head = readCommunityHead(
    {
      schema: 1,
      id,
      ownerUid: "private-creator",
      version: deleted ? 3 : 2,
      title: deleted ? "" : level.title,
      isDeleted: deleted,
      visibility: deleted ? "deleted" : "published",
      publishedRevision: deleted ? null : 1,
      candidateRevision: null,
      candidateStatus: null,
      publishedCard: deleted ? null : communityCard(revision),
      reviewReason: null,
      parent: null,
      publishedAt: deleted ? null : time,
      retireAt: deleted
        ? new Date(Date.parse(time) + WAGGLE_RETENTION_MS).toISOString()
        : null,
      createdAt: time,
      updatedAt: time,
    },
    id,
  );
  db.data.set(`${WAGGLE_HEADS}/${id}`, head);
  if (!deleted) db.data.set(`${WAGGLE_HEADS}/${id}/revisions/1`, revision);
  return head;
}
function setup() {
  const db = new WaggleStore();
  db.data.set("authorized_users/coach", { role: "coach" });
  db.data.set("authorized_users/admin", { role: "admin" });
  seed(db, 1);
  const service = createWaggleCommunityReports(db.firestore, () => time);
  return { db, service };
}
const records = (db: WaggleStore) =>
  [...db.data.entries()].filter(([path]) =>
    path.startsWith(WAGGLE_REPORTS + "/"),
  );

describe("community categorical reports", () => {
  it("deduplicates concurrent categories for the exact publication without reporter identities", async () => {
    const { db } = setup();
    const service = createWaggleCommunityReports(db.firestore);
    await Promise.all(
      Array.from({ length: 5 }, () =>
        service.report(identifier(1), { reason: "text" }),
      ),
    );
    expect(records(db)).toHaveLength(1);
    await service.report(identifier(1), { reason: "unsafe" });
    const page = await service.pending("coach");
    expect(page.reports).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    for (const report of page.reports) {
      expect(Object.keys(report).sort()).toEqual([
        "id",
        "levelId",
        "publication",
        "reason",
        "revision",
      ]);
      expect(report.publication?.version).toBe(2);
    }
    const stored = JSON.stringify(records(db));
    expect(stored).not.toMatch(
      /reporter|ipAddress|email|count|private-creator/u,
    );
    await service.resolve("admin", page.reports[0].id);
    await service.resolve("coach", page.reports[0].id);
    await service.report(identifier(1), { reason: page.reports[0].reason });
    expect((await service.pending("coach")).reports).toHaveLength(1);
  });
  it("paginates a bounded moderator queue and excludes expired records", async () => {
    const { db, service } = setup();
    for (let n = 1; n <= 14; n++) {
      seed(db, n);
      await service.report(identifier(n), { reason: "other" });
    }
    const [expiredPath, expired] = records(db)[0];
    db.data.set(expiredPath, {
      ...expired,
      createdAt: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-04-01T00:00:00.000Z",
    });
    const first = await service.pending("coach");
    const second = await service.pending("coach", { cursor: first.nextCursor });
    expect(first.reports).toHaveLength(12);
    expect(second.reports).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.reports, ...second.reports].map((r) => r.id)).size,
    ).toBe(13);
    for (const value of [
      { extra: true },
      { cursor: "" },
      { cursor: "not-json" },
      { cursor: "a".repeat(1025) },
      {
        cursor: Buffer.from(
          JSON.stringify({
            scope: "public",
            expiresAt: time,
            id: "a".repeat(64),
          }),
        ).toString("base64url"),
      },
      { cursor: first.nextCursor + "=" },
    ]) {
      await expect(service.pending("coach", value)).rejects.toMatchObject({
        status: 400,
      });
    }
  });
  it("removes publication content from reports when the target is gone, replaced or reused", async () => {
    const { db, service } = setup();
    await service.report(identifier(1), { reason: "identity" });
    const path = `${WAGGLE_HEADS}/${identifier(1)}`;
    const head = db.data.get(path)!;
    seed(db, 1, true);
    expect((await service.pending("coach")).reports[0].publication).toBeNull();
    db.data.delete(path);
    expect((await service.pending("coach")).reports[0].publication).toBeNull();
    db.data.set(path, { ...head, createdAt: later, updatedAt: later });
    expect((await service.pending("coach")).reports[0].publication).toBeNull();
    db.data.set(path, {
      ...head,
      version: 4,
      publishedRevision: 3,
      publishedCard: { ...(head.publishedCard as object), revision: 3 },
    });
    expect((await service.pending("coach")).reports[0].publication).toBeNull();
    db.data.set(path, head);
    expect(
      (await service.pending("coach")).reports[0].publication?.card.title,
    ).toBe(level.title);
  });
  it("requires current admin or coach authorization for queue and resolution", async () => {
    const { db, service } = setup();
    await service.report(identifier(1), { reason: "text" });
    const id = (await service.pending("coach")).reports[0].id;
    for (const actor of [
      undefined,
      { role: "member" },
      { role: "mentor" },
      { role: "coach", isDeleted: true },
      { role: "owner" },
    ]) {
      if (actor) db.data.set("authorized_users/test", actor);
      else db.data.delete("authorized_users/test");
      await expect(service.pending("test")).rejects.toMatchObject({
        status: 403,
      });
      await expect(service.resolve("test", id)).rejects.toMatchObject({
        status: 403,
      });
    }
    db.beforeTransaction = () =>
      db.data.set("authorized_users/coach", { role: "coach", isDeleted: 1 });
    await expect(service.resolve("coach", id)).rejects.toMatchObject({
      status: 403,
    });
    expect(records(db)[0][1].status).toBe("open");
  });
  it("rejects unbounded or forged input and unavailable publications before writing", async () => {
    const { db, service } = setup();
    for (const value of [
      null,
      {},
      { reason: "arbitrary text" },
      { reason: "text", message: "private" },
    ])
      await expect(service.report(identifier(1), value)).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      service.report("../private", { reason: "text" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.resolve("coach", "invalid")).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.resolve("coach", "a".repeat(64)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.report(identifier(2), { reason: "text" }),
    ).rejects.toMatchObject({ status: 404 });
    seed(db, 2, true);
    await expect(
      service.report(identifier(2), { reason: "text" }),
    ).rejects.toMatchObject({ status: 404 });
    const path = `${WAGGLE_HEADS}/${identifier(1)}`;
    const head = db.data.get(path)!;
    db.data.set(path, {
      ...head,
      publishedCard: { ...(head.publishedCard as object), title: "unreviewed" },
    });
    await expect(
      service.report(identifier(1), { reason: "text" }),
    ).rejects.toMatchObject({ status: 503 });
    db.data.set(path, head);
    db.data.delete(`${path}/revisions/1`);
    await expect(
      service.report(identifier(1), { reason: "text" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(records(db)).toHaveLength(0);
  });
  it("fails closed on corrupt records and propagates storage failures without success", async () => {
    const { db, service } = setup();
    await service.report(identifier(1), { reason: "text" });
    const [path, record] = records(db)[0];
    for (const bad of [
      { ...record, schema: 9 },
      { ...record, id: "a".repeat(64) },
      { ...record, levelId: identifier(2) },
      { ...record, expiresAt: later },
      { ...record, status: "resolved" },
      { ...record, resolvedBy: "coach" },
      {
        ...record,
        status: "resolved",
        resolvedBy: "coach",
        resolvedAt: "2025-01-01T00:00:00.000Z",
      },
    ]) {
      db.data.set(path, bad);
      await expect(
        service.report(identifier(1), { reason: "text" }),
      ).rejects.toMatchObject({ status: 503 });
      await expect(service.resolve("coach", record.id)).rejects.toMatchObject({
        status: 503,
      });
      if (bad.status === "open")
        await expect(service.pending("coach")).rejects.toMatchObject({
          status: 503,
        });
    }
    db.data.set(path, record);
    db.failRead = path;
    await expect(service.resolve("coach", record.id)).rejects.toThrow(
      "Storage unavailable",
    );
    db.failRead = WAGGLE_REPORTS;
    await expect(service.pending("coach")).rejects.toThrow(
      "Storage unavailable",
    );
    db.failRead = "";
    db.failWrite = path;
    await expect(service.resolve("coach", record.id)).rejects.toThrow(
      "Storage unavailable",
    );
    expect(db.data.get(path)?.status).toBe("open");
  });
});

describe("bounded community retirement", () => {
  it("purges only expired tombstones in bounded passes and preserves approved children", async () => {
    const { db } = setup();
    for (let n = 2; n <= 16; n++) seed(db, n, true);
    const child = seed(db, 17);
    db.data.set(`${WAGGLE_HEADS}/${child.id}`, {
      ...child,
      parent: {
        id: identifier(2),
        revision: 1,
        contentHash: proof.contentHash,
        createdAt: time,
      },
    });
    seed(db, 18, true);
    db.data.get(`${WAGGLE_HEADS}/${identifier(18)}`)!.retireAt =
      "2028-01-01T00:00:00.000Z";
    expect(await cleanupWaggleCommunity(db.firestore, new Date(later))).toEqual(
      { heads: 12, revisions: 0, reports: 0, events: 0 },
    );
    expect(
      (await cleanupWaggleCommunity(db.firestore, new Date(later))).heads,
    ).toBe(3);
    expect(
      (await cleanupWaggleCommunity(db.firestore, new Date(later))).heads,
    ).toBe(0);
    expect(db.data.has(`${WAGGLE_HEADS}/${child.id}/revisions/1`)).toBe(true);
    expect(db.data.has(`${WAGGLE_HEADS}/${identifier(1)}`)).toBe(true);
    expect(db.data.has(`${WAGGLE_HEADS}/${identifier(18)}`)).toBe(true);
  });
  it("retains a tombstone across partial revision batches and transaction failure", async () => {
    const { db } = setup();
    seed(db, 2, true);
    const path = `${WAGGLE_HEADS}/${identifier(2)}`;
    for (let n = 0; n < 27; n++)
      db.data.set(`${path}/revisions/${String(n).padStart(2, "0")}`, {
        leftover: true,
      });
    db.failWrite = `${path}/revisions/01`;
    await expect(
      cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).rejects.toThrow("Storage unavailable");
    expect(db.data.has(`${path}/revisions/00`)).toBe(true);
    db.failWrite = "";
    expect(
      await cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).toMatchObject({ heads: 0, revisions: 25 });
    expect(db.data.has(path)).toBe(true);
    expect(
      await cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).toMatchObject({ heads: 1, revisions: 2 });
    expect(db.data.has(path)).toBe(false);
  });
  it("rechecks tombstones and expiry after query races, including disappearing records", async () => {
    const { db } = setup();
    seed(db, 2, true);
    const path = `${WAGGLE_HEADS}/${identifier(2)}`;
    db.beforeTransaction = () => {
      db.data.delete(path);
      db.beforeTransaction = null;
    };
    expect(
      (await cleanupWaggleCommunity(db.firestore, new Date(later))).heads,
    ).toBe(0);
    seed(db, 2, true);
    db.beforeTransaction = () => {
      seed(db, 2);
      db.beforeTransaction = null;
    };
    expect(
      (await cleanupWaggleCommunity(db.firestore, new Date(later))).heads,
    ).toBe(0);
    for (const next of [null, { expiresAt: "2028-01-01T00:00:00.000Z" }]) {
      db.data.set(`${WAGGLE_REPORTS}/expired`, { expiresAt: time });
      db.beforeTransaction = () => {
        if (next) db.data.set(`${WAGGLE_REPORTS}/expired`, next);
        else db.data.delete(`${WAGGLE_REPORTS}/expired`);
        db.beforeTransaction = null;
      };
      expect(
        (await cleanupWaggleCommunity(db.firestore, new Date(later))).reports,
      ).toBe(0);
    }
  });
  it("bounds report and audit expiry independently and leaves fresh metadata intact", async () => {
    const { db } = setup();
    for (let n = 0; n < 27; n++) {
      db.data.set(`${WAGGLE_REPORTS}/${n}`, { expiresAt: time });
      db.data.set(`${WAGGLE_EVENTS}/${n}`, { expiresAt: new Date(time) });
    }
    db.data.set(`${WAGGLE_EVENTS}/fresh`, {
      expiresAt: new Date("2028-01-01T00:00:00.000Z"),
    });
    expect(
      await cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).toMatchObject({ reports: 25, events: 25 });
    expect(
      await cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).toMatchObject({ reports: 2, events: 2 });
    expect(await cleanupWaggleCommunity(db.firestore)).toMatchObject({
      reports: 0,
      events: 0,
    });
    expect(db.data.has(`${WAGGLE_EVENTS}/fresh`)).toBe(true);
  });
  it("does not delete metadata if expiry becomes malformed between scan and transaction", async () => {
    const { db } = setup();
    db.data.set(`${WAGGLE_REPORTS}/expired`, { expiresAt: time });
    db.beforeTransaction = () => {
      db.data.set(`${WAGGLE_REPORTS}/expired`, { expiresAt: "invalid" });
      db.beforeTransaction = null;
    };
    await expect(
      cleanupWaggleCommunity(db.firestore, new Date(later)),
    ).rejects.toMatchObject({ status: 503 });
    expect(db.data.has(`${WAGGLE_REPORTS}/expired`)).toBe(true);
  });
});
