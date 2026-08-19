import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicResults from "../app/tournaments/PublicResults";

function fetchResponse(body: object, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 503,
    json: async () => body,
  } as Response;
}

describe("public tournament results section", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders published results with dates, locations, and OPR", async () => {
    fetchMock.mockResolvedValue(
      fetchResponse({
        results: [
          {
            id: "t_1",
            name: "WV State Championship",
            seasonName: "BIOBUZZ",
            challengeName: "",
            date: "2026-02-14",
            location: "Fairmont, WV",
            description: "Finalist alliance captains.",
            status: "past",
            opr: 41.2,
          },
        ],
      }),
    );

    render(<PublicResults />);

    await waitFor(() => {
      expect(screen.getByText("WV State Championship")).toBeInTheDocument();
    });
    expect(screen.getByText(/Fairmont, WV/)).toBeInTheDocument();
    expect(screen.getByText(/41\.2/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Competition History/ })).toBeInTheDocument();
  });

  it("shows an honest empty state when nothing is published", async () => {
    fetchMock.mockResolvedValue(fetchResponse({ results: [] }));

    render(<PublicResults />);

    await waitFor(() => {
      expect(screen.getByText(/No competition results have been published yet/)).toBeInTheDocument();
    });
  });

  it("surfaces fetch failures instead of an empty list", async () => {
    fetchMock.mockResolvedValue(fetchResponse({}, false));

    render(<PublicResults />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable right now/);
    });
    expect(screen.queryByText(/No competition results/)).not.toBeInTheDocument();
  });
});
