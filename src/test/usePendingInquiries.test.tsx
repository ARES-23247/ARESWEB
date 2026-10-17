import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingInquiries } from "@/lib/usePendingInquiries";

const mocks = vi.hoisted(() => ({
  auth: { user: { uid: "admin-1" } as { uid: string } | null, authorizedUser: { role: "admin" } },
  fetch: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/api", () => ({ authenticatedFetch: mocks.fetch }));

function Probe() {
  const value = usePendingInquiries();
  return <output>{value.inquiriesState}:{String(value.hasPendingInquiries)}</output>;
}
function setup() {
  const client = new QueryClient();
  const view = render(<><Probe /><Probe /></>, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  return { ...view, client };
}
const result = (hasPending: unknown) => ({ ok: true, json: async () => ({ hasPending }) });
const expectState = (value: string) => waitFor(() => expect(screen.getAllByText(value)).toHaveLength(2));

describe("shared pending inquiry status", () => {
  beforeEach(() => {
    mocks.auth.user = { uid: "admin-1" };
    mocks.auth.authorizedUser.role = "admin";
    mocks.fetch.mockReset().mockResolvedValue(result(true));
  });
  afterEach(() => vi.useRealTimers());

  it("shares requests and refreshes both observers on foreground return", async () => {
    setup();
    await expectState("connected:true");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.fetch.mockResolvedValue(result(false));
    fireEvent(window, new Event("visibilitychange"));
    await expectState("connected:false");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("polls at a bounded interval and cancels on unmount", async () => {
    const view = setup();
    await expectState("connected:true");
    vi.useFakeTimers();
    // Re-render with a fresh identity to start its timer under the fake clock.
    mocks.auth.user = { uid: "admin-2" };
    view.rerender(<><Probe /><Probe /></>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    mocks.fetch.mockResolvedValue(result(false));
    const calls = mocks.fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getAllByText("connected:false")).toHaveLength(2);
    expect(mocks.fetch).toHaveBeenCalledTimes(calls + 1);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(calls + 1);
  });

  it("cancels old identities and never applies their late responses", async () => {
    let resolveOld!: (value: ReturnType<typeof result>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = setup();
    expect(screen.getAllByText("loading:false")).toHaveLength(2);
    const oldSignal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    mocks.auth.user = { uid: "coach-2" };
    mocks.auth.authorizedUser.role = "coach";
    mocks.fetch.mockResolvedValue(result(false));
    view.rerender(<><Probe /><Probe /></>);
    await expectState("connected:false");
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolveOld(result(true)); });
    expect(screen.getAllByText("connected:false")).toHaveLength(2);
    mocks.auth.authorizedUser.role = "member";
    view.rerender(<><Probe /><Probe /></>);
    expect(screen.getAllByText("idle:false")).toHaveLength(2);
    mocks.auth.user = null;
    view.rerender(<><Probe /><Probe /></>);
    expect(screen.getAllByText("idle:false")).toHaveLength(2);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ok: false, status: 503, statusText: "Service Unavailable" },
    { ok: false, status: 403, statusText: "" },
    result("false"),
  ])("exposes failed refreshes as errors and recovers on foreground return", async (failure) => {
    setup();
    await expectState("connected:true");
    mocks.fetch.mockResolvedValue(failure);
    fireEvent(window, new Event("visibilitychange"));
    await expectState("error:false");
    mocks.fetch.mockResolvedValue(result(false));
    fireEvent(window, new Event("visibilitychange"));
    await expectState("connected:false");
  });
});
