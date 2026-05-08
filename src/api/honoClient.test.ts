import { describe, it, expect, vi } from "vitest";
import { ApiError, unwrapResponse } from "./honoClient";

describe("honoClient", () => {
  describe("ApiError", () => {
    it("should create error with status and message", () => {
      const error = new ApiError(404, "Not Found");
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not Found");
      expect(error.name).toBe("ApiError");
    });

    it("should preserve stack trace", () => {
      const error = new ApiError(500, "Server Error");
      expect(error.stack).toBeDefined();
    });
  });

  describe("unwrapResponse", () => {
    it("should return data on successful response", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: "test" }),
      };
      const result = await unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0]);
      expect(result).toEqual({ success: true, data: "test" });
    });

    it("should throw ApiError with custom error message on failure", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Bad Request" }),
      };
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow(ApiError);
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow("Bad Request");
    });

    it("should throw ApiError with default message on failure without error field", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({}),
      };
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow(ApiError);
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow("API Error: 404");
    });

    it("should throw ApiError with default message when json parse fails", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      };
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow(ApiError);
      await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow("API Error: 500");
    });

    it("should handle various HTTP status codes", async () => {
      const statusCodes = [400, 401, 403, 404, 500, 502, 503];
      for (const status of statusCodes) {
        const mockResponse = {
          ok: false,
          status,
          json: vi.fn().mockResolvedValue({}),
        };
        await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow(ApiError);
        await expect(unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0])).rejects.toThrow(`API Error: ${status}`);
      }
    });

    it("should preserve ApiError status property", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ error: "Forbidden" }),
      };
      try {
        await unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0]);
        expect.fail("Should have thrown ApiError");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as unknown as ApiError).status).toBe(403);
      }
    });

    it("should return typed data", async () => {
      interface TestData {
        id: string;
        name: string;
      }
      const mockData: TestData = { id: "123", name: "Test" };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      };
      const result = await unwrapResponse<TestData>(mockResponse as unknown as Parameters<typeof unwrapResponse>[0]);
      expect(result).toEqual(mockData);
      expect(result.id).toBe("123");
      expect(result.name).toBe("Test");
    });

    it("should handle empty response data", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(null),
      };
      const result = await unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0]);
      expect(result).toBeNull();
    });

    it("should handle array response data", async () => {
      const mockData = [{ id: "1" }, { id: "2" }];
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      };
      const result = await unwrapResponse(mockResponse as unknown as Parameters<typeof unwrapResponse>[0]);
      expect(result).toEqual(mockData);
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
