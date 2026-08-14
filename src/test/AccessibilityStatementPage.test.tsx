import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccessibilityPage from "../app/accessibility/page";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import { siteConfig } from "@/lib/site-config";

let capturedSeoProps: Record<string, unknown> | null = null;
vi.mock("@/components/SEO", () => ({
  default: (props: Record<string, unknown>) => {
    capturedSeoProps = props;
    return null;
  },
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <nav aria-label="Main navigation" />,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <footer aria-label="Site footer" />,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/accessibility"]}>
      <LayoutWrapper>
        <AccessibilityPage />
      </LayoutWrapper>
    </MemoryRouter>
  );
}

describe("AccessibilityPage Statement & Conformance Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    capturedSeoProps = null;
  });

  describe("Semantic Landmark Hierarchy & Structure", () => {
    it("renders the primary main landmark with id='main-content' and tabindex=-1", () => {
      renderPage();
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute("id", "main-content");
      expect(main).toHaveAttribute("tabindex", "-1");
    });

    it("renders the top-level h1 heading and structured section landmarks", () => {
      renderPage();
      const h1 = screen.getByRole("heading", { level: 1, name: /Accessibility Statement/i });
      expect(h1).toBeInTheDocument();

      const h2Headings = screen.getAllByRole("heading", { level: 2 });
      const h2Texts = h2Headings.map((h) => h.textContent?.trim());
      expect(h2Texts).toContain("WCAG 2.2 AA Core Principles");
      expect(h2Texts).toContain("Assistive Technology & Compatibility Testing");
      expect(h2Texts).toContain("Feedback & Grievance Mechanism");
    });

    it("renders all 4 core principles under h3 headings in logical reading order", () => {
      renderPage();
      const h3Headings = screen.getAllByRole("heading", { level: 3 });
      const h3Texts = h3Headings.map((h) => h.textContent?.trim());
      expect(h3Texts).toEqual([
        "1. Perceivable",
        "2. Operable",
        "3. Understandable",
        "4. Robust",
      ]);
    });
  });

  describe("Four Core WCAG Principles Coverage", () => {
    it("discloses Perceivable guidelines: text alternatives, contrast tokens, and reflow/zoom", () => {
      renderPage();
      const perceivableHeading = screen.getByRole("heading", { level: 3, name: "1. Perceivable" });
      const perceivableCard = perceivableHeading.closest(".hero-card");
      expect(perceivableCard).toBeInTheDocument();

      const text = perceivableCard?.textContent || "";
      expect(text).toMatch(/Text Alternatives/i);
      expect(text).toMatch(/Descriptive alternative text/i);
      expect(text).toMatch(/Contrast Standards/i);
      expect(text).toMatch(/4\.5:1 for normal text and 3:1 for large text/i);
      expect(text).toMatch(/Reflow & Zoom/i);
      expect(text).toMatch(/200% to 400% browser zoom/i);
      expect(text).toMatch(/320 CSS pixels/i);
    });

    it("discloses Operable guidelines: keyboard navigation, skip link, focus containment, and simulation controls", () => {
      renderPage();
      const operableHeading = screen.getByRole("heading", { level: 3, name: "2. Operable" });
      const operableCard = operableHeading.closest(".hero-card");
      expect(operableCard).toBeInTheDocument();

      const text = operableCard?.textContent || "";
      expect(text).toMatch(/Keyboard Navigation/i);
      expect(text).toMatch(/Tab, Shift\+Tab, Arrows, Enter, Space, Escape/i);
      expect(text).toMatch(/Skip Links/i);
      expect(text).toMatch(/bypass repetitive navigation/i);
      expect(text).toMatch(/Focus Trapping & Dismissal/i);
      expect(text).toMatch(/restore focus to triggering elements/i);
      expect(text).toMatch(/Simulation Alternatives/i);
      expect(text).toMatch(/native, accessible HTML controls/i);
    });

    it("discloses Understandable guidelines: 8th-grade readability, route announcements, and form alerts", () => {
      renderPage();
      const understandableHeading = screen.getByRole("heading", { level: 3, name: "3. Understandable" });
      const understandableCard = understandableHeading.closest(".hero-card");
      expect(understandableCard).toBeInTheDocument();

      const text = understandableCard?.textContent || "";
      expect(text).toMatch(/8th-Grade Readability/i);
      expect(text).toMatch(/Flesch-Kincaid 8th-grade readability/i);
      expect(text).toMatch(/Predictable Navigation/i);
      expect(text).toMatch(/aria-live="polite"/i);
      expect(text).toMatch(/Input Guidance & Alerts/i);
      expect(text).toMatch(/role="alert"/i);
    });

    it("discloses Robust guidelines: semantic HTML5, screen reader support, and zero trust sanitization", () => {
      renderPage();
      const robustHeading = screen.getByRole("heading", { level: 3, name: "4. Robust" });
      const robustCard = robustHeading.closest(".hero-card");
      expect(robustCard).toBeInTheDocument();

      const text = robustCard?.textContent || "";
      expect(text).toMatch(/Semantic HTML5/i);
      expect(text).toMatch(/<main>/i);
      expect(text).toMatch(/<nav>/i);
      expect(text).toMatch(/Assistive Tech Support/i);
      expect(text).toMatch(/NVDA \(Windows\) and VoiceOver \(macOS\/iOS\)/i);
      expect(text).toMatch(/Zero Trust & Sanitization/i);
      expect(text).toMatch(/App Check verification preserve markup integrity/i);
    });
  });

  describe("Assistive Technology & Compatibility Testing Disclosures", () => {
    it("renders the testing matrix covering NVDA, VoiceOver, keyboard-only, zoom, and contrast modes", () => {
      renderPage();
      const testingHeading = screen.getByRole("heading", {
        level: 2,
        name: /Assistive Technology & Compatibility Testing/i,
      });
      const section = testingHeading.closest("section");
      expect(section).toBeInTheDocument();

      expect(within(section!).getByText(/Screen Readers/i)).toBeInTheDocument();
      expect(
        within(section!).getByText(/NVDA \(Windows 11, Firefox\/Chromium\) & VoiceOver \(macOS\/iOS, Safari\)/i)
      ).toBeInTheDocument();

      expect(within(section!).getByText(/Keyboard & Zoom/i)).toBeInTheDocument();
      expect(
        within(section!).getByText(/Keyboard-only flows \(Tab, arrows, Escape\) and 200%–400% viewport reflow/i)
      ).toBeInTheDocument();

      expect(within(section!).getByText(/Contrast Modes/i)).toBeInTheDocument();
      expect(
        within(section!).getByText(/High Contrast \/ Forced-Colors mode with color-independent visual indicators/i)
      ).toBeInTheDocument();
    });
  });

  describe("Grievance, Feedback & Contact Mechanism", () => {
    it("renders direct email link with descriptive aria-label and prefilled subject", () => {
      renderPage();
      const emailLink = screen.getByRole("link", {
        name: new RegExp(`Send an email to ${siteConfig.team.name} accessibility team at ${siteConfig.contact.email}`, "i"),
      });
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute(
        "href",
        `mailto:${siteConfig.contact.email}?subject=Accessibility%20Feedback%20-%20ARES%20Web%20Portal`
      );
      expect(emailLink.className).toContain("focus-visible:ring-2");
    });

    it("renders external GitHub issue tracker link with secure attributes", () => {
      renderPage();
      const githubLink = screen.getByRole("link", {
        name: /Submit an accessibility issue on GitHub/i,
      });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute(
        "href",
        `https://github.com/${siteConfig.urls.githubOrg}/ARESWEB/issues`
      );
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(githubLink.className).toContain("focus-visible:ring-2");
    });

    it("discloses that accessibility hurdles are treated as high-priority defects", () => {
      renderPage();
      expect(
        screen.getByText(/Reported accessibility issues are treated as high-priority defects/i)
      ).toBeInTheDocument();
    });
  });

  describe("Deterministic Static Metadata & SEO", () => {
    it("renders deterministic static audit date without runtime hydration jitter", () => {
      renderPage();
      expect(screen.getByText(/Last updated: August 14, 2026/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Conformance: WCAG 2.2 Level AA/i)).toBeInTheDocument();
    });

    it("passes accurate accessibility statement metadata to SEO component", () => {
      renderPage();
      expect(capturedSeoProps).not.toBeNull();
      expect(capturedSeoProps?.title).toBe("Accessibility Statement & Web Standards");
      expect(capturedSeoProps?.description).toContain("WCAG 2.2 Level AA");
    });
  });
});
