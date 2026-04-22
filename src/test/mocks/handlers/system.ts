import { http, HttpResponse } from "msw";
import { createMockNotification, createMockAnalytics } from "../../factories/systemFactory";

export const mockSystemState = {
  notifications: [createMockNotification(), createMockNotification()],
  analytics: createMockAnalytics(),
};

export const systemHandlers = [
  http.get("*/api/notifications", () => HttpResponse.json({ notifications: mockSystemState.notifications })),
  http.get("*/api/analytics", () => HttpResponse.json(mockSystemState.analytics)),
];
