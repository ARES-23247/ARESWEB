import { http, HttpResponse } from "msw";
import { createMockOutreach, createMockSponsor, createMockAward, createMockInquiry } from "../../factories/logisticsFactory";

export const mockLogisticsState = {
  outreach: [createMockOutreach(), createMockOutreach()],
  sponsors: [createMockSponsor(), createMockSponsor()],
  awards: [createMockAward(), createMockAward()],
  inquiries: [createMockInquiry(), createMockInquiry()],
};

export const logisticsHandlers = [
  http.get("*/outreach", () => HttpResponse.json({ outreach: mockLogisticsState.outreach })),
  http.get("*/sponsors", () => HttpResponse.json({ sponsors: mockLogisticsState.sponsors })),
  http.get("*/awards", () => HttpResponse.json({ awards: mockLogisticsState.awards })),
  http.get("*/inquiries", () => HttpResponse.json({ inquiries: mockLogisticsState.inquiries })),
];
