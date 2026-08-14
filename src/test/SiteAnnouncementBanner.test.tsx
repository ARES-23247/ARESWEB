import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SiteAnnouncementBanner, {
  ANNOUNCEMENT_UPDATED_EVENT,
} from "@/components/SiteAnnouncementBanner";

vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const announcement = {
  message: "Practice starts at 7 tonight.",
  severity: "urgent",
  link: "/calendar",
  linkLabel: "View calendar",
  revision: "revision-1",
  startsAt: null,
  endsAt: null,
};

function renderBanner() {
  return render(
    <BrowserRouter>
      <SiteAnnouncementBanner />
    </BrowserRouter>,
  );
}

describe("SiteAnnouncementBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 76,
      height: 76,
      left: 0,
      right: 390,
      top: 0,
      width: 390,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty("--site-announcement-height");
  });

  it("shows a prominent public urgent alert with mobile-sized actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, announcement }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderBanner();

    const banner = await screen.findByRole("alert", { name: "Urgent team alert" });
    expect(banner).toHaveClass("fixed", "top-0", "z-[70]");
    expect(screen.getByText(announcement.message)).toBeVisible();
    expect(screen.getByRole("link", { name: "View calendar" })).toHaveAttribute("href", "/calendar");
    expect(screen.getByRole("button", { name: "Dismiss team announcement" })).toHaveClass("h-11", "w-11");
    expect(document.documentElement.style.getPropertyValue("--site-announcement-height")).toBe("76px");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/announcements",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("dismisses only the current revision and removes its layout offset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, announcement }),
      }),
    );
    renderBanner();
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss team announcement" }));

    expect(screen.queryByText(announcement.message)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("ares.dismissedAnnouncementRevision")).toBe("revision-1");
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--site-announcement-height")).toBe(""),
    );
  });

  it("keeps an already-dismissed revision hidden", async () => {
    window.localStorage.setItem("ares.dismissedAnnouncementRevision", "revision-1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, announcement }),
      }),
    );
    renderBanner();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(announcement.message)).not.toBeInTheDocument();
  });

  it("fails closed for malformed or externally linked public data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          announcement: { ...announcement, link: "https://phishing.example" },
        }),
      }),
    );
    renderBanner();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(announcement.message)).not.toBeInTheDocument();
  });

  it("renders no empty or error placeholder when there is no active announcement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, announcement: null }),
      }),
    );
    const { container } = renderBanner();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("refreshes after a publisher event and on the visible-page interval", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, announcement: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderBanner();

    await act(async () => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event(ANNOUNCEMENT_UPDATED_EVENT)));
    await act(async () => Promise.resolve());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
