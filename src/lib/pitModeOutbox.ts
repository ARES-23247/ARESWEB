import type {
  PitScoutingWriteInput,
  StandScoutingWriteInput,
  TournamentPitState,
} from "@/types/tournament";

export type PitOutboxMutation =
  | {
      id: string;
      tournamentId: string;
      kind: "pit_scouting";
      payload: PitScoutingWriteInput;
      queuedAt: string;
    }
  | {
      id: string;
      tournamentId: string;
      kind: "stand_scouting";
      payload: StandScoutingWriteInput;
      queuedAt: string;
    }
  | {
      id: string;
      tournamentId: string;
      kind: "pit_state";
      payload: Pick<TournamentPitState, "checklists" | "batteries" | "triageItems">;
      queuedAt: string;
    };

const STORAGE_KEY_PREFIX = "ares_pit_outbox_v1:";
const MAX_OUTBOX_ITEMS = 60;

function storageKey(tournamentId: string): string {
  return `${STORAGE_KEY_PREFIX}${tournamentId}`;
}

export function generateOutboxId(prefix = "sub"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function listTournamentOutbox(tournamentId: string): PitOutboxMutation[] {
  if (typeof window === "undefined" || !tournamentId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tournamentId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PitOutboxMutation =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { kind?: unknown }).kind === "string",
        ),
    );
  } catch {
    return [];
  }
}

function writeTournamentOutbox(
  tournamentId: string,
  items: PitOutboxMutation[],
): void {
  if (typeof window === "undefined" || !tournamentId) return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(storageKey(tournamentId));
    } else {
      window.localStorage.setItem(
        storageKey(tournamentId),
        JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)),
      );
    }
  } catch {
    // Ignore storage quota exceptions cleanly.
  }
}

export type PitOutboxEnqueueInput =
  | {
      id?: string;
      tournamentId: string;
      kind: "pit_scouting";
      payload: PitScoutingWriteInput;
    }
  | {
      id?: string;
      tournamentId: string;
      kind: "stand_scouting";
      payload: StandScoutingWriteInput;
    }
  | {
      id?: string;
      tournamentId: string;
      kind: "pit_state";
      payload: Pick<TournamentPitState, "checklists" | "batteries" | "triageItems">;
    };

export function enqueueTournamentMutation(
  mutation: PitOutboxEnqueueInput,
): PitOutboxMutation[] {
  const existing = listTournamentOutbox(mutation.tournamentId);
  const id = mutation.id ?? generateOutboxId(mutation.kind);
  const queuedAt = new Date().toISOString();

  // Coalesce latest pit_state or pit_scouting for the same teamNumber so we never replay stale pit snapshots.
  const filtered = existing.filter((item) => {
    if (item.id === id) return false;
    if (mutation.kind === "pit_state" && item.kind === "pit_state") return false;
    if (
      mutation.kind === "pit_scouting" &&
      item.kind === "pit_scouting" &&
      item.payload.teamNumber === mutation.payload.teamNumber
    ) {
      return false;
    }
    return true;
  });

  const entry = {
    ...mutation,
    id,
    queuedAt,
  } as PitOutboxMutation;

  const updated = [...filtered, entry].slice(-MAX_OUTBOX_ITEMS);
  writeTournamentOutbox(mutation.tournamentId, updated);
  return updated;
}

export interface OutboxFlushHandlers {
  submitPit: (tournamentId: string, payload: PitScoutingWriteInput) => Promise<unknown>;
  submitStand: (tournamentId: string, payload: StandScoutingWriteInput) => Promise<unknown>;
  savePitState: (
    tournamentId: string,
    payload: Pick<TournamentPitState, "checklists" | "batteries" | "triageItems">,
  ) => Promise<unknown>;
}

export async function flushTournamentOutbox(
  tournamentId: string,
  handlers: OutboxFlushHandlers,
): Promise<{ flushed: number; remaining: PitOutboxMutation[] }> {
  const queue = listTournamentOutbox(tournamentId);
  if (queue.length === 0) {
    return { flushed: 0, remaining: [] };
  }

  let flushed = 0;
  const remaining: PitOutboxMutation[] = [];

  for (const item of queue) {
    try {
      if (item.kind === "pit_scouting") {
        await handlers.submitPit(tournamentId, item.payload);
      } else if (item.kind === "stand_scouting") {
        await handlers.submitStand(tournamentId, {
          ...item.payload,
          clientSubmissionId: item.payload.clientSubmissionId ?? item.id,
        });
      } else {
        await handlers.savePitState(tournamentId, item.payload);
      }
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeTournamentOutbox(tournamentId, remaining);
  return { flushed, remaining };
}
