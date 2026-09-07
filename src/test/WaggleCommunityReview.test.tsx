import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCommunityClient } from "@ares/waggle-way/community-client";
import { createBlankLevel } from "@ares/waggle-way/level";
import CommunityModeration from "../../packages/waggle-way/src/ui/CommunityModeration";
import RemixGarden from "../../packages/waggle-way/src/ui/RemixGarden";

const level = { ...createBlankLevel(), title: "Clover crossing" };
const card = {
  id: "garden",
  revision: 2,
  title: level.title,
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
  theme: "sunny",
  mechanics: ["hive", "flowers"],
  population: 8,
  rescueTarget: 8,
};
const garden = { ...card, level };
const owned = {
  id: "garden",
  version: 4,
  title: level.title,
  publishedRevision: 1,
  candidateRevision: 2,
  status: "pending",
  reviewReason: null,
};
const candidate = {
  garden: owned,
  candidate: garden,
  reviewDigest: "a".repeat(64),
  allBeesProven: true,
  bestPollen: 0,
  fewestTools: 0,
};
const reported = {
  id: "report",
  levelId: "garden",
  revision: 2,
  reason: "identity",
  publication: { card, version: 4 },
};
function setup() {
  const fetcher = vi.fn<typeof fetch>();
  const client = createCommunityClient(fetcher);
  const busy = vi.fn();
  return {
    fetcher,
    client,
    busy,
    show: () => render(<CommunityModeration client={client} onBusy={busy} />),
  };
}
function payload(fetcher: ReturnType<typeof setup>["fetcher"], index: number) {
  return JSON.parse(fetcher.mock.calls[index][1]!.body as string);
}

describe("revision review and report handling", () => {
  it("inspects and tests a candidate before approving its exact version and digest", async () => {
    const { fetcher, show, busy } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [owned], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(Response.json(candidate));
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Clover crossing" }),
    );
    expect(
      await screen.findByRole("heading", { name: level.title, level: 3 }),
    ).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Approve and publish" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Test candidate" }));
    expect(screen.getByRole("button", { name: "Open hive" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enter full screen" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to review" }));
    expect(
      screen.getByRole("heading", { name: level.title, level: 3 }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("checkbox"));
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and publish" }),
    );
    expect(
      screen.getByRole("button", { name: "Approve and publish" }),
    ).toBeDisabled();
    expect(payload(fetcher, 2)).toEqual({
      expectedVersion: 4,
      reviewDigest: candidate.reviewDigest,
      decision: "approve",
    });
    expect(busy).toHaveBeenLastCalledWith(true);
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    await act(async () =>
      resolve(
        Response.json({
          ...owned,
          version: 5,
          publishedRevision: 2,
          candidateRevision: null,
          status: "published",
        }),
      ),
    );
    await screen.findByText("No gardens are awaiting review.");
    expect(screen.getByText("Garden approved and published.")).toBeVisible();
    expect(busy).toHaveBeenLastCalledWith(false);
  });

  it("requires a categorical rejection reason and preserves an earlier publication", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [owned], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(Response.json(candidate));
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Clover crossing" }),
    );
    await screen.findByRole("heading", { name: level.title, level: 3 });
    expect(
      screen.getByRole("button", { name: "Reject revision" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Rejection reason"), {
      target: { value: "identity" },
    });
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...owned,
        version: 5,
        status: "rejected",
        reviewReason: "identity",
      }),
    );
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject revision" }));
    await screen.findByText(
      /Revision rejected. Any earlier approved revision remains/,
    );
    expect(payload(fetcher, 2)).toEqual({
      expectedVersion: 4,
      reviewDigest: candidate.reviewDigest,
      decision: "reject",
      reason: "identity",
    });
  });

  it("discards a conflicted decision and requires reopening the fresh candidate", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [owned], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(Response.json(candidate));
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Clover crossing" }),
    );
    await screen.findByRole("heading", { name: level.title, level: 3 });
    fireEvent.click(screen.getByRole("checkbox"));
    fetcher.mockResolvedValueOnce(new Response(null, { status: 409 }));
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [{ ...owned, version: 5 }], nextCursor: null }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and publish" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload");
    expect(
      screen.queryByRole("button", { name: "Approve and publish" }),
    ).not.toBeInTheDocument();
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...candidate,
        garden: { ...owned, version: 5 },
        reviewDigest: "b".repeat(64),
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Clover crossing" }),
    );
    await screen.findByRole("heading", { name: level.title, level: 3 });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("pages bounded queues, preserves load errors and ignores a late queue after switching sections", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: "next" }),
    );
    show();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    fireEvent.click(await screen.findByRole("button", { name: "More items" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(
      screen.queryByText("No gardens are awaiting review."),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls[1][0]).toContain("cursor=next");
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    fetcher.mockResolvedValueOnce(
      Response.json({ reports: [], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reported gardens" }));
    await screen.findByText("No reports are awaiting attention.");
    await act(async () =>
      resolve(Response.json({ gardens: [owned], nextCursor: null })),
    );
    expect(screen.queryByText(level.title)).not.toBeInTheDocument();
  });

  it("confirms publication removal separately from report resolution and uses the queue version", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(
      Response.json({ reports: [reported], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reported gardens" }));
    fetcher.mockResolvedValueOnce(Response.json(garden));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Inspect report for Clover crossing/,
      }),
    );
    await screen.findByText(/Resolving a report closes this concern/);
    fireEvent.click(screen.getByRole("button", { name: "Remove garden" }));
    expect(
      screen.getByRole("heading", { name: "Remove this published garden?" }),
    ).toHaveFocus();
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...owned,
        version: 5,
        status: "removed",
        publishedRevision: null,
      }),
    );
    fetcher.mockResolvedValueOnce(
      Response.json({
        reports: [{ ...reported, publication: null }],
        nextCursor: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }));
    await screen.findByText(/Garden removed. Its report remains open/);
    expect(payload(fetcher, 3)).toEqual({
      expectedVersion: 4,
      reason: "identity",
    });
    expect(fetcher.mock.calls[3][0]).toBe(
      "/api/waggle-way/gardens/garden/remove",
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Inspect report for unavailable publication/,
      }),
    );
    await screen.findByText(/The reported publication is no longer available/);
    expect(
      screen.queryByRole("button", { name: "Remove garden" }),
    ).not.toBeInTheDocument();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fetcher.mockResolvedValueOnce(
      Response.json({ reports: [], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Resolve report" }));
    await screen.findByText("Report resolved. Publication was not changed.");
    expect(fetcher.mock.calls[5][0]).toBe(
      "/api/waggle-way/reports/report/resolve",
    );
  });

  it("never removes a newer publication in response to a report about an older revision", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(
      Response.json({ reports: [reported], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reported gardens" }));
    fetcher.mockResolvedValueOnce(Response.json({ ...garden, revision: 3 }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Inspect report for Clover crossing/,
      }),
    );
    await screen.findByText(/The reported publication is no longer available/);
    expect(
      screen.queryByRole("button", { name: "Remove garden" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolve report" }),
    ).toBeEnabled();
  });

  it("ignores late decisions when the private panel is unmounted", async () => {
    const { fetcher, show, busy } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [owned], nextCursor: null }),
    );
    const view = show();
    fetcher.mockResolvedValueOnce(Response.json(candidate));
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Clover crossing" }),
    );
    await screen.findByRole("heading", { name: level.title, level: 3 });
    fireEvent.click(screen.getByRole("checkbox"));
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve and publish" }),
    );
    view.unmount();
    busy.mockClear();
    await act(async () =>
      resolve(
        Response.json({
          ...owned,
          version: 5,
          status: "published",
          candidateRevision: null,
          publishedRevision: 2,
        }),
      ),
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(busy).not.toHaveBeenCalled();
  });
});

