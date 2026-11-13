import { beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "../../lib/crypto";

const TEST_SECRET = "dummy-encryption-secret-must-be-32-chars-long";

const store = vi.hoisted(() => ({
  authUsers: new Map<string, Record<string, unknown>>(),
  profiles: new Map<string, Record<string, unknown>>(),
  events: new Map<string, Record<string, unknown>>(),
  signups: new Map<string, Map<string, Record<string, unknown>>>(),
  checkinCodes: new Map<string, Record<string, unknown>>(),
  auditLogs: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../lib/zulip", () => ({
  getZulipUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/firebase-admin", () => {
  function makeDocRef(
    map: Map<string, Record<string, unknown>>,
    id: string,
    subcollections?: Record<string, (docId: string) => unknown>,
  ) {
    return {
      id,
      get: async () => ({
        id,
        exists: map.has(id),
        data: () => map.get(id),
      }),
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
        const prev = opts?.merge ? (map.get(id) ?? {}) : {};
        map.set(id, { ...prev, ...data });
      },
      update: async (data: Record<string, unknown>) => {
        const prev = map.get(id) ?? {};
        map.set(id, { ...prev, ...data });
      },
      collection: (subName: string) => {
        const factory = subcollections?.[subName];
        if (!factory) throw new Error(`Unexpected subcollection ${subName}`);
        return factory(id);
      },
    };
  }

  function makeCollection(
    map: Map<string, Record<string, unknown>>,
    subcollections?: Record<string, (docId: string) => unknown>,
  ) {
    let seq = 1;
    const buildQuery = (
      predicate: (doc: Record<string, unknown>) => boolean,
      afterId?: string,
      ordered = false,
    ) => {
      const resolveDocs = (max?: number) => {
        let entries = [...map.entries()].filter(([, data]) => predicate(data));
        if (ordered) entries.sort(([a], [b]) => a.localeCompare(b));
        if (afterId !== undefined) {
          const idx = entries.findIndex(([id]) => id === afterId);
          entries = idx >= 0 ? entries.slice(idx + 1) : entries;
        }
        if (typeof max === "number") entries = entries.slice(0, max);
        return entries.map(([id, data]) => ({
          id,
          exists: true,
          data: () => data,
        }));
      };
      return {
        where: (field: string, op: string, val: unknown) =>
          buildQuery(
            (doc) => predicate(doc) && (op === "==" ? doc[field] === val : true),
            afterId,
            ordered,
          ),
        orderBy: () => buildQuery(predicate, afterId, true),
        startAfter: (cursor: { id?: string }) =>
          buildQuery(predicate, cursor?.id, ordered),
        limit: (max: number) => ({
          get: async () => {
            const docs = resolveDocs(max);
            return { empty: docs.length === 0, docs };
          },
        }),
        get: async () => {
          const docs = resolveDocs();
          return { empty: docs.length === 0, docs };
        },
      };
    };

    return {
      doc: (id?: string) =>
        makeDocRef(map, id ?? `doc_${seq++}`, subcollections),
      where: (field: string, op: string, val: unknown) =>
        buildQuery((doc) => (op === "==" ? doc[field] === val : true)),
      orderBy: () => buildQuery(() => true, undefined, true),
      limit: (max: number) => buildQuery(() => true).limit(max),
    };
  }

  return {
    adminAuth: {
      verifyIdToken: vi.fn(async (token: string) => ({
        uid: token,
        email: `${token}@aresfirst.org`,
        email_verified: true,
      })),
      listUsers: vi.fn().mockResolvedValue({ users: [] }),
    },
    adminStorage: {
      bucket: () => ({ name: "aresweb-test.appspot.com" }),
    },
    adminDb: {
      runTransaction: async <T>(
        work: (tx: {
          get: (r: { get: () => Promise<unknown> }) => Promise<unknown>;
          update: (r: { update: (d: Record<string, unknown>) => Promise<unknown> }, d: Record<string, unknown>) => void;
        }) => Promise<T>,
      ) =>
        work({
          get: (r) => r.get(),
          update: (r, d) => {
            void r.update(d);
          },
        }),
      batch: () => {
        const ops: Array<() => Promise<unknown>> = [];
        return {
          set: (
            ref: { set: (d: Record<string, unknown>, o?: { merge?: boolean }) => Promise<unknown> },
            data: Record<string, unknown>,
            opts?: { merge?: boolean },
          ) => {
            ops.push(() => ref.set(data, opts));
          },
          update: (
            ref: { update: (d: Record<string, unknown>) => Promise<unknown> },
            data: Record<string, unknown>,
          ) => {
            ops.push(() => ref.update(data));
          },
          commit: async () => {
            for (const op of ops) await op();
          },
        };
      },
      collection: vi.fn((name: string) => {
        if (name === "authorized_users") return makeCollection(store.authUsers);
        if (name === "user_profiles") return makeCollection(store.profiles);
        if (name === "event_checkin_codes") return makeCollection(store.checkinCodes);
        if (name === "events") {
          return makeCollection(store.events, {
            signups: (eventId: string) => {
              let subMap = store.signups.get(eventId);
              if (!subMap) {
                subMap = new Map();
                store.signups.set(eventId, subMap);
              }
              return makeCollection(subMap);
            },
          });
        }
        if (name === "audit_logs") {
          return {
            doc: () => ({
              set: async (data: Record<string, unknown>) => {
                store.auditLogs.push(data);
              },
            }),
          };
        }
        throw new Error(`Unexpected collection ${name}`);
      }),
    },
  };
});

import express from "express";
import { registerProfileAdminRoutes } from "../profileAdmin";
import { registerCalendarManageRoutes } from "../calendarManageRoutes";

const profileRouter = express.Router();
registerProfileAdminRoutes(profileRouter);

const calendarRouter = express.Router();
registerCalendarManageRoutes(calendarRouter);

async function invoke(
  router: express.Router,
  method: "get" | "post" | "put" | "patch",
  path: string,
  options: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    uid: string;
    role: "admin" | "coach" | "mentor" | "member";
  },
) {
  const layer = router.stack.find(
    (entry) =>
      entry.route?.path === path &&
      Boolean((entry.route as unknown as { methods: Record<string, boolean> }).methods[method]),
  );
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);

  store.authUsers.set(options.uid, {
    email: `${options.uid}@aresfirst.org`,
    role: options.role,
    isDeleted: 0,
  });

  const req: Record<string, unknown> = {
    params: options.params ?? {},
    query: {},
    body: options.body ?? {},
    headers: { authorization: `Bearer ${options.uid}` },
    user: { uid: options.uid, email: `${options.uid}@aresfirst.org`, email_verified: true },
    authorizationRole: options.role,
  };
  const res = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.payload = data;
      return this;
    },
  };

  let capturedError: unknown = null;
  for (const stackItem of layer.route.stack) {
    let advanced = false;
    await new Promise<void>((resolve, reject) => {
      const next = (err?: unknown) => {
        if (err) capturedError = err;
        else advanced = true;
        resolve();
      };
      Promise.resolve(stackItem.handle(req as never, res as never, next)).then(() => {
        if (!advanced && !capturedError && res.payload !== undefined) resolve();
      }, reject);
    });
    if (capturedError || res.payload !== undefined) break;
  }

  return { res, error: capturedError };
}

