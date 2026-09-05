import { authenticatedFetch } from "@/lib/api";
import { createBuzzelloClient } from "@ares/buzzello/online";
export * from "@ares/buzzello/online";
export const { createOnlineBuzzelloGame, joinOnlineBuzzelloGame, findOnlineBuzzelloMatch, findTeamBuzzelloMatch, syncOnlineBuzzelloGame, playOnlineBuzzelloMove } = createBuzzelloClient(authenticatedFetch);
