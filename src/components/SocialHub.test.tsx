import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SocialHub from "./SocialHub";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the sub-components to avoid deep rendering issues
vi.mock("./social", () => ({
  SocialComposer: () => <div data-testid="social-composer">Social Composer</div>,
  SocialCalendar: () => <div data-testid="social-calendar">Social Calendar</div>,
  SocialAnalytics: () => <div data-testid="social-analytics">Social Analytics</div>,
}));

describe("SocialHub component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("renders the Social Media Manager header", () => {
    render(<SocialHub />, { wrapper });
    expect(screen.getByText("Social Media Manager")).toBeDefined();
    expect(screen.getByText(/Schedule, analyze, and manage posts/i)).toBeDefined();
  });

  it("renders the tabs correctly", () => {
    render(<SocialHub />, { wrapper });
    expect(screen.getByText("Compose")).toBeDefined();
    expect(screen.getByText("Calendar")).toBeDefined();
    expect(screen.getByText("Analytics")).toBeDefined();
  });

  it("defaults to the Compose tab", () => {
    render(<SocialHub />, { wrapper });
    expect(screen.getByTestId("social-composer")).toBeDefined();
  });
});
