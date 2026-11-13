import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  tournaments: new Map<string, Record<string, unknown>>(),
  matches: new Map<string, Record<string, unknown>>(),
  pitScouting: new Map<string, Record<string, unknown>>(),
  standScouting: new Map<string, Record<string, unknown>>(),
  pitStates: new Map<string, Record<string, unknown>>(),
  profiles: new Map<string, Record<string, unknown>>(),
  authUsers: new Map<string, Record<string, unknown>>(),
  quotas: new Map<string, Record<string, unknown>>(),
}));

const mockFetchFtcScout = vi.hoisted(() => vi.fn());

vi.mock("../../lib/ftcScoutSync", () => ({
  fetchFtcScoutEventData: mockFetchFtcScout,
}));

vi.mock("../../lib/firebase-admin", () => {
  function makeCollection(map: Map<string, Record<string, unknown>>) {
    let counter = 1;
    const buildQuery = (predicate: (doc: Record<string, unknown>) => boolean) => ({
      where: (field: string, op: string, val: unknown) =>
        buildQuery((doc) => predicate(doc) && (op === "==" ? doc[field] === val : true)),
      orderBy: () => buildQuery(predicate),
      limit: (max: number) => ({
        get: async () => ({
          docs: [...map.entries()]
            .filter(([, data]) => predicate(data))
            .slice(0, max)
            .map(([id, data]) => ({ id, exists: true, data: () => data })),
        }),
      }),
      get: async () => ({
        docs: [...map.entries()]
          .filter(([, data]) => predicate(data))
          .map(([id, data]) => ({ id, exists: true, data: () => data })),
      }),
    });

    return {
      doc: (id?: string) => {
        const docId = id ?? `generated_${counter++}`;
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: map.has(docId),
            data: () => map.get(docId),
          }),
          set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            const existing = opts?.merge ? (map.get(docId) ?? {}) : {};
            map.set(docId, { ...existing, ...data });
          },
          update: async (data: Record<string, unknown>) => {
            const existing = map.get(docId) ?? {};
            map.set(docId, { ...existing, ...data });
          },
        };
      },
      where: (field: string, op: string, val: unknown) =>
        buildQuery((doc) => (op === "==" ? doc[field] === val : true)),
      orderBy: () => buildQuery(() => true),
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
    },
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === "tournaments") return makeCollection(store.tournaments);
        if (name === "tournament_matches") return makeCollection(store.matches);
        if (name === "tournament_pit_scouting") return makeCollection(store.pitScouting);
        if (name === "tournament_stand_scouting") return makeCollection(store.standScouting);
        if (name === "tournament_pit_states") return makeCollection(store.pitStates);
        if (name === "user_profiles") return makeCollection(store.profiles);
        if (name === "authorized_users") return makeCollection(store.authUsers);
        if (name === "internal_api_quotas") return makeCollection(store.quotas);
        throw new Error(`Unexpected collection ${name}`);
      }),
      runTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
          set: async (ref: { set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void> }, data: Record<string, unknown>, opts?: { merge?: boolean }) =>
            ref.set(data, opts),
          update: async (ref: { update: (data: Record<string, unknown>) => Promise<void> }, data: Record<string, unknown>) =>
            ref.update(data),
        }),
      ),
    },
  };
});

import tournamentsRouter from "../tournaments";

