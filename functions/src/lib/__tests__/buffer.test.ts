import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildBufferPost, getBufferApiKey, sendBufferPosts } from "../buffer";

const post = {
  title: "State Championship Recap",
  slug: "state-championship-recap",
  snippet: "Our robot scored high in the finals.",
  thumbnail: "https://images.example.org/team.jpg",
};

function response(
  data: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function graphql(data: unknown): Response {
  return response({ data });
}

describe("Buffer social syndication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.BUFFER_API_KEY;
  });

  it("fails safely when the API key is absent or explicitly disabled", async () => {
    await expect(sendBufferPosts(post)).resolves.toBe(false);
    process.env.BUFFER_API_KEY = "disabled";
    expect(getBufferApiKey()).toBe("");
    process.env.BUFFER_API_KEY = " buffer-key ";
    expect(getBufferApiKey()).toBe("buffer-key");
  });

  it("builds a bounded common post with a safe public image", () => {
    const built = buildBufferPost({
      ...post,
      title: `🤖 ${"Engineering ".repeat(40)}`,
      snippet: `${"A detailed team update. ".repeat(100)}\u0001`,
    });
    const graphemes = Array.from(
      new Intl.Segmenter("en", { granularity: "grapheme" }).segment(built.text),
    );
    expect(graphemes.length).toBeLessThanOrEqual(260);
    expect(built.text).toContain(
      "https://aresfirst.org/blog/state-championship-recap",
    );
    expect(built.imageUrl).toBe("https://images.example.org/team.jpg");
  });

  it("uses the generated team card for unsafe images and rejects invalid slugs", () => {
    expect(
      buildBufferPost({ ...post, thumbnail: "http://localhost/private.jpg" })
        .imageUrl,
    ).toBe("https://aresfirst.org/social-post-default.jpg");
    expect(
      buildBufferPost({ ...post, snippet: "", thumbnail: "not-a-url" }).text,
    ).not.toContain("undefined");
    expect(() => buildBufferPost({ ...post, slug: "../unsafe" })).toThrow(
      "Invalid blog post slug",
    );
  });

  it("queues Facebook, Instagram, and Twitter posts but never Bluesky", async () => {
    process.env.BUFFER_API_KEY = "buffer-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        graphql({ account: { organizations: [{ id: "org-1" }] } }),
      )
      .mockResolvedValueOnce(
        graphql({
          channels: [
            { id: "facebook-1", service: "facebook" },
            { id: "instagram-1", service: "instagram" },
            { id: "twitter-1", service: "twitter" },
            { id: "bluesky-1", service: "bluesky" },
            { id: "linkedin-1", service: "linkedin" },
          ],
        }),
      )
      .mockResolvedValueOnce(graphql({ posts: { edges: [] } }))
      .mockResolvedValueOnce(
        graphql({
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: "created-facebook" },
          },
        }),
      )
      .mockResolvedValueOnce(
        graphql({
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: "created-instagram" },
          },
        }),
      )
      .mockResolvedValueOnce(
        graphql({
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: "created-twitter" },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBufferPosts(post)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const requests = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(init.body as string),
    );
    const createInputs = requests
      .filter(({ query }) => query.includes("AresCreatePost"))
      .map(({ variables }) => variables.input);
    expect(createInputs.map(({ channelId }) => channelId).sort()).toEqual([
      "facebook-1",
      "instagram-1",
      "twitter-1",
    ]);
    expect(createInputs[0]).toMatchObject({
      mode: "addToQueue",
      needsApproval: false,
      schedulingType: "automatic",
      source: "aresweb",
      assets: [{ image: { url: post.thumbnail } }],
    });
    expect(createInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelId: "facebook-1",
          metadata: { facebook: { type: "post" } },
        }),
        expect.objectContaining({
          channelId: "instagram-1",
          metadata: {
            instagram: { type: "post", shouldShareToFeed: true },
          },
        }),
      ]),
    );
    expect(
      createInputs.find(({ channelId }) => channelId === "twitter-1"),
    ).not.toHaveProperty("metadata");
  });

  it("deduplicates an already queued channel before retrying the remainder", async () => {
    process.env.BUFFER_API_KEY = "buffer-key";
    const expectedText = buildBufferPost(post).text;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        graphql({ account: { organizations: [{ id: "org-1" }] } }),
      )
      .mockResolvedValueOnce(
        graphql({
          channels: [
            { id: "facebook-1", service: "facebook" },
            { id: "twitter-1", service: "twitter" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        graphql({
          posts: {
            edges: [
              {
                node: {
                  channelId: "facebook-1",
                  text: expectedText,
                  status: "sent",
                },
              },
              {
                node: {
                  channelId: "twitter-1",
                  text: expectedText,
                  status: "error",
                },
              },
              { node: null },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphql({
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: "created-twitter" },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBufferPosts(post)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const createRequest = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(createRequest.variables.input.channelId).toBe("twitter-1");
  });

  it("fails closed for missing configuration, typed mutation failures, and upstream errors", async () => {
    process.env.BUFFER_API_KEY = "buffer-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(graphql({ account: { organizations: [] } }))
        .mockResolvedValueOnce(response({}, { ok: false, status: 503 })),
    );
    await expect(sendBufferPosts(post)).resolves.toBe(false);
    await expect(sendBufferPosts(post)).resolves.toBe(false);

    const noChannels = vi
      .fn()
      .mockResolvedValueOnce(
        graphql({ account: { organizations: [{ id: "org-1" }] } }),
      )
      .mockResolvedValueOnce(
        graphql({ channels: [{ id: "bluesky-1", service: "bluesky" }] }),
      );
    vi.stubGlobal("fetch", noChannels);
    await expect(sendBufferPosts(post)).resolves.toBe(false);

    const rejectedMutation = vi
      .fn()
      .mockResolvedValueOnce(
        graphql({ account: { organizations: [{ id: "org-1" }] } }),
      )
      .mockResolvedValueOnce(
        graphql({ channels: [{ id: "facebook-1", service: "facebook" }] }),
      )
      .mockResolvedValueOnce(graphql({ posts: { edges: [] } }))
      .mockResolvedValueOnce(
        graphql({
          createPost: { __typename: "MutationError", message: "rejected" },
        }),
      );
    vi.stubGlobal("fetch", rejectedMutation);
    await expect(sendBufferPosts(post)).resolves.toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ errors: [{ message: "bad" }] })),
    );
    await expect(sendBufferPosts(post)).resolves.toBe(false);
  });
});
