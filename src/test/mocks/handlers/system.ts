import { http, HttpResponse, ws } from "msw";
import { createMockNotification, createMockAnalytics } from "../../factories/systemFactory";

export const mockSystemState = {
  notifications: [createMockNotification(), createMockNotification()],
  analytics: createMockAnalytics(),
};

const kanbanWs = ws.link("wss://aresweb-partykit.thehomelessguy.partykit.dev/parties/kanban/kanban-global");

export const systemHandlers = [
  http.get("*/notifications/action-items", () => HttpResponse.json({ inquiries: [], posts: [], events: [], docs: [] })),
  http.get("*/notifications", () => HttpResponse.json({ notifications: mockSystemState.notifications })),
  http.get("*/analytics", () => HttpResponse.json(mockSystemState.analytics)),
  kanbanWs.addEventListener("connection", () => {
    // Accept connection but do nothing to satisfy MSW warnings
  }),
];
