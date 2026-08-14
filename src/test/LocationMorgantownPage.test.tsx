import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LocationMorgantownPage from "../app/location-morgantown/page";
import { siteConfig } from "@/lib/site-config";
import { MOCK_LOCATIONS } from "@/utils/constants";

vi.mock("@/components/SEO", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="mock-seo" data-title={title} data-description={description} />
  ),
}));

vi.mock("@/components/BreadcrumbSchema", () => ({
  default: ({ breadcrumbs }: { breadcrumbs: Array<{ name: string; path: string }> }) => (
    <div data-testid="mock-breadcrumbs" data-count={breadcrumbs.length} />
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LocationMorgantownPage />
    </MemoryRouter>
  );
}

describe("LocationMorgantownPage - Morgantown Regional Robotics & STEM Hub", () => {
  it("renders hero section with regional STEM hub header, badge, and primary action links", () => {
    renderPage();

    // Hero title & regional badge
    expect(screen.getByRole("heading", { level: 1, name: /Robotics in Morgantown/i })).toBeInTheDocument();
    expect(screen.getByText(/Morgantown, West Virginia • Regional STEM Hub/i)).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          (element?.textContent?.includes("North Central West Virginia") ?? false) &&
          (element?.textContent?.includes("STEM innovation hub") ?? false)
        );
      })
    ).toBeInTheDocument();

    // CTA links in hero
    const joinLink = screen.getAllByRole("link", { name: /Join Our Team/i })[0];
    expect(joinLink).toBeInTheDocument();
    expect(joinLink).toHaveAttribute("href", "/join");

    const calendarLink = screen.getAllByRole("link", { name: /View Team Calendar/i })[0];
    expect(calendarLink).toBeInTheDocument();
    expect(calendarLink).toHaveAttribute("href", "/calendar");

    const contactLink = screen.getByRole("link", { name: /Contact Hub/i });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", `mailto:${siteConfig.contact.email}`);
  });

  it("renders hub stats and summary highlights", () => {
    renderPage();

    expect(screen.getByText("Morgantown Lab Spaces")).toBeInTheDocument();
    expect(screen.getByText("Grades 7–12")).toBeInTheDocument();
    expect(screen.getByText("Monongalia & Harrison")).toBeInTheDocument();
    expect(screen.getByText("100% Free")).toBeInTheDocument();
  });

  it("renders laboratory facilities with physical addresses and descriptions", () => {
    renderPage();

    // Facility Section Header
    expect(
      screen.getByRole("heading", { level: 2, name: /Morgantown Laboratories & Venues/i })
    ).toBeInTheDocument();

    // Verify all mock locations from constants
    for (const loc of MOCK_LOCATIONS) {
      expect(screen.getByRole("heading", { level: 3, name: loc.name })).toBeInTheDocument();
      expect(screen.getByText(loc.address)).toBeInTheDocument();
      if (loc.description) {
        expect(screen.getByText(loc.description)).toBeInTheDocument();
      }
    }

    // Explicit verification of each key facility
    expect(screen.getByText("123 Science Way, Morgantown, WV 26508")).toBeInTheDocument();
    expect(screen.getByText("456 Tech Lane, Morgantown, WV 26505")).toBeInTheDocument();
    expect(screen.getByText("9500 Mall Road, Morgantown, WV 26501")).toBeInTheDocument();

    expect(screen.getByText("Primary Lab & Arena")).toBeInTheDocument();
    expect(screen.getByText("Machining & Prototyping")).toBeInTheDocument();
    expect(screen.getByText("Public Outreach Venue")).toBeInTheDocument();
  });

  it("provides external Google Maps directions links with security attributes and accessible labels", () => {
    renderPage();

    for (const loc of MOCK_LOCATIONS) {
      if (loc.gmapsUrl) {
        const directionsLink = screen.getByRole("link", {
          name: new RegExp(`Get directions to ${loc.name} on Google Maps`, "i"),
        });
        expect(directionsLink).toBeInTheDocument();
        expect(directionsLink).toHaveAttribute("href", loc.gmapsUrl);
        expect(directionsLink).toHaveAttribute("target", "_blank");
        expect(directionsLink).toHaveAttribute("rel", "noopener noreferrer");
      }
    }
  });

  it("renders laboratory access and visiting safety guidelines under FIRST YPP", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 4, name: /Laboratory Access & Visiting Guidelines/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          (element?.textContent?.includes("Youth Protection Program") ?? false)
        );
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Schedule Lab Visit/i })).toHaveAttribute("href", "/join");
  });

  it("renders Monongalia and Harrison county regional outreach footprints with local community hubs", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: /Monongalia & Harrison Counties Outreach/i })
    ).toBeInTheDocument();

    // Monongalia County Footprint
    expect(
      screen.getByRole("heading", { level: 3, name: /Monongalia County STEM Footprint/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Cheat Lake, Westover, Star City, Brookhaven/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Build Workshops:/i)).toBeInTheDocument();
    expect(screen.getByText(/Public Library STEM Demos:/i)).toBeInTheDocument();
    expect(screen.getByText(/School Robotics Mentoring:/i)).toBeInTheDocument();

    // Harrison County Footprint
    expect(
      screen.getByRole("heading", { level: 3, name: /Harrison County STEM Footprint/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Clarksburg, Bridgeport, Shinnston, Salem/i)).toBeInTheDocument();
    expect(screen.getByText(/Inter-County Scrimmages:/i)).toBeInTheDocument();
    expect(screen.getByText(/Regional Kickoff Clinics:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-County Commuter Support:/i)).toBeInTheDocument();

    // Commuters note
    expect(
      screen.getByText(/Marion, Preston, and Taylor counties as well as southwestern Pennsylvania/i)
    ).toBeInTheDocument();
  });

  it("renders robotics programs and who can join eligibility criteria", () => {
    renderPage();

    // Programs
    expect(screen.getByRole("heading", { level: 2, name: /Robotics Programs in Morgantown/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /FIRST.*Tech Challenge/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /STEM Education/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Community Outreach/i })).toBeInTheDocument();

    // Eligibility
    expect(screen.getByRole("heading", { level: 2, name: /Who Can Join\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Students \(Grades 7–12\)/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /Mentors & Volunteers/i })).toBeInTheDocument();
    expect(screen.getByText(/No prior robotics or coding experience required/i)).toBeInTheDocument();
    expect(screen.getByText(/100% free participation funded through community sponsorships/i)).toBeInTheDocument();
  });

  it("renders direct contact methods and inquiry channels", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: /Get in Touch with Our Morgantown Team/i })
    ).toBeInTheDocument();

    // Direct Email
    const directEmailLink = screen.getByRole("link", { name: siteConfig.contact.email });
    expect(directEmailLink).toBeInTheDocument();
    expect(directEmailLink).toHaveAttribute("href", `mailto:${siteConfig.contact.email}`);

    // Join Application
    const joinAppFormLink = screen.getByRole("link", { name: /Complete Join Form →/i });
    expect(joinAppFormLink).toBeInTheDocument();
    expect(joinAppFormLink).toHaveAttribute("href", "/join");

    // Calendar
    const calendarChannelLink = screen.getByRole("link", { name: /View Calendar →/i });
    expect(calendarChannelLink).toBeInTheDocument();
    expect(calendarChannelLink).toHaveAttribute("href", "/calendar");
  });

  it("renders bottom CTA section with join and STEM demo request links", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 2, name: /Ready to Start Your Robotics Journey\?/i })
    ).toBeInTheDocument();

    const applyButton = screen.getByRole("link", { name: /Apply to Join ARES/i });
    expect(applyButton).toBeInTheDocument();
    expect(applyButton).toHaveAttribute("href", "/join");

    const demoRequestButton = screen.getByRole("link", { name: /Request STEM Demo/i });
    expect(demoRequestButton).toBeInTheDocument();
    expect(demoRequestButton).toHaveAttribute("href", "/outreach");
  });

  it("integrates SEO metadata and breadcrumb structured data", () => {
    renderPage();

    const seoElement = screen.getByTestId("mock-seo");
    expect(seoElement).toHaveAttribute("data-title", "Robotics & STEM Hub in Morgantown, West Virginia | ARES 23247");
    expect(seoElement).toHaveAttribute(
      "data-description",
      expect.stringContaining("Morgantown, West Virginia")
    );

    const breadcrumbsElement = screen.getByTestId("mock-breadcrumbs");
    expect(breadcrumbsElement).toHaveAttribute("data-count", "2");
  });
});
