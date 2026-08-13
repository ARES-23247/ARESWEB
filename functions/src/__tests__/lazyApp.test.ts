import { describe, expect, it, vi } from "vitest";
import { createLazyAppHandler } from "../lazyApp";

describe("lazy API application loading", () => {
  it("loads an application once and reuses it", async () => {
    const app = vi.fn();
    const load = vi.fn().mockResolvedValue(app);
    const handler = createLazyAppHandler(load);
    const request = {} as never;
    const response = {} as never;

    await handler(request, response);
    await handler(request, response);

    expect(load).toHaveBeenCalledTimes(1);
    expect(app).toHaveBeenCalledTimes(2);
  });

  it("retries after a transient module initialization failure", async () => {
    const app = vi.fn();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("cold-start failure"))
      .mockResolvedValueOnce(app);
    const handler = createLazyAppHandler(load);

    await expect(handler({} as never, {} as never)).rejects.toThrow("cold-start failure");
    await expect(handler({} as never, {} as never)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
