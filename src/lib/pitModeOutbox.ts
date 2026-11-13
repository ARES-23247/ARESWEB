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

const STORAGE_KEY_PREFIX = "ares_pit_outbox_v2:";
const MAX_OUTBOX_ITEMS = 60;

export class PitOutboxQuotaError extends Error {
  constructor(message = "Offline Pit Outbox storage is full.") {
    super(message);
    this.name = "PitOutboxQuotaError";
  }
}

export function isPermanentOutboxError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

function storageKey(tournamentId: string, uid?: string | null): string {
  const safeUid = typeof uid === "string" && uid.trim() ? uid.trim() : "anon";
  return `${STORAGE_KEY_PREFIX}${tournamentId}:${safeUid}`;
}

export function generateOutboxId(prefix = "sub"): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function isValidOutboxMutation(
  item: unknown,
  tournamentId: string,
): item is PitOutboxMutation {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<PitOutboxMutation>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.tournamentId === tournamentId &&
    typeof candidate.queuedAt === "string" &&
    (candidate.kind === "pit_scouting" ||
      candidate.kind === "stand_scouting" ||
      candidate.kind === "pit_state") &&
    candidate.payload !== null &&
    typeof candidate.payload === "object"
  );
}

export function listTournamentOutbox(
  tournamentId: string,
  uid?: string | null,
): PitOutboxMutation[] {
  if (typeof window === "undefined" || !tournamentId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tournamentId, uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PitOutboxMutation =>
      isValidOutboxMutation(item, tournamentId),
    );
  } catch {
    return [];
  }
}

function writeTournamentOutbox(
  tournamentId: string,
  items: PitOutboxMutation[],
  uid?: string | null,
): void {
  if (typeof window === "undefined" || !tournamentId) return;
  const key = storageKey(tournamentId, uid);
  if (items.length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)),
    );
  } catch (err) {
    throw new PitOutboxQuotaError(
      err instanceof Error ? err.message : "Offline Pit Outbox storage is full.",
    );
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
  uid?: string | null,
): PitOutboxMutation[] {
  const existing = listTournamentOutbox(mutation.tournamentId, uid);
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
  writeTournamentOutbox(mutation.tournamentId, updated, uid);
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

export interface OutboxRejectedItem {
  item: PitOutboxMutation;
  message: string;
}

export interface OutboxFlushResult {
  flushed: number;
  remaining: PitOutboxMutation[];
  rejected: OutboxRejectedItem[];
}

const inFlightFlushes = new Map<string, Promise<OutboxFlushResult>>();

async function executeOutboxFlush(
  tournamentId: string,
  handlers: OutboxFlushHandlers,
  uid?: string | null,
): Promise<OutboxFlushResult> {
  const queue = listTournamentOutbox(tournamentId, uid);
  if (queue.length === 0) {
    return { flushed: 0, remaining: [], rejected: [] };
  }

  let flushed = 0;
  const handledById = new Map<string, string>();
  const retryable: PitOutboxMutation[] = [];
  const rejected: OutboxRejectedItem[] = [];

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
      handledById.set(item.id, item.queuedAt);
    } catch (err) {
      if (isPermanentOutboxError(err)) {
        handledById.set(item.id, item.queuedAt);
        rejected.push({
          item,
          message: err instanceof Error ? err.message : "Rejected by server",
        });
      } else {
        handledById.set(item.id, item.queuedAt);
        retryable.push(item);
      }
    }
  }

  // Merge with any mutations enqueued while network requests were in flight.
  const latest = listTournamentOutbox(tournamentId, uid);
  const addedDuringFlush = latest.filter((item) => {
    const seenAt = handledById.get(item.id);
    return seenAt === undefined || item.queuedAt > seenAt;
  });

  const mergedRetryable = retryable.filter((item) => {
    if (item.kind === "pit_state") {
      return !addedDuringFlush.some((newer) => newer.kind === "pit_state");
    }
    if (item.kind === "pit_scouting") {
      return !addedDuringFlush.some(
        (newer) =>
          newer.kind === "pit_scouting" &&
          newer.payload.teamNumber === item.payload.teamNumber,
      );
    }
    return true;
  });

  const remaining = [...mergedRetryable, ...addedDuringFlush].slice(-MAX_OUTBOX_ITEMS);
  writeTournamentOutbox(tournamentId, remaining, uid);
  return { flushed, remaining, rejected };
}

export function flushTournamentOutbox(
  tournamentId: string,
  handlers: OutboxFlushHandlers,
  uid?: string | null,
): Promise<OutboxFlushResult> {
  const key = storageKey(tournamentId, uid);
  const existing = inFlightFlushes.get(key);
  if (existing) {
    return existing;
  }
  const task = executeOutboxFlush(tournamentId, handlers, uid).finally(() => {
    inFlightFlushes.delete(key);
  });
  inFlightFlushes.set(key, task);
  return task;
}
