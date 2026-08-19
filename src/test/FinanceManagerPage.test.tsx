import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinanceManagerPage from "../app/dashboard/finance/page";
import { authenticatedFetch } from "../lib/api";

const authState = vi.hoisted(() => ({
  authorizedUser: { role: "coach" as "coach" | "member" | "admin" },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
}));

vi.mock("../lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

function response(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
  } as Response;
}

describe("finance manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authorizedUser = { role: "coach" };
  });

  it("renders the admin ledger with lifecycle and receipt markers", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(
      response({
        transactions: [
          { id: "fin_1", date: "2026-08-01", amount: 123.45, type: "expense", category: "Parts", description: "REV hubs", seasonId: 2026, status: "published", isDeleted: 0, receiptUrl: "https://drive.example/r" },
          { id: "fin_2", date: "2026-07-01", amount: 500, type: "income", category: "Sponsorship", description: "Local sponsor", seasonId: 2026, status: "void", isDeleted: 1 },
        ],
      }),
    );

    render(<FinanceManagerPage />);

    await waitFor(() => {
      expect(screen.getByText(/REV hubs/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Local sponsor/)).toBeInTheDocument();
    expect(screen.getByText("Void")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
        expect(
      screen.getByText((_, element) => element?.textContent.includes("receipt attached") && element.tagName === "P"),
    ).toBeInTheDocument();
    expect(screen.getByText("Restore")).toBeInTheDocument();
  });

  it("shows an explicit error state when the ledger fails to load", async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("HTTP 503"));

    render(<FinanceManagerPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("unavailable: HTTP 503");
    });
    expect(screen.queryByText(/No transactions recorded yet/)).not.toBeInTheDocument();
  });

  it("records a transaction through the validated admin API", async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({ transactions: [] }))
      .mockResolvedValueOnce(response({ success: true, id: "fin_new" }))
      .mockResolvedValueOnce(response({ transactions: [] }));

    render(<FinanceManagerPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New transaction/ }));

    await fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "42.50" } });
    await fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Field tickets" } });
    fireEvent.click(screen.getByRole("button", { name: /Record transaction/ }));

    await waitFor(() => {
      expect(authenticatedFetch).toHaveBeenCalledWith(
        "/api/finance/admin",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const body = JSON.parse(
      (vi.mocked(authenticatedFetch).mock.calls[1][1] as RequestInit).body as string,
    );
    expect(body).toMatchObject({ amount: 42.5, description: "Field tickets", type: "expense" });
  });

  it("denies members and mentors the ledger", () => {
    authState.authorizedUser = { role: "member" };
    render(<FinanceManagerPage />);
    expect(
      screen.getByText(/Only an admin or coach can manage the finance ledger/),
    ).toBeInTheDocument();
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });
});
