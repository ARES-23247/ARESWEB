/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { indexSiteContent } from "./indexer";

const KV_KEY = "rag_last_indexed";

// ── Mock DB (Kysely chain) ────────────────────────────────────────────────
interface MockQuery {
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  onConflict: ReturnType<typeof vi.fn>;
  doUpdateSet: ReturnType<typeof vi.fn>;
}

const createMockQuery = (): MockQuery => {
  const q: MockQuery = {
    select: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    executeTakeFirst: vi.fn().mockResolvedValue(null),
    values: vi.fn(),
    onConflict: vi.fn(),
    doUpdateSet: vi.fn(),
  };
  // Each method returns the same object for chaining
  q.select.mockReturnValue(q);
  q.where.mockReturnValue(q);
  q.orderBy.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  q.values.mockReturnValue(q);
  q.onConflict.mockReturnValue(q);
  q.doUpdateSet.mockReturnValue(q);
  return q;
};

// Mock the Drizzle relational query API
interface MockRelationalQuery {
  settings: {
    findFirst: ReturnType<typeof vi.fn>;
  };
}

interface MockDB {
  selectFrom: ReturnType<typeof vi.fn<(table?: string) => MockQuery>>;
  insertInto: ReturnType<typeof vi.fn<(table?: string) => MockQuery>>;
  deleteFrom: ReturnType<typeof vi.fn<(table?: string) => MockQuery>>;
  query: MockRelationalQuery;
}

const mockDb: MockDB = {
  selectFrom: vi.fn(() => createMockQuery()),
  insertInto: vi.fn(() => createMockQuery()),
  deleteFrom: vi.fn(() => createMockQuery()),
  query: {
    settings: {
      findFirst: vi.fn().mockResolvedValue({ key: 'test', value: 'test' }),
    },
  },
};

// ── Mock Workers AI ───────────────────────────────────────────────────────
interface MockAI {
  run: ReturnType<typeof vi.fn>;
}

const mockAi: MockAI = {
  run: vi.fn(),
};

// ── Mock Vectorize ────────────────────────────────────────────────────────
interface MockVectorize {
  upsert: ReturnType<typeof vi.fn>;
}

const mockVectorize: MockVectorize = {
  upsert: vi.fn().mockResolvedValue(undefined),
};

// ── Mock KV ───────────────────────────────────────────────────────────────
interface MockKV {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

const _mockKv: MockKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
};

describe("indexSiteContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set default mock implementations after clearAllMocks
    mockDb.selectFrom.mockImplementation(() => createMockQuery());
    mockDb.query.settings.findFirst.mockResolvedValue({ key: KV_KEY, value: '2026-01-01T00:00:00Z' });
    mockAi.run.mockResolvedValue({ data: [] });
    mockVectorize.upsert.mockResolvedValue(undefined);
  });

  it("returns 0 indexed when DB has no public content", async () => {
    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.indexed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    // Should query settings via query API and events, posts, docs, seasons (4 selectFrom calls)
    expect(mockDb.query.settings.findFirst).toHaveBeenCalled();
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

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.indexed).toBe(1);
    expect(mockAi.run).toHaveBeenCalledWith("@cf/baai/bge-base-en-v1.5", expect.any(Object));
    expect(mockVectorize.upsert).toHaveBeenCalledTimes(1);
    // Verify D1 timestamp was updated
    expect(mockDb.insertInto).toHaveBeenCalled();
  });

  it("indexes posts with AST content extraction", async () => {
    const eventsQuery = createMockQuery();
    const postsQuery = createMockQuery();
    postsQuery.execute.mockResolvedValue([
      { slug: "hello-world", title: "Hello World", ast: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test body" }] }] }), published_at: "2026-04-01" },
    ]);

    mockDb.selectFrom
      .mockImplementationOnce(() => eventsQuery)   // events
      .mockImplementationOnce(() => postsQuery);   // posts

    mockAi.run.mockResolvedValue({ data: [[0.1, 0.2, 0.3]] });

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.indexed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("indexes docs with incremental timestamp filter", async () => {
    mockDb.query.settings.findFirst.mockResolvedValue({ key: KV_KEY, value: "2026-04-29T00:00:00Z" });

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

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.indexed).toBe(1);
    // Verify incremental: D1 setting was read
    expect(mockDb.query.settings.findFirst).toHaveBeenCalled();
    // Verify the docs query chain got a where("updated_at", ">", ...) call
    expect(docsQuery.where).toHaveBeenCalled();
  });

  it("force mode skips D1 timestamp check", async () => {
    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any, { force: true });

    // DB should NOT be queried for settings in force mode
    expect(mockDb.query.settings.findFirst).not.toHaveBeenCalled();
    expect(result.indexed).toBe(0); // no data in mock DB
  });

  it("handles DB errors gracefully per-section", async () => {
    mockDb.query.settings.findFirst.mockResolvedValue(null);

    const failQuery = createMockQuery();
    failQuery.execute.mockRejectedValue(new Error("DB connection lost"));

    // All 4 indexing queries fail
    mockDb.selectFrom.mockReturnValue(failQuery);

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

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

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

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

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.errors).toContainEqual(expect.stringContaining("upsert failed"));
    expect(result.indexed).toBe(0);
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

    const result = await indexSiteContent(mockDb as any, mockAi as any, mockVectorize as any);

    expect(result.indexed).toBe(1);
    expect(result.errors).toEqual([]);
  });
});

