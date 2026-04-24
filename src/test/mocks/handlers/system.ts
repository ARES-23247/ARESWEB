import { http, HttpResponse } from "msw";
import { createMockNotification, createMockAnalytics } from "../../factories/systemFactory";

export const mockSystemState = {
  notifications: [createMockNotification(), createMockNotification()],
  analytics: createMockAnalytics(),
};

export const systemHandlers = [
  http.get("*/notifications", () => HttpResponse.json({ notifications: mockSystemState.notifications })),
  http.get("*/analytics", () => HttpResponse.json(mockSystemState.analytics)),
];
