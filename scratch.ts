import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const postContract = c.router({
  getAdminPosts: {
    method: "GET",
    path: "/admin/list",
    responses: {
      200: z.object({ posts: z.array(z.any()) }),
    },
  },
});

const apiContract = c.router({
  posts: postContract,
}, { pathPrefix: "/posts" }); // wait, pathPrefix is applied to all?
// If we apply it to the whole apiContract, it prepends /posts to all! No, that's not right.

const apiContract2 = c.router({
  posts: c.router(postContract, { pathPrefix: "/posts" }),
  events: c.router(postContract, { pathPrefix: "/events" }),
});

console.log(apiContract2.posts.getAdminPosts.path);
console.log(apiContract2.events.getAdminPosts.path);
