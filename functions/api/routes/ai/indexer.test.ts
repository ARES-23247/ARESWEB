import { describe, it, expect, vi, beforeEach } from "vitest";
import { indexSiteContent } from "./indexer";

// ── Mock DB (Kysely chain) ────────────────────────────────────────────────
const createMockQuery = () => {
  const q: any = {
    select: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  };
  // Each method returns the same object for chaining
  q.select.mockReturnValue(q);
  q.where.mockReturnValue(q);
  q.orderBy.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  return q;
};

const mockDb: any = {
  selectFrom: vi.fn(() => createMockQuery()),
};

// ── Mock Workers AI ───────────────────────────────────────────────────────
const mockAi = {
  run: vi.fn(),
};

// ── Mock Vectorize ────────────────────────────────────────────────────────
const mockVectorize: any = {
  upsert: vi.fn().mockResolvedValue(undefined),
};

// ── Mock KV ───────────────────────────────────────────────────────────────
const mockKv: any = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
};

describe("indexSiteContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default mock implementations after clearAllMocks
    mockDb.selectFrom.mockImplementation(() => createMockQuery());
    mockAi.run.mockResolvedValue({ data: [] });
    mockVectorize.upsert.mockResolvedValue(undefined);
    mockKv.get.mockResolvedValue(null);
    mockKv.put.mockResolvedValue(undefined);
  });

  it("returns 0 indexed when DB has no public content", async () => {
    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    // Should query events, posts, docs, seasons (4 selectFrom calls)
    expect(mockDb.selectFrom).toHaveBeenCalledTimes(4);
    // Should NOT call AI or Vectorize when nothing to index
    expect(mockAi.run).not.toHaveBeenCalled();
    expect(mockVectorize.upsert).not.toHaveBeenCalled();
  });

  it("indexes events and generates embeddings", async () => {
    const mockQuery = createMockQuery();
    mockQuery.execute.mockResolvedValue([
      { title: "Practice", description: "Weekly practice", date_start: "2026-05-01T18:00:00Z", date_end: null, location: "Lab", category: "practice" },
    ]);
    // First selectFrom = events
    mockDb.selectFrom.mockImplementationOnce(() => mockQuery);

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(1);
    expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", expect.any(Object));
    expect(mockVectorize.upsert).toHaveBeenCalledTimes(1);
    // Verify KV timestamp was updated
    expect(mockKv.put).toHaveBeenCalledWith("rag_last_indexed", expect.any(String));
  });

  it("indexes posts with AST content extraction", async () => {
    const eventsQuery = createMockQuery();
    const postsQuery = createMockQuery();
    postsQuery.execute.mockResolvedValue([
      { slug: "hello-world", title: "Hello World", ast: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test body" }] }] }), published_at: "2026-04-01" },
    ]);

    mockDb.selectFrom
      .mockImplementationOnce(() => eventsQuery)  // events
      .mockImplementationOnce(() => postsQuery);   // posts

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("indexes docs with incremental timestamp filter", async () => {
    mockKv.get.mockResolvedValue("2026-04-29T00:00:00Z");

    const eventsQuery = createMockQuery();
    const postsQuery = createMockQuery();
    const docsQuery = createMockQuery();
    docsQuery.execute.mockResolvedValue([
      { slug: "getting-started", title: "Getting Started", content: "Setup guide", category: "guide" },
    ]);

    mockDb.selectFrom
      .mockImplementationOnce(() => eventsQuery)
      .mockImplementationOnce(() => postsQuery)
      .mockImplementationOnce(() => docsQuery);

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(1);
    // Verify incremental: KV was read
    expect(mockKv.get).toHaveBeenCalledWith("rag_last_indexed");
    // Verify the docs query chain got a where("updated_at", ">", ...) call
    expect(docsQuery.where).toHaveBeenCalled();
  });

  it("force mode skips KV timestamp check", async () => {
    mockKv.get.mockResolvedValue("2026-04-29T00:00:00Z");

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv, { force: true });

    // KV.get should NOT be called in force mode
    expect(mockKv.get).not.toHaveBeenCalled();
    expect(result.indexed).toBe(0); // no data in mock DB
  });

  it("handles DB errors gracefully per-section", async () => {
    const failQuery = createMockQuery();
    failQuery.execute.mockRejectedValue(new Error("DB connection lost"));

    // All 4 queries fail
    mockDb.selectFrom.mockImplementation(() => failQuery);

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(0);
    expect(result.errors.length).toBe(4);
    expect(result.errors[0]).toContain("Events indexing failed");
    expect(result.errors[1]).toContain("Posts indexing failed");
    expect(result.errors[2]).toContain("Docs indexing failed");
    expect(result.errors[3]).toContain("Seasons indexing failed");
  });

  it("handles embedding API returning mismatched results", async () => {
    const eventsQuery = createMockQuery();
    eventsQuery.execute.mockResolvedValue([
      { title: "Event A", description: "Test", date_start: "2026-05-01", date_end: null, location: "Lab", category: "practice" },
      { title: "Event B", description: "Test", date_start: "2026-05-02", date_end: null, location: "Lab", category: "meeting" },
    ]);
    mockDb.selectFrom.mockImplementationOnce(() => eventsQuery);

    // Return only 1 embedding for 2 documents
    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2]] });

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.errors).toContainEqual(expect.stringContaining("mismatched results"));
    expect(mockVectorize.upsert).not.toHaveBeenCalled();
  });

  it("handles vectorize upsert failure", async () => {
    const eventsQuery = createMockQuery();
    eventsQuery.execute.mockResolvedValue([
      { title: "Event", description: "x", date_start: "2026-05-01", date_end: null, location: "Lab", category: "practice" },
    ]);
    mockDb.selectFrom.mockImplementationOnce(() => eventsQuery);

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2]] });
    mockVectorize.upsert.mockRejectedValue(new Error("Vectorize quota exceeded"));

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.errors).toContainEqual(expect.stringContaining("upsert failed"));
    expect(result.indexed).toBe(0);
  });

  it("works without KV (optional param)", async () => {
    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, undefined);

    expect(result.indexed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("indexes seasons with published status filter", async () => {
    const eventsQuery = createMockQuery();
    const postsQuery = createMockQuery();
    const docsQuery = createMockQuery();
    const seasonsQuery = createMockQuery();
    seasonsQuery.execute.mockResolvedValue([
      { start_year: 2025, challenge_name: "Into The Deep", robot_name: "ARES", summary: "Great season", robot_description: "Powerful bot" },
    ]);

    let callCount = 0;
    mockDb.selectFrom.mockImplementation(() => {
      callCount++;
      switch (callCount) {
        case 1: return eventsQuery;
        case 2: return postsQuery;
        case 3: return docsQuery;
        case 4: return seasonsQuery;
        default: return createMockQuery();
      }
    });

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

    const result = await indexSiteContent(mockDb, mockAi, mockVectorize, mockKv);

    expect(result.indexed).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
