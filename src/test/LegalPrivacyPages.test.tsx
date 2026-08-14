import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PrivacyPage from "../app/privacy/page";
import TermsPage from "../app/terms/page";
import { siteConfig } from "@/lib/site-config";

vi.mock("@/components/SEO", () => ({ default: () => null }));

function renderInRouter(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe("Privacy Policy Page (PrivacyPage)", () => {
  it("renders semantic landmark structure and core policy heading", () => {
    renderInRouter(<PrivacyPage />);

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("id", "main-content");

    const heading = screen.getByRole("heading", { level: 1, name: /privacy policy/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/committed to engineering privacy/i)).toBeInTheDocument();
  });

  it("renders all five privacy policy sections in proper sequential order", () => {
    renderInRouter(<PrivacyPage />);

    const sectionHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(sectionHeadings).toHaveLength(5);
    expect(sectionHeadings[0]).toHaveTextContent("1. Cookie-Free Web Analytics");
    expect(sectionHeadings[1]).toHaveTextContent("2. COPPA & Student Privacy");
    expect(sectionHeadings[2]).toHaveTextContent("3. Secure AI Processing");
    expect(sectionHeadings[3]).toHaveTextContent("4. ARES Analytics and Google Drive");
    expect(sectionHeadings[4]).toHaveTextContent("5. Secure Administration");
  });

  it("verifies cookie-free analytics disclosure and no tracking cookies clause", () => {
    renderInRouter(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "1. Cookie-Free Web Analytics" })).toBeInTheDocument();
    expect(screen.getByText(/explicitly disabled HTTP cookie storage/i)).toBeInTheDocument();
    expect(screen.getByText(/strictly in the browser's local storage, preventing HTTP tracking cookies/i)).toBeInTheDocument();
    expect(screen.getByText(/no unique user IP addresses are stored or permanently tracked/i)).toBeInTheDocument();
    expect(screen.getByText(/measure basic website traffic/i)).toBeInTheDocument();
  });

  it("verifies COPPA compliance and youth data protection disclosures", () => {
    renderInRouter(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "2. COPPA & Student Privacy" })).toBeInTheDocument();
    expect(screen.getByText(/Children's Online Privacy Protection Act \(COPPA\)/i)).toBeInTheDocument();
    expect(screen.getByText(/operate in an environment inclusive of minors/i)).toBeInTheDocument();
    expect(screen.getByText(/never collect personal information from general web portal visitors/i)).toBeInTheDocument();
    expect(screen.getByText(/explicit written consent and release forms signed by legal guardians/i)).toBeInTheDocument();
    expect(screen.getByText(/recruitment inquiries and contact submissions are encrypted/i)).toBeInTheDocument();

    const ftcLink = screen.getByRole("link", { name: /FIRST Robotics FTC program/i });
    expect(ftcLink).toBeInTheDocument();
    expect(ftcLink).toHaveAttribute("href", "https://www.firstinspires.org/robotics/ftc");
    expect(ftcLink).toHaveAttribute("target", "_blank");
    expect(ftcLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("verifies secure AI processing disclosures", () => {
    renderInRouter(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "3. Secure AI Processing" })).toBeInTheDocument();
    expect(screen.getByText(/Gemini models on Google Vertex AI to add Accessibility tags/i)).toBeInTheDocument();
    expect(screen.getByText(/raw data is never sold, shared, or used to train other AI/i)).toBeInTheDocument();
  });

  it("verifies ARES Analytics desktop OAuth and Google Drive security disclosures", () => {
    renderInRouter(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "4. ARES Analytics and Google Drive" })).toBeInTheDocument();
    expect(screen.getByText(/local-first desktop application/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorization Code with PKCE, and no client secret/i)).toBeInTheDocument();
    expect(screen.getByText(/narrow drive\.file permission/i)).toBeInTheDocument();
    expect(screen.getByText(/does not scan unrelated Drive files/i)).toBeInTheDocument();
    expect(screen.getByText(/DPAPI credential protection/i)).toBeInTheDocument();
    expect(screen.getByText(/signing out removes the local token record/i)).toBeInTheDocument();
  });

  it("verifies secure role-based administration clause and contact accessibility", () => {
    renderInRouter(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "5. Secure Administration" })).toBeInTheDocument();
    expect(screen.getByText(/strictly locked behind role-based authentication/i)).toBeInTheDocument();

    const contactLink = screen.getByRole("link", { name: `Send an email to ${siteConfig.team.name} robotics team` });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", `mailto:${siteConfig.contact.email}`);
    expect(screen.getByText(/Last updated: August 14, 2026/i)).toBeInTheDocument();
  });
});

