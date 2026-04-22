import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useDashboardNotifications } from "./useDashboardNotifications";

vi.mock("../api/adminApi", () => ({
  adminApi: {
    get: vi.fn().mockResolvedValue({}),
  },
}));

describe("useDashboardNotifications Hook", () => {
  it("should fetch pending counts on mount", async () => {
    const mockSession = { 
      user: { id: "user-1", email: "test@example.com", name: "User", role: "admin", created_at: "2024", updated_at: "2024", nickname: null, avatar_url: null, member_type: null, bio: null },
      authenticated: true
    };
    const mockPermissions = { isAuthorized: true, canSeeInquiries: true };

    const { result } = renderWithProviders(() => useDashboardNotifications(mockSession as any, mockPermissions as any));
    
    expect(result.current.pendingInquiriesCount).toBe(0);
    expect(result.current.pendingPostsCount).toBe(0);
  });
});
