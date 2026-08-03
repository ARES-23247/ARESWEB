import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendZulipMessage, sendZulipAlert, getZulipUsers, createZulipUser } from "../zulip";

describe("Zulip Integration Library", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("sendZulipMessage", () => {
    it("should return false and warning if credentials are missing", async () => {
      delete process.env.ZULIP_BOT_EMAIL;
      delete process.env.ZULIP_API_KEY;

      const result = await sendZulipMessage("general", "Testing", "Hello Zulip");
      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Integration not active")
      );
    });

    it("should send post request successfully and return true", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await sendZulipMessage("general", "Testing", "Hello Zulip");
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://aresfirst.zulipchat.com/api/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Basic Ym90QHRlYW0ub3JnOnN1cGVyLXNlY3JldC1hcGkta2V5",
          }),
        })
      );
    });

    it("should return false if response is not ok", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad payload structure"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await sendZulipMessage("general", "Testing", "Hello Zulip");
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it("should return false if fetch throws an exception", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network Error")));

      const result = await sendZulipMessage("general", "Testing", "Hello Zulip");
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("sendZulipAlert", () => {
    it("should forward message to admin stream", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";
      process.env.ZULIP_ADMIN_STREAM = "admin-alerts";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const result = await sendZulipAlert("Security", "Auth Failed", "User root tried to do bad things");
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("to=admin-alerts"),
        })
      );
    });
  });

  describe("getZulipUsers", () => {
    it("should return null if credentials are missing", async () => {
      delete process.env.ZULIP_BOT_EMAIL;
      delete process.env.ZULIP_API_KEY;

      const result = await getZulipUsers();
      expect(result).toBeNull();
    });

    it("should fetch and return members array successfully", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockMembers = [{ email: "member1@team.org" }];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ members: mockMembers }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getZulipUsers();
      expect(result).toEqual(mockMembers);
    });

    it("should return empty array if members key is missing in json", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getZulipUsers();
      expect(result).toEqual([]);
    });

    it("should return null and log error if fetch is not ok", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Error"),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getZulipUsers();
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("should return null and log error if fetch throws", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));

      const result = await getZulipUsers();
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("createZulipUser", () => {
    it("should return success false if credentials missing", async () => {
      delete process.env.ZULIP_BOT_EMAIL;
      delete process.env.ZULIP_API_KEY;

      const result = await createZulipUser("new@team.org", "New User");
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Zulip integration is not active"),
      });
    });

    it("should create user successfully", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await createZulipUser("new@team.org", "New User");
      expect(result).toEqual({ success: true });
    });

    it("should return error from response if not ok", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ msg: "Email already in use" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await createZulipUser("new@team.org", "New User");
      expect(result).toEqual({ success: false, error: "Email already in use" });
    });

    it("should return generic error if response not ok and json parse fails", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.reject(new Error("no json")),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await createZulipUser("new@team.org", "New User");
      expect(result).toEqual({ success: false, error: "Zulip API returned status 403" });
    });

    it("should return success false if fetch throws", async () => {
      process.env.ZULIP_BOT_EMAIL = "bot@team.org";
      process.env.ZULIP_API_KEY = "super-secret-api-key";

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Local exception")));

      const result = await createZulipUser("new@team.org", "New User");
      expect(result).toEqual({ success: false, error: "Local exception" });
    });
  });
});
