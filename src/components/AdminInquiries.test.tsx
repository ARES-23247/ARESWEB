import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminInquiries from "./AdminInquiries";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { api } from "../api/client";

// Mock the API client
vi.mock("../api/client", () => ({
  api: {
    inquiries: {
      list: {
        useQuery: vi.fn(),
      },
      updateStatus: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock("nuqs", () => ({
  useQueryState: vi.fn(() => ["", vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AdminInquiries component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    const mockInquiries = [
      {
        id: "test-id-123",
        type: "outreach",
        name: "Test User",
        email: "test@example.com",
        metadata: null,
        status: "pending",
        created_at: new Date().toISOString(),
      }
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.inquiries.list.useQuery as any).mockReturnValue({
      data: { status: 200, body: { inquiries: mockInquiries } },
      isLoading: false,
      isError: false,
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.inquiries.updateStatus.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.inquiries.delete.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should send body: {} when deleting an inquiry to satisfy ts-rest contract requirements", async () => {
    const mutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.inquiries.delete.useMutation as any).mockReturnValue({ mutate, isPending: false });

    render(<AdminInquiries />, { wrapper });
    
    // Find the initial delete button and click it to reveal confirmation
    const deleteBtn = screen.getByRole("button", { name: /DELETE/i });
    fireEvent.click(deleteBtn);
    
    // Click the confirmation button
    const confirmBtn = screen.getByRole("button", { name: /CONFIRM DELETE/i });
    fireEvent.click(confirmBtn);

    // Verify the API is called with the correct payload structure
    expect(mutate).toHaveBeenCalledWith({
      params: { id: "test-id-123" },
      body: {}
    });
  });

  it("should call updateStatus mutation to resolve inquiry", () => {
    const mutate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api.inquiries.updateStatus.useMutation as any).mockReturnValue({ mutate, isPending: false });

    render(<AdminInquiries />, { wrapper });
    
    // Find the RESOLVE button
    const resolveBtn = screen.getByRole("button", { name: /RESOLVE/i });
    fireEvent.click(resolveBtn);

    expect(mutate).toHaveBeenCalledWith({
      params: { id: "test-id-123" },
      body: { status: "resolved" }
    });
  });

  it("should filter inquiries by status", () => {
    render(<AdminInquiries />, { wrapper });
    
    // Inquiry is pending initially, should be in the document
    expect(screen.getByText("Test User")).toBeInTheDocument();
    
    // Click 'resolved' filter
    const resolvedFilterBtn = screen.getByRole("button", { name: /^resolved$/i });
    fireEvent.click(resolvedFilterBtn);
    
    // The pending inquiry should no longer be rendered
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(screen.getByText("No resolved inquiries found.")).toBeInTheDocument();
  });
});
