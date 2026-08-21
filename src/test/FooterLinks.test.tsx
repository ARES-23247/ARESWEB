import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Footer from "@/components/Footer";
import { siteConfig } from "@/lib/site-config";

describe("Footer social links", () => {
  afterEach(cleanup);

  it("uses the centrally verified team destinations", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const expectedLinks = [
      ["Instagram", siteConfig.social.instagram],
      ["YouTube", siteConfig.social.youtube],
      ["Facebook", siteConfig.social.facebook],
      ["X (Twitter)", siteConfig.social.x],
      ["GitHub Organization", siteConfig.social.github],
      ["Zulip Team Chat", siteConfig.social.zulip],
      ["Bluesky", siteConfig.social.bluesky],
    ] as const;

    for (const [name, href] of expectedLinks) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("does not link to stale social handles", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(
      document.querySelector('a[href="https://www.facebook.com/ARES23247"]'),
    ).toBeNull();
    expect(
      document.querySelector('a[href="https://www.instagram.com/ares23247/"]'),
    ).toBeNull();
  });
});
