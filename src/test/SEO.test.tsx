import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import SEO, {
  createAdditionalSchema,
  getCanonicalUrl,
  getOgImageUrl,
  ORGANIZATION_SCHEMA
} from "@/components/SEO";
import EducationalCredentialSchema from "@/components/EducationalCredentialSchema";

function renderWithHelmet(node: React.ReactNode) {
  return render(<HelmetProvider>{node}</HelmetProvider>);
}

function structuredData(): Array<Record<string, unknown>> {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map((script) => JSON.parse(script.textContent || "{}") as Record<string, unknown>);
}

describe("SEO", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    document.head.querySelectorAll("[data-rh]").forEach((element) => element.remove());
  });

  it("uses the production canonical path without query data and valid default image metadata", async () => {
    renderWithHelmet(
      <SEO
        title="Team Blog"
        url="https://untrusted.example/blog/post-one?ref=share#comments"
      />
    );

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://aresfirst.org/blog/post-one"
      );
    });

    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://aresfirst.org/favicon.webp"
    );
    expect(document.head.querySelector('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      "Team Blog — ARES 23247"
    );
    expect(document.head.querySelector('meta[name="twitter:image:alt"]')).toHaveAttribute(
      "content",
      "Team Blog — ARES 23247"
    );

    const json = JSON.stringify(ORGANIZATION_SCHEMA);
    expect(json).toContain("https://github.com/ARES-23247");
    expect(json).not.toContain("github.com/ARES23247");
    expect(json).not.toContain("foundingDate");
    expect(json).not.toContain("founder");
  });

  it("anchors the organization to West Virginia and verified social profiles", () => {
    const json = JSON.stringify(ORGANIZATION_SCHEMA);
    expect(json).toContain('"name":"West Virginia"');
    expect(json).toContain("https://bsky.app/profile/ares23247.bsky.social");
    expect(json).toContain("https://www.tiktok.com/@ares.robotics.23247");
    expect(json).toContain("https://x.com/ARES23247");
    expect(json).toContain("https://www.linkedin.com/company/ares-23247");
    expect(json).toContain("https://www.instagram.com/aresftc23247/");
  });

  it("marks search results noindex while keeping a clean canonical URL", async () => {
    window.history.replaceState({}, "", "/academy?q=control#results");
    renderWithHelmet(<SEO title="Academy Search" />);

    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, follow"
      );
    });
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://aresfirst.org/academy"
    );
  });

  it("preserves a verified application name when an exact title is required", async () => {
    renderWithHelmet(<SEO exactTitle title="ARES Analytics" />);

    await waitFor(() => {
      expect(document.title).toBe("ARES Analytics");
    });
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "ARES Analytics"
    );
  });

  it("normalizes trailing slashes and uses a large social card for supplied media", async () => {
    renderWithHelmet(<SEO title="Event" url="/events/demo///" image="https://aresfirst.org/event-card.webp" />);

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://aresfirst.org/events/demo"
      );
    });
    expect(document.head.querySelector('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );
  });

  it("does not invent article publication or modification dates", async () => {
    const article = createAdditionalSchema({
      type: "article",
      title: "Build Notes",
      description: "Build notes from the team.",
      keywords: "robotics",
      image: "https://aresfirst.org/favicon.webp",
      canonicalUrl: "https://aresfirst.org/blog/build-notes",
      schemaData: { authorName: "Team Writer" }
    });

    expect(article).not.toHaveProperty("datePublished");
    expect(article).not.toHaveProperty("dateModified");
    expect(article).toMatchObject({
      author: { "@type": "Person", name: "Team Writer" }
    });
  });

  it("does not publish ineligible Event markup without a public venue", async () => {
    const event = createAdditionalSchema({
      type: "event",
      title: "Robot Demonstration",
      description: "A robot demonstration.",
      keywords: "robotics",
      image: "https://aresfirst.org/favicon.webp",
      canonicalUrl: "https://aresfirst.org/events/demo",
      schemaData: { startDate: "2026-09-12T14:00:00.000Z" }
    });

    expect(event).toBeNull();
  });

  it("uses an explicitly public venue as a PostalAddress for an eligible event", () => {
    const event = createAdditionalSchema({
      type: "event",
      title: "Community Robot Demonstration",
      description: "A public robot demonstration.",
      keywords: "robotics",
      image: "https://aresfirst.org/event.webp",
      canonicalUrl: "https://aresfirst.org/events/demo",
      schemaData: {
        startDate: "2026-09-12T14:00:00-04:00",
        locationName: "Public Library",
        locationAddress: "321 Main Street, Morgantown, WV 26505, US",
      },
    });

    expect(event).toMatchObject({
      "@type": "Event",
      "url": "https://aresfirst.org/events/demo",
      "location": {
        "@type": "Place",
        "name": "Public Library",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "321 Main Street, Morgantown, WV 26505, US",
        },
      },
    });
  });

  it("omits additional structured data when the required record facts are missing", () => {
    const baseOptions = {
      title: "Page",
      description: "Page description",
      keywords: "robotics",
      image: "https://aresfirst.org/favicon.webp",
      canonicalUrl: "https://aresfirst.org/page"
    };

    expect(createAdditionalSchema({ ...baseOptions, type: "website" })).toBeNull();
    expect(createAdditionalSchema({ ...baseOptions, type: "event", schemaData: {} })).toBeNull();
  });

  it("does not publish credential or course claims without verified records", () => {
    const { container } = renderWithHelmet(<EducationalCredentialSchema credentials={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(structuredData().some((schema) => (
      schema["@type"] === "Course" || schema["@type"] === "EducationalOccupationalCredential"
    ))).toBe(false);
  });
});

describe("getCanonicalUrl", () => {
  it("falls back to the official site when the input cannot be parsed", () => {
    expect(getCanonicalUrl("http://[invalid")).toBe("https://aresfirst.org/");
  });
});

describe("getOgImageUrl", () => {
  it("bounds dynamic card query values before constructing a public URL", () => {
    const url = new URL(getOgImageUrl(`  ${"x".repeat(150)}  `, {
      category: "c".repeat(60),
      author: "a".repeat(80),
      date: "d".repeat(60),
      theme: "gold",
    }));

    expect(url.origin + url.pathname).toBe("https://aresfirst.org/api/og");
    expect(url.searchParams.get("title")).toHaveLength(100);
    expect(url.searchParams.get("category")).toHaveLength(30);
    expect(url.searchParams.get("author")).toHaveLength(40);
    expect(url.searchParams.get("date")).toHaveLength(30);
    expect(url.searchParams.get("theme")).toBe("gold");
  });
});