describe("Phase 2 — Coach Travel/Safety Readiness & Fast Practice Attendance", () => {
  beforeEach(async () => {
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    store.authUsers.clear();
    store.profiles.clear();
    store.events.clear();
    store.signups.clear();
    store.checkinCodes.clear();
    store.auditLogs.length = 0;

    store.authUsers.set("student_ada", {
      email: "ada@aresfirst.org",
      role: "member",
      memberType: "student",
      isDeleted: 0,
    });
    store.profiles.set("student_ada", {
      nickname: "Ada",
      memberType: "student",
      subteams: ["software", "drive"],
      firstName: await encrypt("Ada", TEST_SECRET),
      lastName: await encrypt("Lovelace", TEST_SECRET),
      tshirtSize: await encrypt("m", TEST_SECRET),
      dietaryRestrictions: await encrypt(JSON.stringify(["Vegetarian", "Nut-Free"]), TEST_SECRET),
      emergencyContactName: await encrypt("Anne Byron", TEST_SECRET),
      emergencyContactPhone: await encrypt("304-555-0199", TEST_SECRET),
      firstConsentVerified: false,
    });

    store.authUsers.set("student_alan", {
      email: "alan@aresfirst.org",
      role: "member",
      memberType: "student",
      isDeleted: 0,
    });
    store.profiles.set("student_alan", {
      nickname: "Alan",
      memberType: "student",
      subteams: ["hardware"],
      tshirtSize: await encrypt("l", TEST_SECRET),
    });

    store.events.set("practice_nov10", {
      title: "Tuesday Lab Practice",
      dateStart: "2026-11-10",
      status: "published",
      isDeleted: 0,
    });
  });

  it("returns boolean travel-readiness matrix without leaking emergency phone numbers, updates FIRST consent, and audits emergency reveal", async () => {
    // Mentors cannot access coach/admin travel readiness
    const mentorAttempt = await invoke(profileRouter, "get", "/admin/travel-readiness", {
      uid: "mentor_1",
      role: "mentor",
    });
    expect(mentorAttempt.error).toMatchObject({ status: 403 });

    // Coach loads readiness summary
    const readiness = await invoke(profileRouter, "get", "/admin/travel-readiness", {
      uid: "coach_1",
      role: "coach",
    });
    expect(readiness.error).toBeNull();
    const summaryPayload = readiness.res.payload as {
      members: Array<Record<string, unknown>>;
      tshirtCounts: Record<string, number>;
      dietaryCounts: Record<string, number>;
    };
    const serializedSummary = JSON.stringify(summaryPayload);
    expect(serializedSummary).not.toContain("304-555-0199");
    expect(serializedSummary).not.toContain("Anne Byron");
    expect(serializedSummary).not.toContain("Lovelace");

    const adaRow = summaryPayload.members.find((m) => m.id === "student_ada");
    const alanRow = summaryPayload.members.find((m) => m.id === "student_alan");
    expect(adaRow).toMatchObject({
      nickname: "Ada",
      tshirtSize: "m",
      hasEmergencyContact: true,
      firstConsentVerified: false,
    });
    expect(alanRow).toMatchObject({
      nickname: "Alan",
      tshirtSize: "l",
      hasEmergencyContact: false,
      firstConsentVerified: false,
    });
    expect(summaryPayload.tshirtCounts.m).toBe(1);
    expect(summaryPayload.tshirtCounts.l).toBe(1);
    expect(summaryPayload.dietaryCounts.Vegetarian).toBe(1);

    // Coach verifies Ada's FIRST Consent & Release
    const consentResp = await invoke(profileRouter, "patch", "/admin/users/:userId/consent", {
      params: { userId: "student_ada" },
      uid: "coach_1",
      role: "coach",
      body: { firstConsentVerified: true },
    });
    expect(consentResp.error).toBeNull();
    expect(store.profiles.get("student_ada")?.firstConsentVerified).toBe(true);
    expect(store.auditLogs.some((log) => log.action === "user.consent.updated")).toBe(true);

    // Coach reveals printable emergency binder -> writes mandatory audit log
    const revealResp = await invoke(profileRouter, "post", "/admin/travel-readiness/reveal", {
      uid: "coach_1",
      role: "coach",
      body: {},
    });
    expect(revealResp.error).toBeNull();
    const revealPayload = revealResp.res.payload as {
      packetGeneratedAt: string;
      members: Array<Record<string, unknown>>;
    };
    const adaRevealed = revealPayload.members.find((m) => m.id === "student_ada");
    expect(adaRevealed).toMatchObject({
      nickname: "Ada",
      legalName: "Ada Lovelace",
      emergencyContactName: "Anne Byron",
      emergencyContactPhone: "304-555-0199",
      firstConsentVerified: true,
    });
    expect(
      store.auditLogs.some(
        (log) =>
          log.action === "travel.emergency_packet.accessed" && log.actorUid === "coach_1",
      ),
    ).toBe(true);
  });

  it("generates a 4-digit Lab PIN for mentors, validates student PIN self-check-in, and supports mentor roll-call toggles", async () => {
    // Student cannot generate a check-in PIN
    const deniedPin = await invoke(calendarRouter, "post", "/manage/:id/checkin-code", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
    });
    expect(deniedPin.error).toMatchObject({ status: 403 });

    // Mentor generates a 4-digit Lab PIN
    const pinResp = await invoke(calendarRouter, "post", "/manage/:id/checkin-code", {
      params: { id: "practice_nov10" },
      uid: "mentor_grace",
      role: "mentor",
    });
    expect(pinResp.error).toBeNull();
    const { code, expiresAt } = pinResp.res.payload as { code: string; expiresAt: string };
    expect(code).toMatch(/^\d{4}$/u);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    // Stored PIN record never saves plaintext code
    expect(JSON.stringify(store.checkinCodes.get("practice_nov10"))).not.toContain(`"${code}"`);

    // Wrong PIN is rejected
    const wrongCode = code === "9999" ? "1000" : "9999";
    const badAttempt = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
      body: { code: wrongCode },
    });
    expect(badAttempt.error).toMatchObject({ status: 403 });

    // Correct PIN marks student_ada attended with verified nickname
    const goodAttempt = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
      body: { code },
    });
    expect(goodAttempt.error).toBeNull();
    expect(store.signups.get("practice_nov10")?.get("student_ada")).toMatchObject({
      userId: "student_ada",
      nickname: "Ada",
      attended: true,
    });

    // Mentor toggles student_alan via 1-tap roll-call endpoint
    const rollCallResp = await invoke(calendarRouter, "put", "/manage/:id/roll-call", {
      params: { id: "practice_nov10" },
      uid: "mentor_grace",
      role: "mentor",
      body: { userId: "student_alan", nickname: "Alan", attended: true },
    });
    expect(rollCallResp.error).toBeNull();
    expect(store.signups.get("practice_nov10")?.get("student_alan")).toMatchObject({
      userId: "student_alan",
      nickname: "Alan",
      attended: true,
    });
  });

  it("locks Lab PIN after 5 wrong attempts with 429 PIN_LOCKED and resets on fresh PIN", async () => {
    const pinResp = await invoke(calendarRouter, "post", "/manage/:id/checkin-code", {
      params: { id: "practice_nov10" },
      uid: "mentor_grace",
      role: "mentor",
    });
    const firstCode = (pinResp.res.payload as { code: string }).code;
    const wrongCode = firstCode === "9999" ? "1000" : "9999";

    for (let i = 1; i <= 4; i++) {
      const attempt = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
        params: { id: "practice_nov10" },
        uid: "student_ada",
        role: "member",
        body: { code: wrongCode },
      });
      expect(attempt.error).toMatchObject({ status: 403, code: "INVALID_PIN" });
    }

    const fifthAttempt = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
      body: { code: wrongCode },
    });
    expect(fifthAttempt.error).toMatchObject({ status: 429, code: "PIN_LOCKED" });

    // Even the correct PIN is rejected once locked out.
    const lockedGoodAttempt = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
      body: { code: firstCode },
    });
    expect(lockedGoodAttempt.error).toMatchObject({ status: 429, code: "PIN_LOCKED" });

    // Generating a fresh PIN resets the lockout counters.
    const resetPinResp = await invoke(calendarRouter, "post", "/manage/:id/checkin-code", {
      params: { id: "practice_nov10" },
      uid: "mentor_grace",
      role: "mentor",
    });
    const freshCode = (resetPinResp.res.payload as { code: string }).code;
    const validAfterReset = await invoke(calendarRouter, "post", "/manage/:id/self-checkin", {
      params: { id: "practice_nov10" },
      uid: "student_ada",
      role: "member",
      body: { code: freshCode },
    });
    expect(validAfterReset.error).toBeNull();
  });

  it("paginates authorized_users beyond 200 entries in travel-readiness", async () => {
    for (let i = 0; i < 205; i++) {
      const uid = `bulk_student_${String(i).padStart(3, "0")}`;
      store.authUsers.set(uid, { role: "member", isDeleted: 0 });
      store.profiles.set(uid, { nickname: `Student ${i}`, memberType: "student" });
    }

    const summaryResp = await invoke(profileRouter, "get", "/admin/travel-readiness", {
      uid: "coach_1",
      role: "coach",
    });
    expect(summaryResp.error).toBeNull();
    const payload = summaryResp.res.payload as { members: Array<{ id: string }> };
    // 205 bulk students + 4 seeded users from beforeEach = 209 active members
    expect(payload.members.length).toBeGreaterThanOrEqual(208);
    expect(payload.members.some((m) => m.id === "bulk_student_204")).toBe(true);
  });
});
