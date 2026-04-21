import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

describe("App Router Setup", () => {
  it("renders the app successfully without crashing", () => {
    const queryClient = new QueryClient();
    
    const { container } = render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );

    // Navbar mounting should inject main-content block.
    expect(container.querySelector("#main-content")).toBeInTheDocument();
  });
});