describe("public remix entry", () => {
  function setupRemix(source = { id: "garden", revision: "2" }) {
    const { fetcher, client } = setup();
    const load = vi.fn(() => true);
    const close = vi.fn();
    const exported = vi.fn();
    const show = () =>
      render(
        <RemixGarden
          client={client}
          source={source}
          onLoad={load}
          onClose={close}
          onExport={exported}
          returnFocusRef={{ current: null }}
        />,
      );
    return { fetcher, load, close, exported, show };
  }
  it("previews the fresh approved revision and replaces nothing until the creator confirms", async () => {
    const { fetcher, show, load, close, exported } = setupRemix({
      id: "garden",
      revision: "1",
    });
    fetcher.mockResolvedValueOnce(Response.json(garden));
    show();
    expect(
      await screen.findByRole("heading", { name: level.title, level: 3 }),
    ).toHaveFocus();
    expect(
      screen.getByText(/This garden changed since you selected it/),
    ).toBeVisible();
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Export current draft" }),
    );
    expect(exported).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Remix this revision" }),
    );
    expect(load).toHaveBeenCalledWith(garden);
    expect(close).toHaveBeenCalledOnce();
  });
  it("shows missing/invalid sources explicitly and offers recovery without touching the draft", async () => {
    const { fetcher, show, load } = setupRemix();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const view = show();
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Remix this revision" }),
    ).not.toBeInTheDocument();
    fetcher.mockResolvedValueOnce(Response.json(garden));
    fireEvent.click(screen.getByRole("button", { name: "Retry garden" }));
    await screen.findByRole("heading", { name: level.title, level: 3 });
    expect(load).not.toHaveBeenCalled();
    view.unmount();
    const invalid = setupRemix({ id: "../private", revision: "NaN" });
    invalid.show();
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid");
    expect(invalid.fetcher).not.toHaveBeenCalled();
  });
  it("retains the preview and draft after a rejected local load and ignores late fetches after closing", async () => {
    const { fetcher, show, load, close } = setupRemix();
    fetcher.mockResolvedValueOnce(Response.json(garden));
    const view = show();
    load.mockReturnValue(false);
    fireEvent.click(
      await screen.findByRole("button", { name: "Remix this revision" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "current draft is kept",
    );
    expect(close).not.toHaveBeenCalled();
    view.unmount();
    const next = setupRemix();
    let resolve!: (response: Response) => void;
    next.fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = next.show();
    pending.unmount();
    await act(async () => resolve(Response.json(garden)));
    expect(next.load).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
