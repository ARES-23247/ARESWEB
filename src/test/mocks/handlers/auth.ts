import { http, HttpResponse } from "msw";
import { createMockSession, createMockSettings } from "../../factories/authFactory";

export const mockAuthState = {
  session: createMockSession(),
  settings: createMockSettings(),
};

export const authHandlers = [
  // Session / Profile
  // Note: No default handler for /me since it conflicts with /api/profiles/me
  // Tests should mock /api/profiles/me explicitly with server.use()

  // Auth check
  http.get("*/auth/auth-check", () => {
    return HttpResponse.json(mockAuthState.session);
  }),

  // Settings
  http.get("*/settings/admin/settings", () => {
    return HttpResponse.json({ success: true, settings: mockAuthState.settings });
  }),

  http.get("*/settings", () => {
    return HttpResponse.json({ success: true, settings: mockAuthState.settings });
  }),

  http.post("*/settings/admin/settings", async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    mockAuthState.settings = { ...mockAuthState.settings, ...body };
    return HttpResponse.json({ success: true, updated: Object.keys(body).length });
  }),
];
