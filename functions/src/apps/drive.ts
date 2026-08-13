import { createApiApp } from "../apiApp";
import driveRouter from "../routes/drive";

export const driveApp = createApiApp({
  routes: [{ path: "/api/drive", router: driveRouter }],
});
