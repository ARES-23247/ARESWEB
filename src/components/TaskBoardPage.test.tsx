import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import TaskBoardPage from "./TaskBoardPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock matchMedia for testing environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the API client
vi.mock("../api/client", () => ({
  api: {
    tasks: {
      list: {
        useQuery: vi.fn().mockReturnValue({
          data: { status: 200, body: { tasks: [] } },
          isLoading: false
        })
      },
      create: {
        mutation: vi.fn()
      },
      update: {
        useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() })
      },
      delete: {
        useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() })
      },
      reorder: {
        useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() })
      }
    }
  }
}));

describe("TaskBoardPage Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithProvider = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  it("renders the Task Board header and Kanban component", () => {
    renderWithProvider(<TaskBoardPage />);
    
    // Check if the header is present
    expect(screen.getAllByText("Task Board").length).toBeGreaterThan(0);
    expect(screen.getByText(/Native D1-powered project management kanban/i)).toBeInTheDocument();
    
    // Check if empty columns from the Kanban board are rendered
    expect(screen.getAllByText("Todo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThan(0);
  });
});
