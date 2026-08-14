import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TechStackPage from "../app/tech-stack/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => <div data-testid="greek-meander" /> }));

describe("TechStackPage Architectural Truthfulness & UX", () => {
  it("renders the hero banner, core infrastructure architecture cards, and quality standards", () => {
    render(
      <MemoryRouter>
        <TechStackPage />
      </MemoryRouter>
    );

    // Hero Section
    expect(screen.getByRole("heading", { level: 1, name: /Our Tech Stack/i })).toBeInTheDocument();
    expect(screen.getByText(/Championship Architecture/i)).toBeInTheDocument();

    // Core Infrastructure Heading and Cards
    expect(screen.getByRole("heading", { level: 2, name: /Core Infrastructure/i })).toBeInTheDocument();
    expect(screen.getByText("Firebase Hosting & CDN")).toBeInTheDocument();
    expect(screen.getByText("Gemini & Vertex AI")).toBeInTheDocument();
    expect(screen.getByText("Cloud Firestore (NoSQL)")).toBeInTheDocument();
    expect(screen.getByText("Firebase Storage")).toBeInTheDocument();
    expect(screen.getByText("React, Vite, & Express")).toBeInTheDocument();
    expect(screen.getByText("Firestore Live Listeners")).toBeInTheDocument();
    expect(screen.getByText("Progressive Offline (PWA)")).toBeInTheDocument();
    expect(screen.getByText("Three.js WebGL Engine")).toBeInTheDocument();
    expect(screen.getByText("Zulip API Integrations")).toBeInTheDocument();

    // Championship Quality Standards
    expect(screen.getByRole("heading", { level: 2, name: /Championship Quality Standards/i })).toBeInTheDocument();
    expect(screen.getByText("Continuous Integration Gating")).toBeInTheDocument();
    expect(screen.getByText("100% Core Function Coverage")).toBeInTheDocument();
    expect(screen.getByText(/WCAG 2.1 AA Web Accessibility/i)).toBeInTheDocument();
    expect(screen.getByText("FIRST Youth Data Protection")).toBeInTheDocument();
  });
});
