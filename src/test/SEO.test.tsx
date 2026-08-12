import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import SEO, {
  createAdditionalSchema,
  getCanonicalUrl,
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
    expect(json).not.toContain("ARES23247");
    expect(json).not.toContain("foundingDate");
    expect(json).not.toContain("founder");
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

  it("only publishes event facts supplied by the event record", async () => {
    const event = createAdditionalSchema({
      type: "event",
      title: "Robot Demonstration",
      description: "A robot demonstration.",
      keywords: "robotics",
      image: "https://aresfirst.org/favicon.webp",
      canonicalUrl: "https://aresfirst.org/events/demo",
      schemaData: { startDate: "2026-09-12T14:00:00.000Z" }
    });

    expect(event).not.toHaveProperty("endDate");
    expect(event).not.toHaveProperty("eventStatus");
    expect(event).not.toHaveProperty("offers");
    expect(event).not.toHaveProperty("location");
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
