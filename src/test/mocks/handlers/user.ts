import { http, HttpResponse } from "msw";
import { createMockUser, createMockProfile, createMockBadge, createMockComment } from "../../factories/userFactory";

export const mockUserState = {
  users: [createMockUser(), createMockUser()],
  profiles: [createMockProfile(), createMockProfile()],
  badges: [createMockBadge(), createMockBadge()],
  comments: [createMockComment(), createMockComment()],
};

export const userHandlers = [
  http.get("*/api/admin/users", () => HttpResponse.json({ users: mockUserState.users })),
  http.get("*/api/profiles", () => HttpResponse.json({ profiles: mockUserState.profiles })),
  http.get("*/api/badges", () => HttpResponse.json({ badges: mockUserState.badges })),
  http.get("*/api/comments/:type/:id", () => HttpResponse.json({ comments: mockUserState.comments })),
];
