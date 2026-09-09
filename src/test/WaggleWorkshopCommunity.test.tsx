import { useRef, useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCommunityClient } from "@ares/waggle-way/community-client";
import { applyCommand, createRun, stepRun } from "@ares/waggle-way/engine";
import { replayRun } from "@ares/waggle-way/replay";
import { editLevel } from "@ares/waggle-way/editor";
import { createBlankLevel } from "@ares/waggle-way/level";
import type { CommunitySubmission } from "@ares/waggle-way/community";
import WorkshopCommunity from "../../packages/waggle-way/src/ui/WorkshopCommunity";
import {
  bindPublication,
  createWorkshop,
  editWorkshop,
  forgetPublications,
  recordWinningFlight,
} from "../../packages/waggle-way/src/workshopState";

const metadata = {
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
};
const saved = {
  id: "owned",
  version: 3,
  title: "Saved garden",
  publishedRevision: 1,
  candidateRevision: 3,
  status: "pending",
  reviewReason: null,
};
// Version 5 remains the supported server contract for previously authored files.
function setup(ready = true, level = createBlankLevel(5)) {
  const fetcher = vi.fn<typeof fetch>();
  const client = createCommunityClient(fetcher);
  const exported = vi.fn();
  const loaded = vi.fn();
  function Harness({
    account = "private-account",
    allowed = true,
  }: {
    account?: string;
    allowed?: boolean;
  }) {
    const [state, setState] = useState(() => {
      let initial = createWorkshop(level);
      if (ready) {
        const level = initial.editor.level;
        let run = applyCommand(level, createRun(level), { type: "start" });
        while (run.phase !== "finished") run = stepRun(level, run);
        initial = recordWinningFlight(initial, level, run);
      }
      return initial;
    });
    const focus = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={focus}>Test garden</button>
        <output aria-label="Current draft">{state.editor.level.title}</output>
        <WorkshopCommunity
          key={`${account}:${allowed}`}
          access={{
            client,
            accountKey: account,
            canSubmit: allowed,
            identityControl: <button>Sign in to submit</button>,
          }}
          level={state.editor.level}
          flights={state.flights}
          origin={state.origins.get(state.editor.level) ?? null}
          returnFocusRef={focus}
          onBind={(level, binding) =>
            setState((previous) => bindPublication(previous, level, binding))
          }
          onDeleted={(id) =>
            setState((previous) => forgetPublications(previous, id))
          }
          onExport={exported}
          onLoad={(revision) => {
            loaded(revision);
            setState((previous) =>
              editWorkshop(
                previous,
                (editor) => editLevel(editor, revision.level),
                {
                  publication: {
                    id: revision.garden.id,
                    version: revision.garden.version,
                    accountKey: account,
                    metadata: revision.metadata,
                  },
                },
              ),
            );
          }}
        />
      </>
    );
  }
  const show = (props: { account?: string; allowed?: boolean } = {}) =>
    render(<Harness {...props} />);
  return { fetcher, show, Harness, exported, loaded };
}
function open() {
  fireEvent.click(screen.getByRole("button", { name: "Share garden" }));
}
function submit() {
  fireEvent.change(screen.getByLabelText("Public nickname"), {
    target: { value: " Clover " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
}

describe("community workshop", () => {
  it("keeps current-rule gardens local even with winning evidence and an authorized account", () => {
    const { show, fetcher } = setup(true, createBlankLevel(7));
    show();
    open();
    expect(
      screen.getByText(
        /Community publishing for these gardens is not ready yet/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    submit();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps guest work local and requires winning evidence for submission", () => {
    const { show, fetcher } = setup(false);
    const view = show({ allowed: false });
    open();
    expect(
      screen.getByRole("button", { name: "Sign in to submit" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "My submissions" }),
    ).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
    view.unmount();
    show();
    open();
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    expect(screen.getByText(/Rescue at least/)).toBeVisible();
  });

  it("submits real replay evidence with a separate publication ID and guards pending requests", async () => {
    const { show, fetcher } = setup();
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    open();
    submit();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    const body = JSON.parse(init!.body as string) as CommunitySubmission;
    const id = String(url).split("/").at(-1);
    expect(id).not.toBe(body.proof.level.id);
    expect(body.metadata.nickname).toBe("Clover");
    expect(body.expectedVersion).toBe(0);
    expect(init!.body).not.toContain("private-account");
    expect(replayRun(body.proof.level, body.proof.replays[0]).won).toBe(true);
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeVisible();
    await act(async () =>
      resolve(
        Response.json({
          ...saved,
          id,
          version: 1,
          publishedRevision: null,
          candidateRevision: 1,
        }),
      ),
    );
    expect(
      await screen.findByText(/Submitted for admin or coach review/),
    ).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Share garden" })).toHaveFocus();
  });

  it("retains an uncertain submission ID and checks the server before retrying", async () => {
    const { show, fetcher } = setup();
    fetcher.mockRejectedValueOnce(new Error("Network lost"));
    show();
    open();
    submit();
    await screen.findByText(/Check the saved revision before submitting again/);
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    const original = fetcher.mock.calls[0][0];
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    fireEvent.click(
      screen.getByRole("button", { name: "Check saved revision" }),
    );
    await screen.findByText(/No saved submission was found/);
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...saved,
        id: String(original).split("/").at(-1),
        version: 1,
        publishedRevision: null,
        candidateRevision: 1,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await screen.findByText(/Submitted for admin or coach review/);
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      original,
      original,
      original,
    ]);
  });

  it("lets creators recover from validation errors without treating them as successful submissions", async () => {
    const { show, fetcher } = setup();
    show();
    open();
    fireEvent.change(screen.getByLabelText("Public nickname"), {
      target: { value: "<name>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a nickname");
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 429 }));
    submit();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit for review" }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/wait|limit|many/i);
    expect(screen.queryByText(/Submitted for admin/)).not.toBeInTheDocument();
  });

  it("previews saved revisions, preserves the draft until confirmed, and clears proof after loading", async () => {
    const { show, fetcher, exported, loaded } = setup();
    const revision = {
      garden: saved,
      level: { ...createBlankLevel(5), title: saved.title },
      metadata,
    };
    fetcher.mockResolvedValueOnce(Response.json([saved]));
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "My submissions" }));
    fetcher.mockResolvedValueOnce(Response.json(revision));
    fireEvent.click(
      await screen.findByRole("button", { name: "Open Saved garden" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Load Saved garden?" }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getByRole("button", { name: "Export current draft" }),
    );
    expect(exported).toHaveBeenCalledOnce();
    expect(loaded).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Load saved revision" }),
    );
    expect(loaded).toHaveBeenCalledWith(revision);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Test garden" })).toHaveFocus();
    expect(screen.getByLabelText("Current draft")).toHaveTextContent(
      saved.title,
    );
    open();
    expect(
      screen.getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Public nickname")).toHaveValue("Clover");
  });

  it("uses exact versions for deletion, refreshes the owner list and keeps the local draft", async () => {
    const { show, fetcher } = setup();
    fetcher.mockResolvedValueOnce(Response.json([saved]));
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "My submissions" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Saved garden" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Delete Saved garden from the community?",
      }),
    ).toHaveFocus();
    expect(screen.getByText(/Approved remixes remain/)).toBeVisible();
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...saved,
        version: 4,
        status: "deleted",
        candidateRevision: null,
        publishedRevision: null,
      }),
    );
    fetcher.mockResolvedValueOnce(Response.json([]));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete community copy" }),
    );
    await screen.findByText("You have no community submissions yet.");
    expect(
      screen.getByRole("button", { name: "My submissions" }),
    ).toHaveFocus();
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Current draft")).not.toHaveTextContent(
      saved.title,
    );
  });

  it("keeps owner-list errors explicit and discards late private results after account changes", async () => {
    const { show, fetcher, Harness } = setup();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const view = show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "My submissions" }));
    await screen.findByRole("alert");
    expect(
      screen.queryByText("You have no community submissions yet."),
    ).not.toBeInTheDocument();
    let resolve!: (response: Response) => void;
    fetcher.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh submissions" }),
    );
    view.rerender(<Harness account="next-account" allowed={false} />);
    await act(async () => resolve(Response.json([saved])));
    open();
    expect(screen.queryByText(saved.title)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in to submit" }),
    ).toBeVisible();
  });
});
