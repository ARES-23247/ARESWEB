import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DeveloperApiPage from "../app/developer-api/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));

describe("DeveloperApiPage Reference Documentation UX", () => {
  it("renders API Reference heading, back-link to home, and supported endpoint table", () => {
    render(
      <MemoryRouter>
        <DeveloperApiPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "API Reference" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to the website/i })).toHaveAttribute("href", "/");

    expect(screen.getByRole("heading", { name: /Supported public reads/i })).toBeInTheDocument();

    // Verify key public endpoints are listed
    expect(screen.getByText("/api/calendar/events")).toBeInTheDocument();
    expect(screen.getByText("/api/photos/public")).toBeInTheDocument();
    expect(screen.getByText("/api/videos/public")).toBeInTheDocument();
    expect(screen.getByText("/api/robots")).toBeInTheDocument();
    expect(screen.getByText("/api/sponsors")).toBeInTheDocument();
    expect(screen.getByText("/api/outreach")).toBeInTheDocument();
    expect(screen.getByText("/api/finance")).toBeInTheDocument();
    expect(screen.getByText("/api/simulations")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Integration expectations/i })).toBeInTheDocument();
    expect(
      screen.getByText(/ARESWEB does not offer personal access tokens or a public interactive explorer/i)
    ).toBeInTheDocument();
  });
});
