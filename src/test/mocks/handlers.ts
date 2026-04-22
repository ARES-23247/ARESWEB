import { eventHandlers } from "./handlers/events";
import { authHandlers } from "./handlers/auth";
import { contentHandlers } from "./handlers/content";
import { userHandlers } from "./handlers/user";
import { logisticsHandlers } from "./handlers/logistics";
import { systemHandlers } from "./handlers/system";

export const handlers = [
  ...eventHandlers,
  ...authHandlers,
  ...contentHandlers,
  ...userHandlers,
  ...logisticsHandlers,
  ...systemHandlers,
];
