import { expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import { waggleCommunity } from "@/lib/waggleCommunity";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));

it("injects the shared authenticated/App Check transport into community access", async () => {
  vi.mocked(authenticatedFetch).mockResolvedValueOnce(
    Response.json({ gardens: [], nextCursor: null }),
  );
  await expect(waggleCommunity.browse()).resolves.toEqual({
    gardens: [],
    nextCursor: null,
  });
  expect(authenticatedFetch).toHaveBeenCalledWith(
    "/api/waggle-way/gardens",
    expect.objectContaining({ method: "GET", cache: "no-store" }),
  );
});
