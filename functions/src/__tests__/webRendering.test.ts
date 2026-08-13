import { describe, expect, it } from "vitest";
import {
  injectMetadata,
  metadataForDocument,
  parseDynamicRoute,
  renderNotFound,
} from "../webRendering";

describe("dynamic web rendering", () => {
  it("parses only supported, bounded record routes", () => {
    expect(parseDynamicRoute("/blog/hello-world")).toMatchObject({ collection: "posts", id: "hello-world", kind: "blog" });
    expect(parseDynamicRoute("/academy/motion%2Dlesson/")).toMatchObject({ collection: "docs", id: "motion-lesson", kind: "academy" });
    expect(parseDynamicRoute("/docs/api_101")).toMatchObject({ collection: "docs", kind: "docs" });
    expect(parseDynamicRoute("/events/event-1")).toMatchObject({ collection: "events", kind: "event" });
    expect(parseDynamicRoute("/robots/robot-1")).toMatchObject({ collection: "robots", kind: "robot" });
    expect(parseDynamicRoute("/dashboard/profile")).toBeNull();
    expect(parseDynamicRoute("/blog/bad%2Fid")).toBeNull();
    expect(parseDynamicRoute("/blog/%E0%A4%A")).toBeNull();
    expect(parseDynamicRoute(`/blog/${"x".repeat(161)}`)).toBeNull();
  });

  it("publishes explicit metadata only for visible records", () => {
    const blog = parseDynamicRoute("/blog/build-update")!;
    expect(metadataForDocument(blog, {
      status: "published",
      isDeleted: 0,
      title: "Build <Update>",
      snippet: "A safe summary",
      thumbnail: "https://example.com/photo.jpg",
    })).toMatchObject({
      title: "Build <Update> | ARES 23247",
      canonicalUrl: "https://aresfirst.org/blog/build-update",
      type: "article",
    });
    expect(metadataForDocument(blog, { status: "draft", isDeleted: 0 })).toBeNull();
    expect(metadataForDocument(blog, { status: "published", isDeleted: 1 })).toBeNull();
    expect(metadataForDocument(blog, { status: "published", searchIndexable: false })).toBeNull();

    const academy = parseDynamicRoute("/academy/physics")!;
    expect(metadataForDocument(academy, { status: "published", isDeleted: 0, title: "Physics" })).toBeNull();
    expect(metadataForDocument(academy, {
      status: "published", isDeleted: 0, displayInScienceCorner: 1, title: "Physics", description: "Motion lessons",
    })?.title).toContain("ARES Academy");

    const docs = parseDynamicRoute("/docs/control-loops")!;
    expect(metadataForDocument(docs, { status: "published", isDeleted: 0, displayInAreslib: 1 })?.title).toContain("ARESLib");
    expect(metadataForDocument(docs, { status: "published", isDeleted: 0 })).toBeNull();
  });

  it("derives bounded event and robot metadata without exposing raw fields", () => {
    const event = metadataForDocument(parseDynamicRoute("/events/demo")!, {
      status: "published", isDeleted: 0, name: "Robot Demo", description: "Meet the team", image: "javascript:alert(1)",
    });
    expect(event).toMatchObject({ title: "Robot Demo | ARES 23247", image: "https://aresfirst.org/favicon.webp" });

    const robot = metadataForDocument(parseDynamicRoute("/robots/ares")!, {
      isDeleted: 0, name: "ARES", challengeName: "Into the Deep",
    });
    expect(robot?.description).toContain("Into the Deep");
  });

  it("injects escaped canonical and social metadata into the application shell", () => {
    const shell = '<html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"><meta property="og:description" content="old"><meta property="og:type" content="website"></head><body><div id="root"></div></body></html>';
    const rendered = injectMetadata(shell, {
      title: 'Unsafe <title> "value"',
      description: "A&B <summary>",
      canonicalUrl: "https://aresfirst.org/blog/safe",
      type: "article",
    });
    expect(rendered).toContain("Unsafe &lt;title&gt; &quot;value&quot;");
    expect(rendered).toContain("A&amp;B &lt;summary&gt;");
    expect(rendered).toContain('rel="canonical" href="https://aresfirst.org/blog/safe"');
    expect(rendered).toContain('property="og:type" content="article"');
    expect(rendered).toContain('name="twitter:card"');
  });

  it("renders a standalone noindex 404 document", () => {
    const html = renderNotFound();
    expect(html).toContain("404 — Page not found");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
  });
});
