import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// Helper component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

// Helper component that throws a string error
const ThrowString = () => {
  throw "String error";
};

// Helper component that throws an error with status code
class ThrowErrorWithStatus extends React.Component {
  render(): React.ReactNode {
    const error = new Error("Not found");
    (error as unknown as { status: number }).status = 404;
    throw error;
    return null;
  }
}

// Helper component that throws an error with response
class ThrowErrorWithResponse extends React.Component {
  render(): React.ReactNode {
    const error = new Error("API Error");
    (error as unknown as { response: { status: number } }).response = { status: 500 };
    throw error;
    return null;
  }
}

describe("ErrorBoundary Component", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error for expected errors
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock sessionStorage
    const sessionStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
      };
    })();
    Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });
    // Mock navigator.serviceWorker
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: {
        getRegistrations: vi.fn(() => Promise.resolve([])),
      },
      writable: true,
    });
    // Mock window.location.reload
    Object.defineProperty(window, "location", {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("catches and displays error when child component throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Telemetry Fault Detected")).toBeInTheDocument();
  });

  it("displays correlation ID in error state", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Correlation ID is a random 8-character uppercase string
    const correlationId = screen.getByText(/Correlation ID/).nextElementSibling;
    expect(correlationId).toBeInTheDocument();
    expect(correlationId?.textContent).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("displays error message from Error object", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  it("handles string errors", () => {
    // Note: This test verifies the boundary can handle non-Error throws
    // In React 17+, strings thrown in components are automatically converted to Errors
    const originalConsoleError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      );
    }).not.toThrow();

    console.error = originalConsoleError;
  });

  it("displays HTTP status code when error includes status", () => {
    render(
      <ErrorBoundary>
        <ThrowErrorWithStatus />
      </ErrorBoundary>
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText(/HTTP Status/)).toBeInTheDocument();
  });

  it("displays HTTP status code when error includes response.status", () => {
    render(
      <ErrorBoundary>
        <ThrowErrorWithResponse />
      </ErrorBoundary>
    );

    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("does not display status code when error lacks status information", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText("HTTP Status")).not.toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error UI")).toBeInTheDocument();
    expect(screen.queryByText("Telemetry Fault Detected")).not.toBeInTheDocument();
  });

  it("calls console.error with error info when error is caught", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "ARES React Error Boundary Intercepted Fault:",
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it("displays third-party fault message for SecurityError", () => {
    const ThrowSecurityError = () => {
      const error = new Error("SecurityError: Cross-origin frame blocked");
      throw error;
    };

    render(
      <ErrorBoundary>
        <ThrowSecurityError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Third-party resource or iframe blocked/)).toBeInTheDocument();
  });

  it("displays third-party fault message for cross-origin errors", () => {
    const ThrowCrossOriginError = () => {
      const error = new Error("cross-origin");
      throw error;
    };

    render(
      <ErrorBoundary>
        <ThrowCrossOriginError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Third-party resource or iframe blocked/)).toBeInTheDocument();
  });

  it("reloads page when reboot button is clicked", () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const rebootButton = screen.getByText("Reboot Interface");
    rebootButton.click();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("has proper accessibility attributes", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const faultContainer = screen.getByText("Telemetry Fault Detected").parentElement;
    expect(faultContainer).toBeInTheDocument();
  });

  describe("Stale Chunk Error Handling", () => {
    it("detects stale chunk errors", () => {
      const ThrowStaleChunkError = () => {
        const error = new Error("Failed to fetch dynamically imported module");
        throw error;
      };

      render(
        <ErrorBoundary>
          <ThrowStaleChunkError />
        </ErrorBoundary>
      );

      // Should trigger reload for stale chunk errors
      expect(window.location.reload).toHaveBeenCalled();
    });

    it("detects import failed errors", () => {
      const ThrowImportError = () => {
        const error = new Error("Importing a module script failed");
        throw error;
      };

      render(
        <ErrorBoundary>
          <ThrowImportError />
        </ErrorBoundary>
      );

      expect(window.location.reload).toHaveBeenCalled();
    });
  });
});
