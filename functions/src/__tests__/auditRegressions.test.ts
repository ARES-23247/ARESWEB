import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ records: new Map<string, Record<string, unknown>>() }));
vi.mock("../lib/firebase-admin", () => {
  function ref(path: string) {
    return {
      path, id: path.split("/").at(-1),
      get: async () => ({ exists: state.records.has(path), data: () => state.records.get(path) }),
      set: async (value: Record<string, unknown>) => { state.records.set(path, value); },
      update: async (value: Record<string, unknown>) => { state.records.set(path, { ...state.records.get(path), ...value }); },
    };
  }
  return {
    adminAuth: { verifyIdToken: async (token: string) => {
      if (token === "invalid") throw new Error("Invalid test token");
      return { uid: token, email_verified: true };
    } },
    adminAppCheck: { verifyToken: async (token: string) => {
      if (token !== "valid-app") throw new Error("Invalid test attestation");
      return { appId: "1:205869391101:web:ca1bb24da790e4904ff294" };
    } },
    adminDb: {
      collection: (name: string) => {
        const query = {
          doc: (id: string) => ref(`${name}/${id}`),
          orderBy: () => query, limit: () => query,
          get: async () => ({ docs: [...state.records].filter(([path]) => path.startsWith(`${name}/`))
            .map(([path, value]) => ({ id: path.split("/").at(-1), data: () => value })) }),
        };
        return query;
      },
      runTransaction: async (work: (tx: { get: (r: ReturnType<typeof ref>) => ReturnType<ReturnType<typeof ref>["get"]>; set: (r: ReturnType<typeof ref>, value: Record<string, unknown>) => void }) => Promise<unknown>) => work({
        get: (r) => r.get(), set: (r, value) => { state.records.set(r.path, value); },
      }),
    },
  };
});

import { createApiApp } from "../apiApp";
import finance from "../routes/finance";
import robots from "../routes/robots";
import content from "../routes/content";
import { metadataForDocument, parseDynamicRoute } from "../webRendering";

const app = createApiApp({ routes: [
  { path: "/api/finance", router: finance },
  { path: "/api/robots", router: robots },
  { path: "/api/content", router: content },
] });
let server: ReturnType<typeof app.listen>;
let origin: string;
function request(path: string, method = "GET", body?: unknown, role = "admin", appCheck = "valid-app") {
  return fetch(`${origin}/api${path}`, { method, headers: {
    ...(role ? { Authorization: `Bearer ${role}` } : {}),
    ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}),
    "Content-Type": "application/json",
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe("audit regression HTTP boundaries", () => {
  beforeAll(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); });
  beforeEach(() => {
    vi.stubEnv("ENFORCE_APP_CHECK", "true");
    state.records.clear();
    for (const role of ["admin", "coach", "mentor", "member", "unverified"]) state.records.set(`authorized_users/${role}`, { role });
    state.records.set("authorized_users/archived", { role: "admin", isDeleted: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["admin", "coach"])("allows %s to create, read, update, archive, and restore finance records", async role => {
    const record = { id: "fin_audit", amount: 19.99, description: "Synthetic purchase", date: "2026-09-04", receiptUrl: "https://example.test/receipt", recordedBy: "spoofed" };
    expect((await request("/finance/admin", "POST", record, role)).status).toBe(200);
    expect(state.records.get("finance_transactions/fin_audit")).toMatchObject({ amount: 19.99, recordedBy: role });
    const listing = await request("/finance/admin", "GET", undefined, role);
    expect(listing.status).toBe(200);
    expect((await listing.json()).transactions[0].receiptUrl).toBe(record.receiptUrl);
    expect((await request("/finance/admin", "POST", { ...record, amount: 0.29 }, role)).status).toBe(200);
    expect((await request("/finance/admin/fin_audit", "DELETE", undefined, role)).status).toBe(200);
    expect(state.records.get("finance_transactions/fin_audit")?.isDeleted).toBe(1);
    expect((await request("/finance/admin/fin_audit/restore", "PATCH", undefined, role)).status).toBe(200);
    expect(state.records.get("finance_transactions/fin_audit")?.isDeleted).toBe(0);
  });

  it.each(["mentor", "member", "unverified", "archived", "", "invalid"])("denies finance access for %s through the real middleware chain", async role => {
    const expected = role === "" || role === "invalid" ? 401 : 403;
    for (const [path, method] of [["/finance/admin", "GET"], ["/finance/admin", "POST"], ["/finance/admin/fin_audit", "DELETE"], ["/finance/admin/fin_audit/restore", "PATCH"]]) {
      expect((await request(path, method, method === "POST" ? {} : undefined, role)).status).toBe(expected);
    }
    expect([...state.records.keys()].some(key => key.startsWith("finance_transactions/"))).toBe(false);
  });

  it.each(["", "invalid-app"])("requires App Check for finance writes: %s", async appCheck => {
    expect((await request("/finance/admin", "POST", {}, "admin", appCheck)).status).toBe(401);
  });

  it.each([0.29, 1.10, 19.99, 100, "1.10"])("accepts decimal currency %s", async amount => {
    expect((await request("/finance/admin", "POST", { id: "fin_amount", date: "2026-09-04", amount, description: "Synthetic" })).status).toBe(200);
    expect(state.records.get("finance_transactions/fin_amount")?.amount).toBe(Number(amount));
  });
  it.each([10.999, 0, -1, null, true, {}, "Infinity", "NaN", "1e3", Number.MAX_SAFE_INTEGER])("rejects invalid currency %s", async amount => {
    expect((await request("/finance/admin", "POST", { date: "2026-09-04", amount, description: "Synthetic" })).status).toBe(400);
  });

  it("preserves omitted robot fields through auth, validation, and persistence", async () => {
    const original = { name: "Original", programmingLanguage: "Kotlin", content: "Existing text", versions: [{ name: "V1" }], onshapeUrl: "https://cad.onshape.com/documents/abc", isDeleted: 0 };
    state.records.set("robots/audit", original);
    expect((await request("/robots/audit", "PUT", { name: "Renamed" })).status).toBe(200);
    expect(state.records.get("robots/audit")).toMatchObject({ ...original, name: "Renamed" });
    expect((await request("/robots/audit", "PUT", { versions: [], content: "", onshapeUrl: "" })).status).toBe(200);
    expect(state.records.get("robots/audit")).toMatchObject({ name: "Renamed", versions: [], content: "", onshapeUrl: "", programmingLanguage: "Kotlin" });
    for (const body of [{}, { unknownField: "ignored" }, { weightLbs: -1 }]) expect((await request("/robots/audit", "PUT", body)).status).toBe(400);
  });

  it.each([0, false, undefined, true, 1, "1", null])("keeps API and web content visibility consistent for flag %s", async isDeleted => {
    const data = { status: "published", approvalStatus: "approved", isDeleted, displayInMathCorner: 1, displayInAreslib: 1, title: "Synthetic", content: "Body" };
    state.records.set("posts/audit", data);
    state.records.set("docs/audit", data);
    const visible = isDeleted === 0 || isDeleted === false || isDeleted === undefined;
    for (const [apiPath, webPath] of [["/content/posts/audit", "/blog/audit"], ["/content/docs/audit?library=academy", "/academy/audit"], ["/content/docs/audit?library=areslib", "/docs/audit"]]) {
      expect((await request(apiPath, "GET", undefined, "")).status).toBe(visible ? 200 : 404);
      expect(metadataForDocument(parseDynamicRoute(webPath)!, data) !== null).toBe(visible);
    }
  });
});
