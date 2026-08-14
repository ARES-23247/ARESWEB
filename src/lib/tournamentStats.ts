import type { TournamentMatch } from "@/types/tournament";

export interface TournamentMatchSummary {
  total: number;
  completed: number;
  pending: number;
  wins: number;
  losses: number;
  ties: number;
  recordedOutcomes: number;
  averageScore: number | null;
}

/** Derive an event-day summary only from recorded match data. */
export function summarizeTournamentMatches(
  matches: readonly TournamentMatch[],
): TournamentMatchSummary {
  let completed = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const scores: number[] = [];

  for (const match of matches) {
    if (match.completed) completed += 1;
    if (match.result === "won") wins += 1;
    else if (match.result === "lost") losses += 1;
    else if (match.result === "tie") ties += 1;

    if (
      match.result !== "upcoming" &&
      typeof match.scoreSelf === "number" &&
      Number.isFinite(match.scoreSelf)
    ) {
      scores.push(match.scoreSelf);
    }
  }

  return {
    total: matches.length,
    completed,
    pending: Math.max(0, matches.length - completed),
    wins,
    losses,
    ties,
    recordedOutcomes: wins + losses + ties,
    averageScore:
      scores.length > 0
        ? Math.round(
            (scores.reduce((total, score) => total + score, 0) /
              scores.length) *
              10,
          ) / 10
        : null,
  };
}
