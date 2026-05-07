const vi = { fn: () => { const f = () => {}; f.mockResolvedValueOnce = () => f; f.mockResolvedValue = () => f; return f; } };
import { Hono } from "hono";
import analyticsRouter from "./functions/api/routes/analytics";
import { createMockDrizzle } from "./src/test/utils";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
};

const mockDb = createMockDrizzle();
const testApp = new Hono();
testApp.use("*", async (c, next) => {
  c.set("db", mockDb);
  c.set("sessionUser", { id: "1", role: "admin" });
  await next();
});
testApp.route("/", analyticsRouter);

mockDb.get = vi.fn()
  .mockResolvedValueOnce({ total: 100 }) // totalViewsData
  .mockResolvedValueOnce({ total: 50 }) // assetsCount
  .mockResolvedValueOnce({ total: 1000 }) as typeof mockDb.get; // apiCount

mockDb.execute = vi.fn()
  .mockResolvedValueOnce({ results: [{ unique_count: 20 }] }) // uniqueVisitorsData
  .mockResolvedValueOnce({ results: [{ date: "2023-01-01", pageViews: 10 }] }) // activityData
  .mockResolvedValueOnce({ results: [{ date: "2023-01-01", avg_latency: 150 }] }) as typeof mockDb.execute; // latencyData

mockDb.all = vi.fn()
  .mockResolvedValueOnce([{ path: "/", category: "home", views: 10 }]) // topPagesDataRow
  .mockResolvedValueOnce([{ referrer: "google.com", visits: 5 }]) // referrersDataRow
  .mockResolvedValueOnce([{ path: "/", category: "home", user_agent: "test", referrer: "google.com", timestamp: "2023-01-01T12:00:00Z" }]) // recentViewsDataRow
  .mockResolvedValueOnce([{ category: "home", total: 10 }]) as typeof mockDb.all; // totalsDataRow

async function run() {
  const req = new Request("http://localhost/admin/platform-analytics");
  const res = await testApp.request(req, {}, { DB: {}, DEV_BYPASS: "true", TURNSTILE_SECRET_KEY: "secret" }, mockExecutionContext);
  console.log(res.status);
  console.log(await res.text());
}
run();
