import { http, HttpResponse } from "msw";
import { createMockUser, createMockProfile, createMockBadge, createMockComment } from "../../factories/userFactory";

export const mockUserState = {
  users: [createMockUser(), createMockUser()],
  profiles: [createMockProfile(), createMockProfile()],
  badges: [createMockBadge(), createMockBadge()],
  comments: [createMockComment(), createMockComment()],
};

export const userHandlers = [
  http.get("*/users/admin/list", () => HttpResponse.json({ users: mockUserState.users })),
  http.get("*/profiles", () => HttpResponse.json({ profiles: mockUserState.profiles })),
  http.get("*/badges", () => HttpResponse.json({ badges: mockUserState.badges })),
  http.get("*/comments/:type/:id", () => HttpResponse.json({ comments: mockUserState.comments })),
];
