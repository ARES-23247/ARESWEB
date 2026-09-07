import { describe, expect, it, vi } from "vitest";
import {
  createBlankLevel,
  serializeLevel,
  parseLevelFile,
} from "../../generated/games/waggle-way/level";
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
  type CommunityHead,
} from "../waggleCommunityDomain";
import { createWaggleCommunityReads } from "../waggleCommunityReads";
import { WAGGLE_HEADS } from "../waggleCommunityMutations";

vi.mock("../firebase-admin", () => ({ adminDb: {}, adminAuth: {} }));
type Data = Record<string, unknown>;
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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
while (run.phase !== "finished" && run.tick < 1800) run = stepRun(level, run);
const proof = evaluateWaggleProof(
  JSON.stringify({ level, replays: [captureReplay(level, run)] }),
);
const metadata = {
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
};
const time = "2026-09-06T12:00:00.000Z";
class ReadStore {
  data = new Map<string, unknown>();
  requests: Query[] = [];
  failPath = "";
  failQuery = false;
  doc(path: string) {
    return {
      path,
      collection: (name: string) => this.collection(`${path}/${name}`),
    };
  }
  collection(path: string): Query {
    return new Query(this, path);
  }
  snapshot(path: string) {
    if (this.failPath === path) throw new Error("Storage unavailable");
    const value = this.data.get(path);
    return {
      id: path.split("/").at(-1)!,
      exists: value !== undefined,
      data: () => structuredClone(value),
    };
  }
  async runTransaction<T>(
    callback: (tx: {
      get: (ref: Query | { path: string }) => Promise<unknown>;
    }) => Promise<T>,
    options: unknown,
  ) {
    expect(options).toEqual({ readOnly: true });
    return callback({
      get: async (ref) =>
        ref instanceof Query ? ref.result() : this.snapshot(ref.path),
    });
  }
  actor(uid: string, role: string, isDeleted: unknown = false) {
    this.data.set(`authorized_users/${uid}`, { role, isDeleted });
  }
  head(n: number) {
    return this.data.get(`${WAGGLE_HEADS}/${id(n)}`) as CommunityHead;
  }
  seed(
    n: number,
    visibility: "private" | "published" = "published",
    ownerUid = "creator",
  ) {
    const revision = prepareCommunityRevision(id(n), 1, metadata, level, proof);
    const published = visibility === "published";
    const head = readCommunityHead(
      {
        schema: 1,
        id: id(n),
        ownerUid,
        version: published ? 2 : 1,
        title: level.title,
        isDeleted: false,
        visibility,
        publishedRevision: published ? 1 : null,
        candidateRevision: published ? null : 1,
        candidateStatus: published ? null : "pending",
        publishedCard: published ? communityCard(revision) : null,
        reviewReason: null,
        parent: null,
        publishedAt: published ? time : null,
        retireAt: null,
        createdAt: time,
        updatedAt: time,
      },
      id(n),
    );
    this.data.set(`${WAGGLE_HEADS}/${id(n)}`, head);
    this.data.set(`${WAGGLE_HEADS}/${id(n)}/revisions/1`, revision);
    return head;
  }
}
class Query {
  filters: Array<[string, string, unknown]> = [];
  orders: Array<[string, string]> = [];
  cap = Infinity;
  after: unknown[] = [];
  constructor(
    readonly store: ReadStore,
    readonly path: string,
  ) {}
  doc(value: string) {
    return this.store.doc(`${this.path}/${value}`);
  }
  copy() {
    const query = new Query(this.store, this.path);
    query.filters = [...this.filters];
    query.orders = [...this.orders];
    query.cap = this.cap;
    query.after = [...this.after];
    return query;
  }
  where(field: string, operator: string, value: unknown) {
    const query = this.copy();
    query.filters.push([field, operator, value]);
    return query;
  }
  orderBy(field: unknown, direction: string) {
    const query = this.copy();
    query.orders.push([String(field), direction]);
    return query;
  }
  limit(value: number) {
    const query = this.copy();
    query.cap = value;
    return query;
  }
  startAfter(...values: unknown[]) {
    const query = this.copy();
    query.after = values;
    return query;
  }
  field(document: { id: string; data: () => unknown }, field: string): unknown {
    if (field === "__name__") return document.id;
    return field
      .split(".")
      .reduce<unknown>((value, key) => (value as Data)?.[key], document.data());
  }
  result() {
    if (this.store.failQuery) throw new Error("Query unavailable");
    expect(this.cap).toBeLessThanOrEqual(21);
    this.store.requests.push(this);
    let docs = [...this.store.data.keys()]
      .filter(
        (path) =>
          path.startsWith(this.path + "/") &&
          !path.slice(this.path.length + 1).includes("/"),
      )
      .map((path) => this.store.snapshot(path))
      .filter((doc) =>
        this.filters.every(([field, op, value]) => {
          const actual = this.field(doc, field);
          return op === "array-contains"
            ? (actual as unknown[]).includes(value)
            : actual === value;
        }),
      );
    const compare = (a: unknown[], b: unknown[]) => {
      for (let i = 0; i < this.orders.length; i++) {
        const difference = String(a[i]).localeCompare(String(b[i]));
        if (difference)
          return difference * (this.orders[i][1] === "desc" ? -1 : 1);
      }
      return 0;
    };
    const values = (doc: (typeof docs)[number]) =>
      this.orders.map(([field]) => this.field(doc, field));
    docs.sort((a, b) => compare(values(a), values(b)));
    if (this.after.length)
      docs = docs.filter((doc) => compare(values(doc), this.after) > 0);
    docs = docs.slice(0, this.cap);
    return { docs, size: docs.length };
  }
}
function setup() {
  const db = new ReadStore();
  db.actor("creator", "member");
  db.actor("coach", "coach");
  db.actor("admin", "admin");
  return {
    db,
    reads: createWaggleCommunityReads(
      db as unknown as FirebaseFirestore.Firestore,
    ),
  };
}

