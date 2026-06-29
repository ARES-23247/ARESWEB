import { describe, it, expect, vi, beforeEach } from "vitest";
import aiRouter from "../ai";

// Mock Vertex/Gemini helpers
vi.mock("../../lib/vertex", () => ({
  checkGrammarAndSpelling: vi.fn().mockResolvedValue({
    correctedText: "This is correct.",
    edits: []
  }),
  getAIAssistance: vi.fn().mockResolvedValue("This is help response."),
  getSimulationPlaygroundStream: vi.fn().mockImplementation((sysPrompt, msgs, imgUrl, onChunk) => {
    onChunk("chunk1");
    onChunk("chunk2");
    return Promise.resolve();
  })
}));

describe("AI Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: { uid: "test_uid", email: "test@aresfirst.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = aiRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("POST /api/ai/grammar - Grammar checking", () => {
    it("should check grammar successfully if text is provided", async () => {
      req.body = { text: "Some bad grammer text" };

      const handler = getHandler("/grammar", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ correctedText: "This is correct." })
      );
    });

    it("should fail validation if text is missing", async () => {
      req.body = {};

      const handler = getHandler("/grammar", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing required 'text' field.");
      expect(err.status).toBe(400);
    });

    it("should fail validation if text exceeds maximum character limit", async () => {
      req.body = { text: "a".repeat(20001) };

      const handler = getHandler("/grammar", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Input text exceeds maximum allowed character limit (20,000).");
      expect(err.status).toBe(400);
    });
  });

  describe("POST /api/ai/assistant - AI assistant prompt help", () => {
    it("should get assistance response if prompt is provided", async () => {
      req.body = { prompt: "Write about ARESLib" };

      const handler = getHandler("/assistant", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ response: "This is help response." })
      );
    });

    it("should fail validation if prompt is missing", async () => {
      req.body = {};

      const handler = getHandler("/assistant", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing required 'prompt' field.");
      expect(err.status).toBe(400);
    });

    it("should fail validation if prompt exceeds maximum character limit", async () => {
      req.body = { prompt: "a".repeat(2001) };

      const handler = getHandler("/assistant", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Prompt exceeds maximum allowed character limit (2,000).");
      expect(err.status).toBe(400);
    });
  });

  describe("POST /api/ai/sim-playground - Stream simulation playground responses", () => {
    it("should stream playground chunks successfully", async () => {
      req.body = {
        systemPrompt: "You are a path planner",
        messages: [{ role: "user", content: "Hello" }]
      };

      const handler = getHandler("/sim-playground", "post");
      await handler(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.write).toHaveBeenCalledTimes(2);
      expect(res.end).toHaveBeenCalled();
    });

    it("should fail validation if messages is missing", async () => {
      req.body = {
        systemPrompt: "You are a path planner"
      };

      const handler = getHandler("/sim-playground", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing required 'systemPrompt' or 'messages' fields.");
      expect(err.status).toBe(400);
    });

    it("should fail validation if imageUrl is not a string", async () => {
      req.body = {
        systemPrompt: "You are a path planner",
        messages: [{ role: "user", content: "Hello" }],
        imageUrl: { url: "http://attacker.com" }
      };

      const handler = getHandler("/sim-playground", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Invalid 'imageUrl' parameter. Must be a string.");
      expect(err.status).toBe(400);
    });

    it("should fail validation if image exceeds maximum payload limit", async () => {
      req.body = {
        systemPrompt: "You are a path planner",
        messages: [{ role: "user", content: "Hello" }],
        imageUrl: "data:image/png;base64," + "a".repeat(5 * 1024 * 1024 + 1)
      };

      const handler = getHandler("/sim-playground", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Image payload size exceeds maximum allowed limit (5MB).");
      expect(err.status).toBe(400);
    });
  });
});