describe("Terms of Service Page (TermsPage)", () => {
  it("renders semantic landmark structure and terms heading", () => {
    renderInRouter(<TermsPage />);

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("id", "main-content");

    const heading = screen.getByRole("heading", { level: 1, name: /terms of service/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/govern your use of the ARES 23247 Web Portal/i)).toBeInTheDocument();
  });

  it("renders all four terms sections in proper sequential order", () => {
    renderInRouter(<TermsPage />);

    const sectionHeadings = screen.getAllByRole("heading", { level: 2 });
    expect(sectionHeadings).toHaveLength(4);
    expect(sectionHeadings[0]).toHaveTextContent("1. General Provisions & Acceptance");
    expect(sectionHeadings[1]).toHaveTextContent("2. Acceptable Use & Conduct");
    expect(sectionHeadings[2]).toHaveTextContent("3. Sponsorships, Payments & Refunds");
    expect(sectionHeadings[3]).toHaveTextContent("4. Liability & Jurisdiction");
  });

  it("verifies general provisions and desktop application terms", () => {
    renderInRouter(<TermsPage />);

    expect(screen.getByRole("heading", { name: "1. General Provisions & Acceptance" })).toBeInTheDocument();
    expect(screen.getByText(/registered FIRST® Tech Challenge robotics team located in the United States/i)).toBeInTheDocument();
    expect(screen.getByText(/optional online features of the ARES Analytics desktop application/i)).toBeInTheDocument();
  });

  it("verifies acceptable use, Gracious Professionalism, and security conduct rules", () => {
    renderInRouter(<TermsPage />);

    expect(screen.getByRole("heading", { name: "2. Acceptable Use & Conduct" })).toBeInTheDocument();
    expect(screen.getByText(/Gracious Professionalism®, the core ethos of FIRST® Robotics/i)).toBeInTheDocument();
    expect(screen.getByText(/damage, impairment, or disruption to its availability/i)).toBeInTheDocument();
    expect(screen.getByText(/data mining, unauthorized data extraction, or brute-force access attempts/i)).toBeInTheDocument();
    expect(screen.getByText(/maintain the confidentiality of their authentication credentials/i)).toBeInTheDocument();
  });

  it("verifies sponsorship, payments, and refund policies", () => {
    renderInRouter(<TermsPage />);

    expect(screen.getByRole("heading", { name: "3. Sponsorships, Payments & Refunds" })).toBeInTheDocument();
    expect(screen.getByText(/secure payment processor \(Stripe\)/i)).toBeInTheDocument();
    expect(screen.getByText(/do not directly store your credit card information/i)).toBeInTheDocument();
    expect(screen.getByText(/non-refundable contributions to support our educational mission/i)).toBeInTheDocument();
    expect(screen.getByText(/within 7 days of the transaction to request a refund/i)).toBeInTheDocument();
  });

  it("verifies liability disclaimers, jurisdiction, and legal contact link", () => {
    renderInRouter(<TermsPage />);

    expect(screen.getByRole("heading", { name: "4. Liability & Jurisdiction" })).toBeInTheDocument();
    expect(screen.getByText(/provided on an 'as is' basis/i)).toBeInTheDocument();
    expect(screen.getByText(/exclusive jurisdiction of the courts/i)).toBeInTheDocument();

    const legalContactLink = screen.getByRole("link", { name: `Send an email to ${siteConfig.team.name} legal inquiries` });
    expect(legalContactLink).toBeInTheDocument();
    expect(legalContactLink).toHaveAttribute("href", `mailto:${siteConfig.contact.email}`);
    expect(screen.getByText(/Last updated: August 14, 2026/i)).toBeInTheDocument();
  });
});