describe("community bounded reads", () => {
  it("pages only approved non-deleted revisions with stable tie ordering and explicit DTOs", async () => {
    const { db, reads } = setup();
    for (let n = 1; n <= 14; n++) db.seed(n);
    db.seed(15, "private");
    const first = await reads.browse();
    expect(first.gardens.map((garden) => garden.id)).toEqual(
      Array.from({ length: 12 }, (_, n) => id(n + 1)),
    );
    expect(first.nextCursor).toBeTypeOf("string");
    const next = await reads.browse({ cursor: first.nextCursor });
    expect(db.requests[1].orders).toEqual([
      ["publishedAt", "desc"],
      ["__name__", "asc"],
    ]);
    expect(db.requests[1].after).toEqual([time, id(12)]);
    expect(next.gardens.map((garden) => garden.id)).toEqual([id(13), id(14)]);
    expect(next.nextCursor).toBeNull();
    expect(JSON.stringify(first)).not.toMatch(
      /ownerUid|createdAt|updatedAt|proof|bindingHash|reviewDigest|candidate|creator/,
    );
    for (const request of db.requests) {
      expect(request.filters).toContainEqual(["isDeleted", "==", false]);
      expect(request.filters).toContainEqual(["visibility", "==", "published"]);
      expect(request.cap).toBe(13);
    }
  });

  it("pushes every supported filter into the bounded database query and binds the cursor", async () => {
    const { db, reads } = setup();
    for (let n = 1; n <= 13; n++) db.seed(n);
    const mechanic = db.head(1).publishedCard!.mechanics[0];
    expect(mechanic).toBeDefined();
    const filters = {
      mechanic,
      difficulty: "gentle",
      estimatedLength: "short",
    };
    const first = await reads.browse(filters);
    expect(first.gardens).toHaveLength(12);
    expect(db.requests[0].filters).toContainEqual([
      "publishedCard.mechanics",
      "array-contains",
      mechanic,
    ]);
    expect(db.requests[0].filters).toContainEqual([
      "publishedCard.difficulty",
      "==",
      "gentle",
    ]);
    expect(db.requests[0].filters).toContainEqual([
      "publishedCard.estimatedLength",
      "==",
      "short",
    ]);
    expect(
      (await reads.browse({ ...filters, cursor: first.nextCursor })).gardens,
    ).toHaveLength(1);
    await expect(
      reads.browse({ cursor: first.nextCursor }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await reads.browse({ difficulty: "challenging" })).toEqual({
      gardens: [],
      nextCursor: null,
    });
  });

  it("rejects malformed, oversized, cross-scope, noncanonical and changed-filter cursors", async () => {
    const { db, reads } = setup();
    for (let n = 1; n <= 13; n++) db.seed(n, "private");
    const pending = await reads.pending("coach");
    for (const value of [
      null,
      { unknown: "yes" },
      { difficulty: ["gentle"] },
      { mechanic: "laser" },
      { cursor: "x".repeat(1025) },
      { cursor: "not-json" },
      { cursor: Buffer.from("{}").toString("base64url") },
      { cursor: pending.nextCursor },
      { cursor: pending.nextCursor + "=" },
    ]) {
      await expect(reads.browse(value)).rejects.toMatchObject({ status: 400 });
    }
    await expect(reads.pending("coach", { cursor: [] })).rejects.toMatchObject({
      status: 400,
    });
    const encoded = Buffer.from(pending.nextCursor!, "base64url").toString(
      "utf8",
    );
    await expect(
      reads.pending("coach", {
        cursor: Buffer.from(encoded + " ").toString("base64url"),
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(reads.get("invalid")).rejects.toMatchObject({ status: 400 });
  });

  it("keeps public text at its reviewed version while owner and moderator see the candidate", async () => {
    const { db, reads } = setup();
    const head = db.seed(1);
    const candidateLevel = { ...level, title: "Unapproved title" };
    let candidateRun = applyCommand(candidateLevel, createRun(candidateLevel), {
      type: "start",
    });
    while (candidateRun.phase !== "finished" && candidateRun.tick < 1800)
      candidateRun = stepRun(candidateLevel, candidateRun);
    const candidateProof = evaluateWaggleProof(
      JSON.stringify({
        level: candidateLevel,
        replays: [captureReplay(candidateLevel, candidateRun)],
      }),
    );
    const revision = prepareCommunityRevision(
      id(1),
      3,
      { ...metadata, nickname: "Unapproved nickname" },
      candidateLevel,
      candidateProof,
    );
    Object.assign(head, {
      version: 3,
      title: candidateLevel.title,
      candidateRevision: 3,
      candidateStatus: "pending",
    });
    db.data.set(`${WAGGLE_HEADS}/${id(1)}/revisions/3`, revision);
    const publicGarden = await reads.get(id(1));
    expect(publicGarden.title).toBe(level.title);
    expect(publicGarden.nickname).toBe("Clover");
    expect(publicGarden.level).toEqual(parseLevelFile(serializeLevel(level)));
    expect((await reads.browse()).gardens[0].title).toBe(level.title);
    const own = await reads.getOwn("creator", id(1));
    expect(own.level.title).toBe("Unapproved title");
    expect(own.metadata.nickname).toBe("Unapproved nickname");
    const review = await reads.review("coach", id(1));
    expect(review.reviewDigest).toBe(revision.reviewDigest);
    expect(review.candidate.title).toBe("Unapproved title");
    expect(review.allBeesProven).toBe(true);
    expect(JSON.stringify(review)).not.toMatch(
      /ownerUid|contentHash|witnesses|actorUid/,
    );
    head.publishedCard!.nickname = "Unreviewed drift";
    await expect(reads.get(id(1))).rejects.toMatchObject({ status: 503 });
    await expect(reads.browse()).rejects.toMatchObject({ status: 503 });
  });

  it("uses current approved parent attribution and omits unavailable parents without removing a child", async () => {
    const { db, reads } = setup();
    const parent = db.seed(1);
    const child = db.seed(2);
    child.parent = {
      id: id(1),
      revision: 1,
      contentHash: proof.contentHash,
      createdAt: parent.createdAt,
    };
    expect((await reads.get(id(2))).parent).toEqual({
      id: id(1),
      title: level.title,
      nickname: "Clover",
    });
    parent.title = "Pending parent text";
    expect((await reads.get(id(2))).parent!.title).toBe(level.title);
    Object.assign(parent, {
      visibility: "removed",
      publishedRevision: null,
      publishedCard: null,
      publishedAt: null,
      reviewReason: "text",
    });
    expect((await reads.get(id(2))).parent).toBeUndefined();
    await expect(reads.get(id(1))).rejects.toMatchObject({ status: 404 });
    Object.assign(parent, {
      visibility: "deleted",
      title: "",
      isDeleted: true,
      reviewReason: null,
      retireAt: "2026-12-05T12:00:00.000Z",
    });
    expect((await reads.get(id(2))).parent).toBeUndefined();
    db.data.delete(`${WAGGLE_HEADS}/${id(1)}`);
    expect((await reads.get(id(2))).parent).toBeUndefined();
    const replacement = db.seed(1);
    Object.assign(replacement, {
      createdAt: "2027-01-01T00:00:00.000Z",
      updatedAt: "2027-01-01T00:00:00.000Z",
    });
    expect((await reads.get(id(2))).parent).toBeUndefined();
    db.failPath = `${WAGGLE_HEADS}/${id(1)}`;
    await expect(reads.get(id(2))).rejects.toThrow("Storage unavailable");
  });

  it("restricts owner and moderator reads using current roles, archive flags and ownership", async () => {
    const { db, reads } = setup();
    db.seed(1, "private");
    db.seed(2, "published", "someone-else");
    await expect(reads.get(id(1))).rejects.toMatchObject({ status: 404 });
    await expect(reads.get(id(999))).rejects.toMatchObject({ status: 404 });
    await expect(reads.getOwn("creator", id(2))).rejects.toMatchObject({
      status: 404,
    });
    for (const role of ["member", "mentor", "student", "parent", "lead"]) {
      db.actor("creator", role);
      expect(await reads.mine("creator")).toHaveLength(1);
      expect((await reads.getOwn("creator", id(1))).garden.status).toBe(
        "pending",
      );
      await expect(reads.pending("creator")).rejects.toMatchObject({
        status: 403,
      });
      await expect(reads.review("creator", id(1))).rejects.toMatchObject({
        status: 403,
      });
    }
    for (const role of ["admin", "coach"]) {
      db.actor("reviewer", role);
      expect((await reads.pending("reviewer")).gardens).toHaveLength(1);
      expect((await reads.review("reviewer", id(1))).candidate.id).toBe(id(1));
    }
    for (const [role, archived] of [
      ["unknown", false],
      ["member", true],
      ["coach", 1],
    ] as const) {
      db.actor("creator", role, archived);
      await expect(reads.mine("creator")).rejects.toMatchObject({
        status: 403,
      });
      await expect(reads.getOwn("creator", id(1))).rejects.toMatchObject({
        status: 403,
      });
    }
    await expect(reads.mine("missing-authorization")).rejects.toMatchObject({
      status: 403,
    });
    await expect(reads.review("admin", id(2))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("bounds owner inventory, orders it deterministically, and pages pending reviews", async () => {
    const { db, reads } = setup();
    expect(await reads.mine("creator")).toEqual([]);
    expect(await reads.pending("admin")).toEqual({
      gardens: [],
      nextCursor: null,
    });
    for (let n = 1; n <= 14; n++) db.seed(n, "private");
    const first = await reads.pending("admin");
    expect(first.gardens).toHaveLength(12);
    const next = await reads.pending("admin", { cursor: first.nextCursor });
    expect(next.gardens.map((garden) => garden.id)).toEqual([id(13), id(14)]);
    expect(next.nextCursor).toBeNull();
    db.head(2).updatedAt = "2026-09-06T13:00:00.000Z";
    const own = await reads.mine("creator");
    expect(own.slice(0, 3).map((garden) => garden.id)).toEqual([
      id(2),
      id(1),
      id(3),
    ]);
    expect(JSON.stringify(own)).not.toMatch(
      /ownerUid|createdAt|updatedAt|contentHash/,
    );
    for (let n = 15; n <= 21; n++) db.seed(n);
    await expect(reads.mine("creator")).rejects.toMatchObject({ status: 503 });
  });

  it("returns explicit unavailable errors for missing, corrupt or unsupported saved content and query failures", async () => {
    const { db, reads } = setup();
    const head = db.seed(1);
    expect((await reads.getOwn("creator", id(1))).garden.status).toBe(
      "published",
    );
    const path = `${WAGGLE_HEADS}/${id(1)}/revisions/1`;
    const revision = db.data.get(path) as Data;
    db.data.delete(path);
    await expect(reads.get(id(1))).rejects.toMatchObject({ status: 503 });
    db.data.set(path, { ...revision, levelText: '{"rulesVersion":999}' });
    await expect(reads.getOwn("creator", id(1))).rejects.toMatchObject({
      status: 503,
    });
    db.data.set(path, revision);
    Object.assign(head, {
      visibility: "removed",
      publishedRevision: null,
      publishedCard: null,
      publishedAt: null,
      reviewReason: "unsafe",
    });
    await expect(reads.getOwn("creator", id(1))).rejects.toMatchObject({
      status: 404,
    });
    db.failQuery = true;
    await expect(reads.browse()).rejects.toThrow("Query unavailable");
    await expect(reads.mine("creator")).rejects.toThrow("Query unavailable");
    await expect(reads.pending("coach")).rejects.toThrow("Query unavailable");
  });
});
