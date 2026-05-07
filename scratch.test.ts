import { Hono } from "hono";
import { usersRouter } from "./functions/api/routes/users";
import { createMockDrizzle } from "./src/test/utils";

async function run() {
  const mockDb = createMockDrizzle();
  mockDb.query.user.findMany.mockResolvedValueOnce([]);

  const testApp = new Hono();
  testApp.use("*", async (c, next) => {
    c.set("db", mockDb);
    c.set("sessionUser", { id: "1", role: "admin", email: "admin@test.com", name: null, member_type: "mentor" });
    await next();
  });
  testApp.route("/", usersRouter);

  const res = await testApp.request("/admin/list");
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
run();
