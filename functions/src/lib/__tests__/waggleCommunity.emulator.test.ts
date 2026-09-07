import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb } from "../firebase-admin";
import {
  createWaggleCommunityMutations,
  WAGGLE_EVENTS,
  WAGGLE_HEADS,
  WAGGLE_LIMITS,
} from "../waggleCommunityMutations";
import { evaluateWaggleProof } from "../waggleProof";
import { createWaggleCommunityReads } from "../waggleCommunityReads";
import {
  createWaggleCommunityReports,
  WAGGLE_REPORTS,
} from "../waggleCommunityReports";
import { cleanupWaggleCommunity } from "../waggleCommunityCleanup";
import { createBlankLevel } from "../../generated/games/waggle-way/level";
import {
  createRun,
  applyCommand,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";
const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (emulator && !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/u.test(emulator))
  throw new Error("Community tests require a local Firestore emulator.");

describe.skipIf(!emulator)(
  "community publication with native Firestore transactions",
  () => {
    const ids: string[] = [];
    const actors: string[] = [];
    const gardenId = () => {
      const id = randomUUID();
      ids.push(id);
      return id;
    };
    async function actor(role = "member") {
      const uid = `waggle-emulator-${randomUUID()}`;
      actors.push(uid);
      await adminDb
        .collection("authorized_users")
        .doc(uid)
        .set({ role, isDeleted: false });
      return uid;
    }
    const level = createBlankLevel();
    level.inventory = [
      {
        id: "fan",
        kind: "fan",
        count: 1,
        width: 1,
        height: 1,
        direction: 0,
        range: 2,
        strength: 1,
      },
    ];
    let run = applyCommand(level, createRun(level), { type: "start" });
    while (run.phase !== "finished" && run.tick < 1800)
      run = stepRun(level, run);
    const request = JSON.stringify({
      expectedVersion: 0,
      metadata: {
        nickname: "Clover",
        difficulty: "gentle",
        estimatedLength: "short",
      },
      proof: { level, replays: [captureReplay(level, run)] },
    });
    // Canonical proof computation is inline to isolate database races from the
    // intentional one-worker limit. A separate integration test covers that worker.
    const service = createWaggleCommunityMutations(adminDb, async (payload) =>
      evaluateWaggleProof(payload),
    );
    const reads = createWaggleCommunityReads(adminDb);
    const reports = createWaggleCommunityReports(adminDb);
    afterAll(async () => {
      for (const id of ids) {
        await adminDb.recursiveDelete(adminDb.collection(WAGGLE_HEADS).doc(id));
        const events = await adminDb
          .collection(WAGGLE_EVENTS)
          .where("levelId", "==", id)
          .limit(100)
          .get();
        const batch = adminDb.batch();
        events.docs.forEach((event) => batch.delete(event.ref));
        const reported = await adminDb
          .collection(WAGGLE_REPORTS)
          .where("levelId", "==", id)
          .limit(100)
          .get();
        reported.docs.forEach((report) => batch.delete(report.ref));
        await batch.commit();
      }
      for (const uid of actors) {
        await adminDb.collection("authorized_users").doc(uid).delete();
        await adminDb.collection(WAGGLE_LIMITS).doc(uid).delete();
      }
    });
    it("commits only one competing revision and atomically publishes then purges it", async () => {
      const uid = await actor();
      const coach = await actor("coach");
      const id = gardenId();
      const results = await Promise.allSettled([
        service.submit(uid, id, request),
        service.submit(uid, id, request),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ reason: { status: 409 } });
      const revision = await adminDb
        .collection(WAGGLE_HEADS)
        .doc(id)
        .collection("revisions")
        .doc("1")
        .get();
      const approved = await service.decide(coach, id, {
        expectedVersion: 1,
        reviewDigest: revision.data()!.reviewDigest,
        decision: "approve",
      });
      expect(approved).toMatchObject({
        status: "published",
        publishedRevision: 1,
        version: 2,
      });
      expect((await reads.get(id)).id).toBe(id);
      expect((await reads.mine(uid))[0].status).toBe("published");
      expect((await reads.getOwn(uid, id)).level.title).toBe(level.title);
      expect(
        (await adminDb.collection(WAGGLE_LIMITS).doc(uid).get()).data(),
      ).toMatchObject({ active: 1, pending: 0 });
      await service.removeOwn(uid, id, { expectedVersion: 2 });
      await expect(reads.get(id)).rejects.toMatchObject({ status: 404 });
      expect((await revision.ref.get()).exists).toBe(false);
      expect(
        (await adminDb.collection(WAGGLE_LIMITS).doc(uid).get()).data(),
      ).toMatchObject({ active: 0, pending: 0 });
    });
    it("admits only one of two submissions competing for the last pending slot", async () => {
      const uid = await actor();
      await service.submit(uid, gardenId(), request);
      await service.submit(uid, gardenId(), request);
      const results = await Promise.allSettled([
        service.submit(uid, gardenId(), request),
        service.submit(uid, gardenId(), request),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ reason: { code: "WAGGLE_CREATOR_CAPACITY" } });
      expect(
        (await adminDb.collection(WAGGLE_LIMITS).doc(uid).get()).data(),
      ).toMatchObject({ active: 3, pending: 3 });
    });
    it("rechecks an authorization archived during verification without creating a record", async () => {
      const uid = await actor();
      const id = gardenId();
      const delayed = createWaggleCommunityMutations(
        adminDb,
        async (payload) => {
          const result = evaluateWaggleProof(payload);
          await adminDb
            .collection("authorized_users")
            .doc(uid)
            .update({ isDeleted: 1 });
          return result;
        },
      );
      await expect(delayed.submit(uid, id, request)).rejects.toMatchObject({
        status: 403,
      });
      expect(
        (await adminDb.collection(WAGGLE_HEADS).doc(id).get()).exists,
      ).toBe(false);
      expect(
        (await adminDb.collection(WAGGLE_LIMITS).doc(uid).get()).exists,
      ).toBe(false);
    });
    it("uses native compound queries and cursors for pending review and approved discovery", async () => {
      const coach = await actor("coach");
      const created: string[] = [];
      for (let n = 0; n < 13; n++) {
        const uid = await actor();
        const id = gardenId();
        await service.submit(uid, id, request);
        created.push(id);
      }
      const pending = await reads.pending(coach);
      expect(pending.gardens).toHaveLength(12);
      const remaining = await reads.pending(coach, {
        cursor: pending.nextCursor,
      });
      const queued = [...pending.gardens, ...remaining.gardens].map(
        (garden) => garden.id,
      );
      expect(new Set(queued).size).toBe(queued.length);
      for (const id of created) {
        expect(queued).toContain(id);
        const review = await reads.review(coach, id);
        await service.decide(coach, id, {
          expectedVersion: review.garden.version,
          reviewDigest: review.reviewDigest,
          decision: "approve",
        });
      }
      const filters = {
        mechanic: "fan",
        difficulty: "gentle",
        estimatedLength: "short",
      };
      const page = await reads.browse(filters);
      expect(page.gardens).toHaveLength(12);
      const next = await reads.browse({ ...filters, cursor: page.nextCursor });
      expect(next.gardens).toHaveLength(1);
      expect(next.nextCursor).toBeNull();
      expect(
        new Set([...page.gardens, ...next.gardens].map((garden) => garden.id)),
      ).toEqual(new Set(created));
      for (const id of created) await reports.report(id, { reason: "text" });
      const firstReports = await reports.pending(coach);
      const nextReports = await reports.pending(coach, {
        cursor: firstReports.nextCursor,
      });
      expect(firstReports.reports).toHaveLength(12);
      expect(nextReports.reports).toHaveLength(1);
      expect(
        new Set(
          [...firstReports.reports, ...nextReports.reports].map(
            (report) => report.levelId,
          ),
        ),
      ).toEqual(new Set(created));
    }, 30000);
    it("deduplicates reports and retires deleted content without touching surviving publications", async () => {
      const uid = await actor();
      const coach = await actor("coach");
      const id = gardenId();
      await service.submit(uid, id, request);
      const review = await reads.review(coach, id);
      await service.decide(coach, id, {
        expectedVersion: 1,
        reviewDigest: review.reviewDigest,
        decision: "approve",
      });
      await Promise.all(
        Array.from({ length: 3 }, () =>
          reports.report(id, { reason: "unsafe" }),
        ),
      );
      const saved = await adminDb
        .collection(WAGGLE_REPORTS)
        .where("levelId", "==", id)
        .limit(6)
        .get();
      expect(saved.size).toBe(1);
      await reports.resolve(coach, saved.docs[0].id);
      await reports.resolve(coach, saved.docs[0].id);
      expect((await saved.docs[0].ref.get()).data()?.status).toBe("resolved");
      await service.removeOwn(uid, id, { expectedVersion: 2 });
      // Exercise resumable revision cleanup with native transaction ordering.
      await adminDb
        .collection(WAGGLE_HEADS)
        .doc(id)
        .collection("revisions")
        .doc("leftover")
        .set({ stale: true });
      const retired = await cleanupWaggleCommunity(
        adminDb,
        new Date(Date.now() + 91 * 24 * 60 * 60 * 1000),
      );
      expect(retired.heads).toBeGreaterThanOrEqual(1);
      expect(retired.revisions).toBe(1);
      expect(
        (await adminDb.collection(WAGGLE_HEADS).doc(id).get()).exists,
      ).toBe(false);
      expect((await saved.docs[0].ref.get()).exists).toBe(false);
      expect((await reads.browse()).gardens.length).toBeGreaterThan(0);
    }, 30000);
  },
);
