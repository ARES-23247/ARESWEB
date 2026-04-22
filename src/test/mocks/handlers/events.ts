import { http, HttpResponse } from "msw";
import { createMockLocation, createMockEvent } from "../../factories/eventFactory";

// Store state in memory so tests can modify and assert against it
export const mockEventState = {
  events: [createMockEvent(), createMockEvent()],
  locations: [createMockLocation(), createMockLocation()],
};

export const eventHandlers = [
  http.get("*/api/locations", () => {
    return HttpResponse.json({ locations: mockEventState.locations });
  }),

  http.get("*/api/admin/events/:id", ({ params }) => {
    const event = mockEventState.events.find((e) => e.id === params.id) || mockEventState.events[0];
    return HttpResponse.json({ event });
  }),

  http.post("*/api/admin/events", async ({ request }) => {
    const body = await request.json() as Partial<ReturnType<typeof createMockEvent>>;
    const newEvent = { id: "new-id", ...body };
    mockEventState.events.push(newEvent as ReturnType<typeof createMockEvent>);
    return HttpResponse.json({ success: true, id: newEvent.id });
  }),

  http.put("*/api/admin/events/:id", async ({ params, request }) => {
    const body = await request.json() as Partial<ReturnType<typeof createMockEvent>>;
    const index = mockEventState.events.findIndex((e) => e.id === params.id);
    if (index > -1) {
      mockEventState.events[index] = { ...mockEventState.events[index], ...body };
    }
    return HttpResponse.json({ success: true });
  }),

  http.delete("*/api/admin/events/:id", ({ params }) => {
    mockEventState.events = mockEventState.events.filter((e) => e.id !== params.id);
    return HttpResponse.json({ success: true });
  }),
];
