import { apiContract } from "./schemas/contracts";

console.log("Inquiries list URL:");
console.log(apiContract.inquiries.list.path);

console.log("Posts admin list URL:");
console.log(apiContract.posts.getAdminPosts.path);
