import { createApiApp } from "../apiApp";
import simulationsRouter from "../routes/simulations";
import studioIntegrationsRouter from "../routes/studioIntegrations";
import tasksRouter from "../routes/tasks";
import webhooksRouter from "../routes/webhooks";
import zulipRouter from "../routes/zulip";

export const communicationsApp = createApiApp({ routes: [
  { path: "/api/tasks", router: tasksRouter },
  { path: "/api/webhooks", router: webhooksRouter },
  { path: "/api/simulations", router: simulationsRouter },
  { path: "/api/integrations/robotics-studio", router: studioIntegrationsRouter },
  { path: "/api/zulip", router: zulipRouter },
] });
