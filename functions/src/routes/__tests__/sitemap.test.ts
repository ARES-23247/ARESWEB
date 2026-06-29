import { describe, it, expect, vi, beforeEach } from "vitest";
import sitemapRouter from "../sitemap";
import { adminDb } from "../../lib/firebase-admin";

const mockPosts = [
  { id: "blog-post-1", data: () => ({ status: "published", isDeleted: 0 }) }
];

const mockRobots = [
  { id: "robot-1", data: () => ({ isDeleted: 0 }) }
];

const mockAcademy = [
  { id: "tutorial-1", data: () => ({ status: "published", isDeleted: 0 }) }
];

const mockDocs = [
  {
    id: "math-lesson",
    data: () => ({
      status: "published",
      isDeleted: 0,
      displayInMathCorner: 1,
      displayInScienceCorner: 0,
      displayInAreslib: 0
    })
  },
  {
    id: "areslib-doc",
    data: () => ({
      status: "published",
      isDeleted: 0,
      displayInMathCorner: 0,
      displayInScienceCorner: 0,
      displayInAreslib: 1
    })
  }
];

const mockEvents = [
  { id: "event-1", data: () => ({ status: "published", isDeleted: 0 }) }
];

vi.mock("../../lib/firebase-admin", () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName) => {
        let mockData: any[] = [];
        if (collectionName === "posts") mockData = mockPosts;
        if (collectionName === "robots") mockData = mockRobots;
        if (collectionName === "academy") mockData = mockAcademy;
        if (collectionName === "docs") mockData = mockDocs;
        if (collectionName === "events") mockData = mockEvents;

        const getMock = vi.fn().mockResolvedValue({
          forEach: (callback: (doc: any) => void) => mockData.forEach(callback)
        });

        return {
          where: vi.fn().mockReturnThis(),
          get: getMock
        };
      })
    }
  };
});

describe("GET /sitemap.xml Router Handler", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {};
    res = {
      setHeader: vi.fn(),
      send: vi.fn()
    };
    next = vi.fn();
  });

  it("should return a correctly formatted sitemap XML with static and dynamic URLs", async () => {
    // Retrieve the handler function from the express router stack
    const routeLayer = sitemapRouter.stack.find(
      (layer) => layer.route && layer.route.path === "/"
    );
    expect(routeLayer).toBeDefined();
    const route = routeLayer?.route;
    expect(route).toBeDefined();
    const handler = route!.stack[0].handle;

    await handler(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/xml");
    expect(res.send).toHaveBeenCalled();
    const xmlContent: string = res.send.mock.calls[0][0];

    // Assert standard sitemap boundaries
    expect(xmlContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Assert a couple of static URLs
    expect(xmlContent).toContain("<loc>https://aresfirst.org/</loc>");
    expect(xmlContent).toContain("<loc>https://aresfirst.org/about</loc>");
    expect(xmlContent).toContain("<loc>https://aresfirst.org/academy</loc>");

    // Assert dynamic blog post
    expect(xmlContent).toContain("<loc>https://aresfirst.org/blog/blog-post-1</loc>");

    // Assert dynamic robot
    expect(xmlContent).toContain("<loc>https://aresfirst.org/robots/robot-1</loc>");

    // Assert dynamic academy from academy collection
    expect(xmlContent).toContain("<loc>https://aresfirst.org/academy/tutorial-1</loc>");

    // Assert dynamic tutorials from docs collection
    expect(xmlContent).toContain("<loc>https://aresfirst.org/academy/math-lesson</loc>");
    expect(xmlContent).toContain("<loc>https://aresfirst.org/docs/areslib-doc</loc>");

    // Assert dynamic event
    expect(xmlContent).toContain("<loc>https://aresfirst.org/events/event-1</loc>");

    expect(xmlContent).toContain("</urlset>");
  });
});
