import { authenticatedFetch } from "@/lib/api";
import { createBuzzleClient } from "@ares/buzzle/online";
export * from "@ares/buzzle/online";
export const { createOnlineBuzzleGame, joinOnlineBuzzleGame, findOnlineBuzzleMatch, findTeamBuzzleMatch, syncOnlineBuzzleGame, playOnlineBuzzleAction } = createBuzzleClient(authenticatedFetch);
