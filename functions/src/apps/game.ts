import { createApiApp } from "../apiApp";
import buzzelloRouter from "../routes/buzzello";
import buzzleRouter from "../routes/buzzle";
import { createWaggleWayRouter } from "../routes/waggleWay";

export const gameApp = createApiApp({
  preBodyRoutes: [{ path: "/api/waggle-way", router: createWaggleWayRouter() }],
  routes: [
    { path: "/api/buzzello", router: buzzelloRouter },
    { path: "/api/buzzle", router: buzzleRouter },
  ],
  // One Cloud Run instance owns this process, so this is also a service-wide
  // pre-App-Check ceiling. Durable route budgets remain authoritative.
  globalRequestLimit: {
    max: 5_000,
    windowMs: 15 * 60 * 1_000,
  },
});