async function invokeRoute(
  method: "get" | "post" | "put",
  path: string,
  options: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    uid?: string;
    role?: "admin" | "coach" | "mentor" | "member";
  },
) {
  const layer = tournamentsRouter.stack.find(
    (entry) =>
      entry.route?.path === path &&
      Boolean((entry.route as unknown as { methods: Record<string, boolean> }).methods[method]),
  );
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);

  const uid = options.uid ?? "student_1";
  const role = options.role ?? "member";
  store.authUsers.set(uid, { role, isDeleted: 0 });

  const req: Record<string, unknown> = {
    params: options.params ?? {},
    query: {},
    body: options.body ?? {},
    headers: { authorization: `Bearer ${uid}` },
    user: { uid, email: `${uid}@aresfirst.org`, email_verified: true },
    authorizationRole: role,
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
        if (err) {
          capturedError = err;
        } else {
          advanced = true;
        }
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

describe("Tournament Championship Operations Routes", () => {
  beforeEach(() => {
    process.env.ABUSE_HMAC_SECRET = "test_abuse_hmac_secret_must_be_32_characters_minimum";
    store.tournaments.clear();
    store.matches.clear();
    store.pitScouting.clear();
    store.standScouting.clear();
    store.pitStates.clear();
    store.profiles.clear();
    store.authUsers.clear();
    store.quotas.clear();
    vi.clearAllMocks();

    store.tournaments.set("tourney_1", {
      name: "WV State Championship",
      seasonName: "2026–2027",
      challengeName: "DECODE",
      date: "2027-02-20",
      location: "Fairmont, WV",
      status: "upcoming",
      isDeleted: 0,
    });
    store.profiles.set("student_1", { nickname: "Ada" });
    store.profiles.set("mentor_1", { nickname: "CoachGrace" });
  });

  it("allows verified student members to submit pit & stand scouting and computes reliability summaries without leaking UIDs", async () => {
    const pitResp = await invokeRoute("post", "/:id/scouting/pit", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: {
        teamNumber: "11115",
        teamName: "Gluten Free",
        drivetrain: "Custom Mecanum",
        canClearBarrierOrTrench: true,
        preferredStartZone: "Observation Zone",
        autoSummary: "5-specimen autonomous",
        teleopStrengths: "Fast cycle under 4s",
        endgameCapability: "High ascent",
        notes: "Consistent odometry",
      },
    });
    expect(pitResp.error).toBeNull();
    expect(pitResp.res.statusCode).toBe(200);

    const standBody = {
      clientSubmissionId: "offline_sub_001",
      matchNumber: "QM4",
      teamNumber: "11115",
      alliance: "red",
      autoScoreEstimate: 36,
      teleopCycles: 12,
      endgameTier: "high",
      disconnected: false,
      penalties: "none",
      defenseRating: 1,
      notes: "Zero drops",
    };

    const standFirst = await invokeRoute("post", "/:id/scouting/stand", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: standBody,
    });
    expect(standFirst.error).toBeNull();
    expect(standFirst.res.statusCode).toBe(201);

    // Replaying the same offline outbox submission is idempotent.
    const standReplay = await invokeRoute("post", "/:id/scouting/stand", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: standBody,
    });
    expect(standReplay.error).toBeNull();
    expect((standReplay.res.payload as { duplicate: boolean }).duplicate).toBe(true);

    // Second team pit + direct stand scouting (without clientSubmissionId) exercises sorting & direct doc creation.
    await invokeRoute("post", "/:id/scouting/pit", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: {
        teamNumber: "9876",
        drivetrain: "Swerve",
        canClearBarrierOrTrench: false,
      },
    });
    const standDirect = await invokeRoute("post", "/:id/scouting/stand", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: {
        matchNumber: "QM6",
        teamNumber: "9876",
        alliance: "blue",
        autoScoreEstimate: 20,
        teleopCycles: 6,
        endgameTier: "park",
        disconnected: true,
        penalties: "minor",
        defenseRating: 2,
      },
    });
    expect(standDirect.error).toBeNull();
    expect(standDirect.res.statusCode).toBe(201);

    const getResp = await invokeRoute("get", "/:id/scouting", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
    });
    expect(getResp.error).toBeNull();
    const payload = getResp.res.payload as {
      pitScouting: Array<Record<string, unknown>>;
      standScouting: Array<Record<string, unknown>>;
      teamSummaries: Array<Record<string, unknown>>;
    };
    expect(payload.pitScouting).toHaveLength(2);
    expect(payload.pitScouting[0]?.teamNumber).toBe("9876");
    expect(payload.pitScouting[1]?.scoutNickname).toBe("Ada");
    expect(payload.standScouting).toHaveLength(2);
    expect(payload.teamSummaries[1]).toMatchObject({
      teamNumber: "11115",
      matchesScouted: 1,
      avgAutoScore: 36,
      avgTeleopCycles: 12,
      highEndgameRate: 100,
      disconnectRate: 0,
    });
    expect(JSON.stringify(payload)).not.toContain("student_1");
  });

  it("restricts alliance picklist saves to mentor/coach/admin while rejecting student writes", async () => {
    const denied = await invokeRoute("put", "/:id/picklist", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: {
        picklist: [{ teamNumber: "11115", tier: "first_pick", notes: "Top auto" }],
      },
    });
    expect(denied.error).toMatchObject({ status: 403 });

    const allowed = await invokeRoute("put", "/:id/picklist", {
      params: { id: "tourney_1" },
      uid: "mentor_1",
      role: "mentor",
      body: {
        picklist: [
          { teamNumber: "11115", tier: "first_pick", notes: "Compatible auto start" },
          { teamNumber: "19999", tier: "do_not_pick", notes: "Frequent disconnects" },
        ],
      },
    });
    expect(allowed.error).toBeNull();
    const savedPicklist = (allowed.res.payload as { picklist: unknown[] }).picklist;
    expect(savedPicklist).toHaveLength(2);
  });

  it("persists and returns Pit Command checklist, battery rotation fleet, and pit triage items", async () => {
    const initial = await invokeRoute("get", "/:id/pit-state", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
    });
    expect(initial.error).toBeNull();
    expect((initial.res.payload as { pitState: { batteries: unknown[] } }).pitState.batteries).toEqual([]);

    const saved = await invokeRoute("put", "/:id/pit-state", {
      params: { id: "tourney_1" },
      uid: "student_1",
      role: "member",
      body: {
        checklists: {
          QM4: ["battery", "autonomous", "gamepads"],
        },
        batteries: [
          { id: "B1", label: "Battery #1", voltage: 13.4, status: "charged", cycles: 2 },
          { id: "B2", label: "Battery #2", voltage: 12.6, status: "cooldown", cycles: 3 },
        ],
        triageItems: [
          {
            id: "fix_1",
            severity: "blocker",
            subsystem: "Intake",
            summary: "Tighten left surgical tubing collar",
            resolved: false,
          },
        ],
      },
    });
    expect(saved.error).toBeNull();
    const pitState = (saved.res.payload as {
      pitState: {
        updatedByNickname: string;
        batteries: Array<{ id: string; voltage: number }>;
        triageItems: Array<{ id: string }>;
        checklists: Record<string, string[]>;
      };
    }).pitState;
    expect(pitState.updatedByNickname).toBe("Ada");
    expect(pitState.batteries).toHaveLength(2);
    expect(pitState.triageItems).toHaveLength(1);
    expect(pitState.checklists.QM4).toEqual(["battery", "autonomous", "gamepads"]);
  });

  it("syncs FTCScout event OPRs and upserts ARES matches while preserving manual match notes", async () => {
    store.matches.set("existing_qm4", {
      tournamentId: "tourney_1",
      matchNumber: "QM4",
      alliance: "red",
      partner: "11115",
      opponents: ["18225", "19999"],
      result: "upcoming",
      completed: false,
      notes: "Keep custom scouting note",
      isDeleted: 0,
    });

    mockFetchFtcScout.mockResolvedValueOnce({
      ftcSeason: 2026,
      ftcEventCode: "USWVMOQ",
      eventName: "Morgantown Qualifier",
      eventDate: "2026-12-05",
      eventLocation: "Morgantown, WV",
      oprList: [
        {
          teamNumber: "23247",
          teamName: "ARES",
          opr: 118.4,
          autoOpr: 38.2,
          teleopOpr: 62.1,
          endgameOpr: 18.1,
          rank: 2,
        },
      ],
      aresOpr: 118.4,
      aresRank: 2,
      wins: 5,
      losses: 1,
      ties: 0,
      aresMatches: [
        {
          matchNumber: "QM4",
          alliance: "red",
          partner: "11115",
          opponents: ["18225", "19999"],
          scoreSelf: 145,
          scoreOpponent: 112,
          result: "won",
          completed: true,
        },
        {
          matchNumber: "QM8",
          alliance: "blue",
          partner: "14444",
          opponents: ["11115", "18225"],
          scoreSelf: null,
          scoreOpponent: null,
          result: "upcoming",
          completed: false,
        },
      ],
    });

    const syncResp = await invokeRoute("post", "/:id/sync-ftcscout", {
      params: { id: "tourney_1" },
      uid: "coach_1",
      role: "coach",
      body: { season: 2026, eventCode: "uswvmoq" },
    });

    expect(syncResp.error).toBeNull();
    const payload = syncResp.res.payload as {
      tournament: Record<string, unknown>;
      syncedMatches: number;
    };
    expect(payload.syncedMatches).toBe(2);
    expect(payload.tournament).toMatchObject({
      ftcSeason: 2026,
      ftcEventCode: "USWVMOQ",
      opr: 118.4,
      rank: 2,
      wins: 5,
      losses: 1,
      ties: 0,
    });
    expect(store.matches.get("existing_qm4")?.notes).toBe("Keep custom scouting note");
    expect(store.matches.get("existing_qm4")?.scoreSelf).toBe(145);

    // Public results include safe W-L-T and rank without leaking scouting/OPR lists.
    const pubResp = await invokeRoute("get", "/public/results", {
      uid: "student_1",
      role: "member",
    });
    const publicResults = (pubResp.res.payload as { results: Array<Record<string, unknown>> }).results;
    expect(publicResults[0]).toMatchObject({
      id: "tourney_1",
      opr: 118.4,
      wins: 5,
      losses: 1,
      ties: 0,
      rank: 2,
    });
    expect(JSON.stringify(publicResults)).not.toContain("oprList");
  });
});
