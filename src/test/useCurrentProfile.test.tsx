import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import {
  currentProfileQueryKey,
  fetchCurrentProfile,
  useCurrentProfile,
} from "@/hooks/useCurrentProfile";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

const profileResponse = {
  exists: true,
  profile: {
    nickname: "CircuitFox",
    firstName: "",
    lastName: "",
    pronouns: "",
    avatar: "https://images.example.org/avatar.webp",
    bio: "",
    funFact: "",
    favoriteFirstThing: "",
    favoriteRobotMechanism: "",
    preMatchSuperstition: "",
    rookieYear: "",
    leadershipRole: "",
    subteams: [],
    tshirtSize: "",
    dietaryRestrictions: [],
    emergencyContactName: "",
    emergencyContactPhone: "",
    phone: "",
    contactEmail: "",
    showEmail: false,
    showPhone: false,
    showOnAbout: false,
    colleges: [],
    employers: [],
    memberType: "student",
  },
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useCurrentProfile", () => {
  beforeEach(() => {
    vi.mocked(authenticatedFetch).mockReset();
  });

  it("deduplicates concurrent consumers with a UID-scoped cache key", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify(profileResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const wrapper = createWrapper();

    const first = renderHook(() => useCurrentProfile("member-1"), { wrapper });
    const second = renderHook(() => useCurrentProfile("member-1"), { wrapper });

    await waitFor(() => expect(first.result.current.data?.profile.nickname).toBe("CircuitFox"));
    expect(second.result.current.data?.profile.nickname).toBe("CircuitFox");
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/profiles/me",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(currentProfileQueryKey("member-1")).toEqual(["current-profile", "member-1"]);
  });

  it("does not request a profile until a UID is available", () => {
    renderHook(() => useCurrentProfile(undefined), { wrapper: createWrapper() });
    expect(authenticatedFetch).not.toHaveBeenCalled();
  });

  it("preserves HTTP and API diagnostics for failed requests", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ error: "Profile unavailable" }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" },
    }));

    await expect(fetchCurrentProfile()).rejects.toThrow("HTTP 503: Service Unavailable. Profile unavailable");
  });

  it("falls back to the HTTP diagnostic when an error body is not JSON", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response("upstream failure", {
      status: 502,
      statusText: "Bad Gateway",
    }));

    await expect(fetchCurrentProfile()).rejects.toThrow("HTTP 502: Bad Gateway.");
  });

  it("rejects malformed success DTOs", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({ profile: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(fetchCurrentProfile()).rejects.toThrow("invalid response");
  });
});
