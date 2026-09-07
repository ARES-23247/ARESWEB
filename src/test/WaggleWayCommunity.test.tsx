import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CommunityBrowser from "../../packages/waggle-way/src/ui/CommunityBrowser";
import { createCommunityClient } from "@ares/waggle-way/community-client";
import { createBlankLevel } from "@ares/waggle-way/level";

const level = createBlankLevel();
const card = {
  id: "garden",
  revision: 1,
  title: "Clover crossing",
  nickname: "Fern",
  difficulty: "gentle",
  estimatedLength: "short",
  theme: "sunny",
  population: level.population,
  rescueTarget: level.rescueTarget,
  mechanics: ["fan", "flowers", "hive"],
};
const garden = { ...card, level };
function setup() {
  const fetcher = vi.fn<typeof fetch>();
  const client = createCommunityClient(fetcher);
  const play = vi.fn();
  const show = () => render(<CommunityBrowser client={client} onPlay={play} />);
  return { fetcher, client, play, show };
}

describe("community garden selection", () => {
  it("removes stale parent attribution after learning that the parent is unavailable", async () => {
    const { fetcher, show, play } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...garden,
        parent: { id: "parent", title: "Removed parent", nickname: "Oak" },
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    );
    await screen.findByRole("heading", { name: "Clover crossing" });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    fireEvent.click(
      screen.getByRole("button", { name: "Removed parent by Oak" }),
    );
    await screen.findByRole("alert");
    expect(screen.queryByText("Removed parent by Oak")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play this garden" }));
    expect(play).toHaveBeenCalledWith(garden);
  });
  it("loads approved cards, applies filters, pages with bounded replacement and returns to the first page", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: "next" }),
    );
    show();
    expect(screen.getByRole("status")).toHaveTextContent("Loading gardens");
    expect(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    ).toBeEnabled();
    fetcher.mockResolvedValueOnce(
      Response.json({
        gardens: [{ ...card, id: "second", title: "Windy corner" }],
        nextCursor: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "More gardens" }));
    expect(
      await screen.findByRole("button", { name: /Windy corner/ }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Clover crossing/ }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.lastCall?.[0]).toContain("?cursor=next");
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    fireEvent.change(screen.getByLabelText("Difficulty"), {
      target: { value: "challenging" },
    });
    await screen.findByText(/No approved gardens match yet/);
    expect(fetcher.mock.lastCall?.[0]).toBe(
      "/api/waggle-way/gardens?difficulty=challenging",
    );
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: "another" }),
    );
    fireEvent.change(screen.getByLabelText("Length"), {
      target: { value: "long" },
    });
    await screen.findByText(/No approved gardens match yet/);
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: "another" }),
    );
    fireEvent.change(screen.getByLabelText("Garden feature"), {
      target: { value: "fan" },
    });
    await screen.findByText(/No approved gardens match yet/);
    expect(fetcher.mock.lastCall?.[0]).toContain("mechanic=fan");
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "More gardens" }));
    await screen.findByText(/No approved gardens match yet/);
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    await screen.findByRole("button", { name: /Clover crossing/ });
    expect(fetcher.mock.lastCall?.[0]).not.toContain("cursor=");
  });

  it("keeps a failed collection explicit and supports refresh without an empty-state lie", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(screen.queryByText(/No approved gardens/)).not.toBeInTheDocument();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [], nextCursor: null }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh gardens" }));
    await screen.findByText(/No approved gardens match yet/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the canonical garden, follows its current parent, and plays the selected revision", async () => {
    const { fetcher, show, play } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...garden,
        parent: { id: "parent", title: "Original", nickname: "Oak" },
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Clover crossing" }),
    ).toHaveFocus();
    fetcher.mockResolvedValueOnce(
      Response.json({ ...garden, id: "parent", title: "Original" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Original by Oak" }));
    expect(
      await screen.findByRole("heading", { name: "Original" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Play this garden" }));
    expect(play).toHaveBeenCalledWith({
      ...garden,
      id: "parent",
      title: "Original",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to gardens" }));
    expect(
      screen.getByRole("button", { name: /Clover crossing/ }),
    ).toHaveFocus();
  });

  it("handles removal between browsing and opening without starting stale content", async () => {
    const { fetcher, show, play } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no longer available",
    );
    expect(play).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Clover crossing/ }),
    ).toBeEnabled();
  });

  it("sends categorical reports, displays failures and confirms successful review intake", async () => {
    const { fetcher, show } = setup();
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    show();
    fetcher.mockResolvedValueOnce(Response.json(garden));
    fireEvent.click(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    );
    await screen.findByRole("heading", { name: "Clover crossing" });
    fireEvent.click(screen.getByText("Report a concern"));
    fireEvent.change(screen.getByLabelText("Concern"), {
      target: { value: "identity" },
    });
    fetcher.mockResolvedValueOnce(new Response(null, { status: 429 }));
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "too many requests",
    );
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Report received",
    );
    expect(fetcher.mock.lastCall?.[1]?.body).toBe('{"reason":"identity"}');
    expect(
      screen.queryByRole("button", { name: "Send report" }),
    ).not.toBeInTheDocument();
  });

  it("ignores late requests when the browser closes", async () => {
    const { fetcher, show, play } = setup();
    let finish!: (response: Response) => void;
    fetcher.mockResolvedValueOnce(
      Response.json({ gardens: [card], nextCursor: null }),
    );
    const view = show();
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Clover crossing/ }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    view.unmount();
    await act(async () => finish(Response.json(garden)));
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
