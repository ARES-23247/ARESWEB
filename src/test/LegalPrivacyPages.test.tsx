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
    expect(main).toHaveTextContent(/committed to engineering privacy/i);
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

    const section = screen.getByRole("heading", { name: "1. Cookie-Free Web Analytics" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/explicitly disabled HTTP cookie storage/i);
    expect(section).toHaveTextContent(/strictly in the browser's local storage, preventing HTTP tracking cookies/i);
    expect(section).toHaveTextContent(/no unique user IP addresses are stored or permanently tracked/i);
    expect(section).toHaveTextContent(/measure basic website traffic/i);
  });

  it("verifies COPPA compliance and youth data protection disclosures", () => {
    renderInRouter(<PrivacyPage />);

    const section = screen.getByRole("heading", { name: "2. COPPA & Student Privacy" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/Children's Online Privacy Protection Act \(COPPA\)/i);
    expect(section).toHaveTextContent(/operate in an environment inclusive of minors/i);
    expect(section).toHaveTextContent(/never collect personal information from general web portal visitors/i);
    expect(section).toHaveTextContent(/explicit written consent and release forms signed by legal guardians/i);
    expect(section).toHaveTextContent(/recruitment inquiries and contact submissions are encrypted/i);

    const ftcLink = screen.getByRole("link", { name: /FIRST Robotics FTC program/i });
    expect(ftcLink).toBeInTheDocument();
    expect(ftcLink).toHaveAttribute("href", "https://www.firstinspires.org/robotics/ftc");
    expect(ftcLink).toHaveAttribute("target", "_blank");
    expect(ftcLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("verifies secure AI processing disclosures", () => {
    renderInRouter(<PrivacyPage />);

    const section = screen.getByRole("heading", { name: "3. Secure AI Processing" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/Gemini models on Google Vertex AI to add Accessibility tags/i);
    expect(section).toHaveTextContent(/raw data is never sold, shared, or used to train other AI/i);
  });

  it("verifies ARES Analytics desktop OAuth and Google Drive security disclosures", () => {
    renderInRouter(<PrivacyPage />);

    const section = screen.getByRole("heading", { name: "4. ARES Analytics and Google Drive" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/local-first desktop application/i);
    expect(section).toHaveTextContent(/Authorization Code with PKCE, and no client secret/i);
    expect(section).toHaveTextContent(/narrow drive\.file permission/i);
    expect(section).toHaveTextContent(/does not scan unrelated Drive files/i);
    expect(section).toHaveTextContent(/DPAPI credential protection/i);
    expect(section).toHaveTextContent(/signing out removes the local token record/i);
  });

  it("verifies secure role-based administration clause and contact accessibility", () => {
    renderInRouter(<PrivacyPage />);

    const section = screen.getByRole("heading", { name: "5. Secure Administration" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/strictly locked behind role-based authentication/i);

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
    expect(main).toHaveTextContent(/govern your use of the ARES 23247 Web Portal/i);
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

    const section = screen.getByRole("heading", { name: "1. General Provisions & Acceptance" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/registered FIRST® Tech Challenge robotics team located in the United States/i);
    expect(section).toHaveTextContent(/optional online features of the ARES Analytics desktop application/i);
  });

  it("verifies acceptable use, Gracious Professionalism, and security conduct rules", () => {
    renderInRouter(<TermsPage />);

    const section = screen.getByRole("heading", { name: "2. Acceptable Use & Conduct" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/Gracious Professionalism®, the core ethos of FIRST® Robotics/i);
    expect(section).toHaveTextContent(/damage, impairment, or disruption to its availability/i);
    expect(section).toHaveTextContent(/data mining, unauthorized data extraction, or brute-force access attempts/i);
    expect(section).toHaveTextContent(/maintain the confidentiality of their authentication credentials/i);
  });

  it("verifies sponsorship, payments, and refund policies", () => {
    renderInRouter(<TermsPage />);

    const section = screen.getByRole("heading", { name: "3. Sponsorships, Payments & Refunds" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/secure payment processor \(Stripe\)/i);
    expect(section).toHaveTextContent(/do not directly store your credit card information/i);
    expect(section).toHaveTextContent(/non-refundable contributions to support our educational mission/i);
    expect(section).toHaveTextContent(/within 7 days of the transaction to request a refund/i);
  });

  it("verifies liability disclaimers, jurisdiction, and legal contact link", () => {
    renderInRouter(<TermsPage />);

    const section = screen.getByRole("heading", { name: "4. Liability & Jurisdiction" }).closest("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveTextContent(/provided on an 'as is' basis/i);
    expect(section).toHaveTextContent(/exclusive jurisdiction of the courts/i);

    const legalContactLink = screen.getByRole("link", { name: `Send an email to ${siteConfig.team.name} legal inquiries` });
    expect(legalContactLink).toBeInTheDocument();
    expect(legalContactLink).toHaveAttribute("href", `mailto:${siteConfig.contact.email}`);
    expect(screen.getByText(/Last updated: August 14, 2026/i)).toBeInTheDocument();
  });
});