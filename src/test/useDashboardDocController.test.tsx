import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DocumentationApprovalReview,
  syndicationChannelDetails,
  useDashboardDocController,
} from "@/hooks/dashboard/useDashboardDocController";

const { authenticatedFetchMock, deleteDocMock, restoreDocMock, saveDocMock } = vi.hoisted(() => ({
  authenticatedFetchMock: vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200,
          headers: { "Content-Type": "application/json" },
        }))),
  deleteDocMock: vi.fn(() => Promise.resolve()),
  restoreDocMock: vi.fn(() => Promise.resolve()),
  saveDocMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/api", () => ({ authenticatedFetch: authenticatedFetchMock }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member_uid", displayName: "CircuitFox", photoURL: "https://avatars.example.org/member.png", },
    authorizedUser: { role: "mentor", name: "CircuitFox" },
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/hooks/useDocumentSync", () => ({
  useDocumentSync: () => ({
    docs: [],
    archivedDocs: [],
    loadingList: false,
    isLive: true,
    connectionState: "connected",
    listError: null,
    loadedCount: 0,
    hasMore: false,
    loadMore: vi.fn(),
    revisions: [],
    loadingRevisions: false,
    revisionError: null,
    fetchRevisions: vi.fn(() => Promise.resolve()),
    saveDoc: saveDocMock,
    deleteDoc: deleteDocMock,
    restoreDoc: restoreDocMock,
  }),
}));

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function documentationReviewPayload(overrides: Record<string, unknown> = {}) {
  const document = {
    slug: "robot-intent",
    title: "Robot intent",
    category: "Robotics & Engineering",
    description: "Turn intent into safe output.",
    content: "# Robot intent",
    status: "pending_approval",
    approvalStatus: "pending_approval",
    sortOrder: 1,
    isDeleted: 0,
    displayInAreslib: 0,
    displayInMathCorner: 1,
    displayInScienceCorner: 0,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    learningSchemaVersion: 1,
    subject: "robotics-engineering",
    topics: ["Safety"],
    contentType: "lesson",
    level: "beginner",
    estimatedMinutes: 20,
    pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
    prerequisites: [],
    objectives: ["Describe robot intent."],
    platforms: ["web"],
    sourceReferences: [],
    safetyScope: "none",
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
  return {
    review: {
      slug: document.slug,
      title: document.title,
      updatedAt: document.updatedAt,
      library: "academy",
      digest: "a".repeat(64),
      document,
    },
  };
}

describe("useDashboardDocController archive workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteDocMock.mockResolvedValue(undefined);
    restoreDocMock.mockResolvedValue(undefined);
    saveDocMock.mockResolvedValue(undefined);
    authenticatedFetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200,
        headers: { "Content-Type": "application/json" },
      }));
  });

  it("translates provider results into truthful per-channel details", () => {
    expect(syndicationChannelDetails({
      syndication: { zulip: true, bluesky: false, buffer: false },
      bufferChannels: {
        facebook: "submitted",
        instagram: "already-submitted",
        twitter: "not-connected",
      },
    })).toEqual([
      { label: "Zulip", detail: "Delivered", ok: true },
      { label: "Bluesky", detail: "Not delivered", ok: false },
      { label: "Facebook", detail: "Submitted immediately via Buffer", ok: true },
      { label: "Instagram", detail: "Already submitted via Buffer", ok: true },
      { label: "X", detail: "Not connected in Buffer", ok: false },
    ]);
    expect(syndicationChannelDetails({
      syndication: { buffer: true },
    })).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Facebook", ok: true }),
      expect.objectContaining({ label: "Instagram", ok: true }),
      expect.objectContaining({ label: "X", ok: true }),
    ]));
  });

  it("requests confirmation without archiving, supports cancel, then archives only after confirmation", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleDelete("safety-guide"));
    expect(result.current.pendingArchiveSlug).toBe("safety-guide");
    expect(deleteDocMock).not.toHaveBeenCalled();

    act(() => result.current.handleCancelArchive());
    expect(result.current.pendingArchiveSlug).toBeNull();

    await act(async () => result.current.handleDelete("safety-guide"));
    await act(async () => result.current.handleConfirmArchive());
    expect(deleteDocMock).toHaveBeenCalledWith("safety-guide");
    expect(result.current.pendingArchiveSlug).toBeNull();
    expect(result.current.archiveError).toBeNull();
  });

  it("keeps the confirmation open and exposes diagnostics when soft archive fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    deleteDocMock.mockRejectedValueOnce(new Error("HTTP 503: Firestore unavailable"));
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleDelete("safety-guide"));
    await act(async () => result.current.handleConfirmArchive());

    expect(result.current.pendingArchiveSlug).toBe("safety-guide");
    expect(result.current.archiveError).toBe("HTTP 503: Firestore unavailable");
    expect(result.current.isArchiving).toBe(false);
  });

  it("preserves the separate restore operation", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleRestore("archived-guide"));

    expect(restoreDocMock).toHaveBeenCalledWith("archived-guide");
  });

  it("saves documentation changes as pending even for an approver", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleSave("robot-intent", {
      title: "Robot intent",
      category: "Robotics & Engineering",
      content: "Reviewed later",
      description: "",
      status: "published",
      approvalStatus: "approved",
    } as never));

    expect(saveDocMock).toHaveBeenCalledWith(
      "robot-intent",
      expect.objectContaining({ status: "pending_approval", approvalStatus: "pending_approval" }),
      "CircuitFox",
      "https://avatars.example.org/member.png",
      { isCreate: true },
    );
  });

  it("loads and approves only the exact documentation DTO returned by the review API", async () => {
    authenticatedFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(documentationReviewPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    let review: DocumentationApprovalReview | null = null;
    await act(async () => {
      review = await result.current.loadDocumentationApprovalReview({
        slug: "robot-intent",
        title: "Old row title",
      } as never, "academy");
    });
    expect(review).toMatchObject({
      digest: "a".repeat(64),
      document: { title: "Robot intent", content: "# Robot intent" },
    });
    await act(async () => {
      await result.current.handleApproveDocumentationReview(review!);
    });

    expect(authenticatedFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/content-admin/docs/robot-intent/review?library=academy",
    );
    expect(authenticatedFetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/content-admin/docs/robot-intent/approve",
      expect.objectContaining({ body: JSON.stringify({ library: "academy", digest: "a".repeat(64) }) }),
    );
    expect(saveDocMock).not.toHaveBeenCalled();
    expect(result.current.approvalNotice).toMatchObject({ kind: "success" });
  });

  it("uses the server review document when the visible row snapshot is stale", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    authenticatedFetchMock.mockResolvedValueOnce(new Response(JSON.stringify(
      documentationReviewPayload({
        title: "Robot intent revised",
        content: "# Revised authoritative content",
        updatedAt: "2026-08-25T13:00:00.000Z",
      }),
    ), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    let review: DocumentationApprovalReview | null = null;
    await act(async () => {
      review = await result.current.loadDocumentationApprovalReview({
        slug: "robot-intent",
        title: "Stale row title",
        content: "Stale row content",
      } as never, "academy");
    });

    expect(authenticatedFetchMock).toHaveBeenCalledTimes(1);
    expect(review).toMatchObject({
      document: {
        title: "Robot intent revised",
        content: "# Revised authoritative content",
      },
    });
    expect(result.current.approvalNotice).toBeNull();
  });

  it("rejects a malformed documentation review DTO before opening approval", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    authenticatedFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      review: { slug: "robot-intent", library: "academy", digest: "a".repeat(64) },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    let review: DocumentationApprovalReview | null = null;
    await act(async () => {
      review = await result.current.loadDocumentationApprovalReview({ slug: "robot-intent" } as never, "academy");
    });

    expect(review).toBeNull();
    expect(result.current.approvalNotice).toMatchObject({
      kind: "error",
      message: expect.stringContaining("invalid response"),
    });
  });

  it("announces an approved blog by slug without trusting client-authored metadata", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("posts", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleApproveAndPublish({
      slug: "state-finals",
      title: "State Finals",
      snippet: "Client-controlled summary",
      author: "Client-controlled author",
      category: "Tournament",
    } as never));

    expect(saveDocMock).toHaveBeenCalled();
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "/api/webhooks/syndicate-post",
      expect.objectContaining({ body: JSON.stringify({ slug: "state-finals" }), }),
    );
    expect(result.current.syndicationNotice).toMatchObject({
      kind: "success",
      slug: "state-finals",
  });
  });

  it("announces a blog when a coach creates it as published", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("posts", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleSave("coach-update", {
      title: "Coach Update",
      category: "Team Update",
      content: "Published directly by a coach.",
      description: "A direct publication",
      status: "published",
      approvalStatus: "approved",
    } as never));

    expect(saveDocMock).toHaveBeenCalledWith(
      "coach-update",
      expect.objectContaining({
        status: "published",
        approvalStatus: "approved",
        approvedBy: "CircuitFox",
        approvedAt: expect.any(String),
      }),
      "CircuitFox",
      "https://avatars.example.org/member.png",
      { isCreate: true },
    );
    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "/api/webhooks/syndicate-post",
      expect.objectContaining({ body: JSON.stringify({ slug: "coach-update" }) }),
    );
    expect(result.current.syndicationNotice).toMatchObject({
      kind: "success",
      slug: "coach-update",
    });
  });

  it("does not silently repost an edit to an already-published blog", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("posts", () => true),
      { wrapper },
    );

    act(() => result.current.handleOpenEdit({
      slug: "existing-post",
      title: "Existing Post",
      status: "published",
      approvalStatus: "approved",
    } as never));
    await act(async () => result.current.handleSave("existing-post", {
      title: "Existing Post Revised",
      category: "Team Update",
      content: "A correction that should not create another social post.",
      description: "Corrected copy",
      status: "published",
      approvalStatus: "approved",
    } as never));

    expect(saveDocMock).toHaveBeenCalledOnce();
    expect(authenticatedFetchMock).not.toHaveBeenCalled();
  });

  it("allows an approver to crosspost or retry a published blog explicitly", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("posts", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleSyndicatePost({
      slug: "existing-post",
      title: "Existing Post",
      status: "published",
      isDeleted: 0,
    } as never));

    expect(authenticatedFetchMock).toHaveBeenCalledWith(
      "/api/webhooks/syndicate-post",
      expect.objectContaining({ body: JSON.stringify({ slug: "existing-post" }) }),
    );
    expect(result.current.syndicationNotice).toMatchObject({
      kind: "success",
      slug: "existing-post",
    });
  });

  it("reports partial publication failure and retries social delivery without saving again", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    authenticatedFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          success: false,
          error: "Some social channels did not accept the announcement.",
          syndication: { zulip: true, bluesky: true, buffer: false },
          bufferChannels: {
            facebook: "submitted",
            instagram: "failed",
            twitter: "not-connected",
          },
        }), {
          status: 207,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const { result } = renderHook(
      () => useDashboardDocController("posts", () => true),
      { wrapper },
    );

    await act(async () =>
      result.current.handleApproveAndPublish({
        slug: "robot-reveal",
        title: "Robot Reveal",
        category: "Build",
      } as never),
    );

    expect(result.current.syndicationNotice).toMatchObject({
      kind: "error",
      slug: "robot-reveal",
      channels: expect.arrayContaining([
        { label: "Facebook", detail: "Submitted immediately via Buffer", ok: true },
        { label: "Instagram", detail: "Buffer rejected the submission", ok: false },
        { label: "X", detail: "Not connected in Buffer", ok: false },
      ]),
    });
    expect(saveDocMock).toHaveBeenCalledTimes(1);

    await act(async () => result.current.handleRetrySyndication());

    expect(saveDocMock).toHaveBeenCalledTimes(1);
    expect(authenticatedFetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.syndicationNotice).toMatchObject({
      kind: "success",
      slug: "robot-reveal",
    });
  });
});
