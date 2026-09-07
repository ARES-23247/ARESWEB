import { authenticatedFetch } from "./api";
import { createCommunityClient } from "@ares/waggle-way/community-client";

export const waggleCommunity = createCommunityClient(authenticatedFetch);
