import { describe, it, expect, vi, beforeEach } from "vitest";
import { validate } from "../validation";
import { Response, NextFunction } from "express";
import { ApiError } from "../errorHandler";
import { z } from "zod";

describe("Validation Middleware", () => {
  let req: any;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: {} };
    res = {};
    next = vi.fn() as unknown as NextFunction;
  });

  it("should call next() if request body is valid", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    req.body = { name: "ARES", age: 23 };
    const middleware = validate(schema);
    middleware(req, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "ARES", age: 23 });
  });

  it("should bubble validation error to next() as ApiError if request body is invalid", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    req.body = { name: 123, age: "twenty-three" };
    const middleware = validate(schema);
    middleware(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = vi.mocked(next).mock.calls[0][0] as ApiError;
    expect(err.status).toBe(400);
    expect(err.message).toContain("Validation failed");
    expect(err.message).toContain("name: Expected string, received number");
    expect(err.message).toContain("age: Expected number, received string");
  });

  it("should propagate non-Zod errors directly", () => {
    const schema = {
      parse: () => {
        throw new Error("Generic error");
      }
    } as any;
    const middleware = validate(schema);
    middleware(req, res as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = vi.mocked(next).mock.calls[0][0] as Error;
    expect(err.message).toBe("Generic error");
  });
});
