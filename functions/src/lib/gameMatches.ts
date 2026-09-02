import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Request } from "express";
import { adminDb } from "./firebase-admin";
import { ApiError } from "../middleware/errorHandler";

export type GameActionPolicy = "sequential" | "simultaneous";
export type GameMatchStatus = "waiting" | "active" | "finished";

export interface GameDefinition<
  TState,
  TAction,
  TPlayerView extends Record<string, unknown>,
  TPlayerLabel extends string,
> {
  gameType: string;
  minPlayers: number;
  maxPlayers: number;
  defaultMatchSize: number;
  maxActions: number;
  actionPolicy: GameActionPolicy;
  createInitialState(playerCount: number): TState;
  parseState(value: unknown, playerCount: number): TState;
  activePlayerIndex(state: TState): number | null;
  applyAction(state: TState, playerIndex: number, action: TAction): TState;
  isFinished(state: TState): boolean;
  playerLabel(playerIndex: number): TPlayerLabel;
  toPlayerView(state: TState, playerIndex: number): TPlayerView;
}

interface StoredParticipant {
  tokenHash: string;
  syncsRemaining: number;
  actionSequence: number;
}

interface StoredGameMatch<TState> {
  gameType: string;
  status: GameMatchStatus;
  desiredPlayers: number;
  participants: StoredParticipant[];
  state: TState;
  version: number;
  createdAt: unknown;
  expiresAt: unknown;
}

export interface GameMatchDto<
  TPlayerView extends Record<string, unknown>,
  TPlayerLabel extends string,
> {
  gameId: string;
  gameType: string;
  status: GameMatchStatus;
  youAre: TPlayerLabel;
  playerIndex: number;
  playerCount: number;
  desiredPlayers: number;
  version: number;
  actionSequence: number;
  expiresAt: string;
  syncsRemaining: number;
  state: TPlayerView;
}

export interface GameActionRevision {
  expectedVersion?: number;
  expectedActionSequence?: number;
}

const GAME_COLLECTION = "game_matches";
const INVITE_COLLECTION = "game_invites";
const MATCHMAKING_COLLECTION = "game_matchmaking";
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const INVITE_LENGTH = 8;
const INVITE_LIFETIME_MS = 10 * 60 * 1000;
const GAME_LIFETIME_MS = 45 * 60 * 1000;
const MATCHMAKING_LIFETIME_MS = 90 * 1000;
const SYNC_BUDGET_PER_PLAYER = 480;

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return Number.NaN;
}

function requireGameSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(
      503,
      "Online play is temporarily unavailable.",
      "GAME_SERVICE_UNAVAILABLE",
    );
  }
  return secret;
}

function hashCapability(
  gameType: string,
  purpose: string,
  value: string,
): string {
  return createHmac("sha256", requireGameSecret())
    .update(`aresweb-game:${gameType}:${purpose}:v1:${value}`)
    .digest("hex");
}

function createPlayerToken(): string {
  return randomBytes(32).toString("base64url");
}

function createParticipant(
  gameType: string,
  playerToken: string,
): StoredParticipant {
  return {
    tokenHash: hashCapability(gameType, "player", playerToken),
    syncsRemaining: SYNC_BUDGET_PER_PLAYER,
    actionSequence: 0,
  };
}

function hashesMatch(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(actual, "utf8"),
  );
}

export function generateGameInviteCode(): string {
  return Array.from(
    { length: INVITE_LENGTH },
    () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)],
  ).join("");
}

export function hashGameInviteCode(gameType: string, code: string): string {
  return hashCapability(gameType, "invite", code);
}

export function requireGamePlayerToken(req: Request): string {
  const value = req.get("X-Game-Player");
  if (!value || !/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new ApiError(
      401,
      "This match session is not available.",
      "GAME_SESSION_REQUIRED",
    );
  }
  return value;
}

export class GameMatchService<
  TState,
  TAction,
  TPlayerView extends Record<string, unknown>,
  TPlayerLabel extends string,
> {
  constructor(
    private readonly definition: GameDefinition<
      TState,
      TAction,
      TPlayerView,
      TPlayerLabel
    >,
  ) {
    const { minPlayers, maxPlayers, defaultMatchSize, maxActions, gameType } =
      definition;
    if (
      !/^[a-z][a-z0-9-]{1,39}$/u.test(gameType) ||
      !Number.isSafeInteger(minPlayers) ||
      !Number.isSafeInteger(maxPlayers) ||
      !Number.isSafeInteger(defaultMatchSize) ||
      minPlayers < 2 ||
      maxPlayers < minPlayers ||
      maxPlayers > 8 ||
      defaultMatchSize < minPlayers ||
      defaultMatchSize > maxPlayers ||
      !Number.isSafeInteger(maxActions) ||
      maxActions < 1 ||
      maxActions > 10_000
    ) {
      throw new Error("Invalid game definition bounds.");
    }
  }

  private assertPlayerCount(playerCount: number): void {
    if (
      !Number.isSafeInteger(playerCount) ||
      playerCount < this.definition.minPlayers ||
      playerCount > this.definition.maxPlayers
    ) {
      throw new ApiError(400, "Invalid player count.", "GAME_PLAYER_COUNT");
    }
  }

  private createStoredMatch(
    playerToken: string,
    playerCount: number,
    now: number,
    lifetimeMs = GAME_LIFETIME_MS,
  ): StoredGameMatch<TState> {
    this.assertPlayerCount(playerCount);
    return {
      gameType: this.definition.gameType,
      status: "waiting",
      desiredPlayers: playerCount,
      participants: [createParticipant(this.definition.gameType, playerToken)],
      state: this.definition.createInitialState(playerCount),
      version: 1,
      createdAt: new Date(now),
      expiresAt: new Date(now + lifetimeMs),
    };
  }

  private parseParticipant(value: unknown): StoredParticipant | null {
    if (typeof value !== "object" || value === null) return null;
    const participant = value as Partial<StoredParticipant>;
    if (
      !/^[a-f0-9]{64}$/u.test(participant.tokenHash ?? "") ||
      !Number.isSafeInteger(participant.syncsRemaining) ||
      (participant.syncsRemaining as number) < 0 ||
      (participant.syncsRemaining as number) > SYNC_BUDGET_PER_PLAYER ||
      !Number.isSafeInteger(participant.actionSequence) ||
      (participant.actionSequence as number) < 0 ||
      (participant.actionSequence as number) > this.definition.maxActions
    ) {
      return null;
    }
    return {
      tokenHash: participant.tokenHash as string,
      syncsRemaining: participant.syncsRemaining as number,
      actionSequence: participant.actionSequence as number,
    };
  }

  private parseStoredMatch(value: unknown): StoredGameMatch<TState> {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid game match record.");
    }
    const data = value as Partial<StoredGameMatch<unknown>>;
    const participants = Array.isArray(data.participants)
      ? data.participants.map((participant) =>
          this.parseParticipant(participant),
        )
      : [];
    const createdAtMillis = timestampMillis(data.createdAt);
    const expiresAtMillis = timestampMillis(data.expiresAt);
    if (
      data.gameType !== this.definition.gameType ||
      !["waiting", "active", "finished"].includes(data.status ?? "") ||
      !Number.isSafeInteger(data.desiredPlayers) ||
      (data.desiredPlayers as number) < this.definition.minPlayers ||
      (data.desiredPlayers as number) > this.definition.maxPlayers ||
      participants.length < 1 ||
      participants.length > (data.desiredPlayers as number) ||
      participants.some((participant) => participant === null) ||
      !Number.isSafeInteger(data.version) ||
      (data.version as number) < 1 ||
      (data.version as number) > this.definition.maxActions + 1 ||
      !Number.isFinite(createdAtMillis) ||
      !Number.isFinite(expiresAtMillis) ||
      expiresAtMillis <= createdAtMillis
    ) {
      throw new Error("Invalid game match record.");
    }
    const playerCount = data.desiredPlayers as number;
    const state = this.definition.parseState(data.state, playerCount);
    const full = participants.length === playerCount;
    if (
      (data.status === "waiting") !== !full ||
      (data.status === "finished") !== this.definition.isFinished(state)
    ) {
      throw new Error("Invalid game match lifecycle.");
    }
    return {
      gameType: data.gameType,
      status: data.status as GameMatchStatus,
      desiredPlayers: playerCount,
      participants: participants as StoredParticipant[],
      state,
      version: data.version as number,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
  }

  private playerIndexForToken(
    match: StoredGameMatch<TState>,
    playerToken: string,
  ): number {
    const tokenHash = hashCapability(
      this.definition.gameType,
      "player",
      playerToken,
    );
    const playerIndex = match.participants.findIndex((participant) =>
      hashesMatch(participant.tokenHash, tokenHash),
    );
    if (playerIndex < 0) {
      throw new ApiError(404, "Online match not found.", "GAME_NOT_FOUND");
    }
    return playerIndex;
  }

  private assertNotExpired(match: StoredGameMatch<TState>): void {
    if (timestampMillis(match.expiresAt) <= Date.now()) {
      throw new ApiError(410, "This online match has expired.", "GAME_EXPIRED");
    }
  }

  private toDto(
    gameId: string,
    match: StoredGameMatch<TState>,
    playerIndex: number,
  ): GameMatchDto<TPlayerView, TPlayerLabel> {
    const participant = match.participants[playerIndex];
    return {
      gameId,
      gameType: this.definition.gameType,
      status: match.status,
      youAre: this.definition.playerLabel(playerIndex),
      playerIndex,
      playerCount: match.participants.length,
      desiredPlayers: match.desiredPlayers,
      version: match.version,
      actionSequence: participant.actionSequence,
      expiresAt: new Date(timestampMillis(match.expiresAt)).toISOString(),
      syncsRemaining: participant.syncsRemaining,
      state: this.definition.toPlayerView(match.state, playerIndex),
    };
  }

  async createFriendGame(playerCount = this.definition.defaultMatchSize) {
    const now = Date.now();
    const gameId = randomUUID();
    const inviteCode = generateGameInviteCode();
    const playerToken = createPlayerToken();
    const match = this.createStoredMatch(playerToken, playerCount, now);
    const inviteHash = hashGameInviteCode(this.definition.gameType, inviteCode);
    const batch = adminDb.batch();
    batch.create(adminDb.collection(GAME_COLLECTION).doc(gameId), match);
    batch.create(adminDb.collection(INVITE_COLLECTION).doc(inviteHash), {
      gameType: this.definition.gameType,
      gameId,
      expiresAt: new Date(now + INVITE_LIFETIME_MS),
    });
    await batch.commit();
    return {
      inviteCode,
      playerToken,
      game: this.toDto(gameId, match, 0),
    };
  }

  async joinFriendGame(code: string) {
    const playerToken = createPlayerToken();
    const inviteRef = adminDb
      .collection(INVITE_COLLECTION)
      .doc(hashGameInviteCode(this.definition.gameType, code));
    const result = await adminDb.runTransaction(async (transaction) => {
      const inviteSnapshot = await transaction.get(inviteRef);
      const invite = inviteSnapshot.data();
      if (
        !inviteSnapshot.exists ||
        invite?.gameType !== this.definition.gameType ||
        typeof invite?.gameId !== "string" ||
        timestampMillis(invite.expiresAt) <= Date.now()
      ) {
        throw new ApiError(
          404,
          "Invite code is invalid or expired.",
          "GAME_INVITE_INVALID",
        );
      }
      const gameRef = adminDb.collection(GAME_COLLECTION).doc(invite.gameId);
      const gameSnapshot = await transaction.get(gameRef);
      if (!gameSnapshot.exists) {
        throw new ApiError(
          404,
          "Invite code is invalid or expired.",
          "GAME_INVITE_INVALID",
        );
      }
      const match = this.parseStoredMatch(gameSnapshot.data());
      this.assertNotExpired(match);
      if (
        match.status !== "waiting" ||
        match.participants.length >= match.desiredPlayers
      ) {
        throw new ApiError(
          409,
          "This online match is already full.",
          "GAME_ALREADY_FULL",
        );
      }
      const participants = [
        ...match.participants,
        createParticipant(this.definition.gameType, playerToken),
      ];
      const full = participants.length === match.desiredPlayers;
      const joinedMatch: StoredGameMatch<TState> = {
        ...match,
        participants,
        status: full ? "active" : "waiting",
      };
      transaction.update(gameRef, {
        participants: joinedMatch.participants,
        status: joinedMatch.status,
      });
      if (full) transaction.delete(inviteRef);
      return {
        gameId: invite.gameId,
        match: joinedMatch,
        playerIndex: participants.length - 1,
      };
    });
    return {
      playerToken,
      game: this.toDto(result.gameId, result.match, result.playerIndex),
    };
  }

  async matchmake(
    audience: "guest" | "team",
    playerCount = this.definition.defaultMatchSize,
  ) {
    this.assertPlayerCount(playerCount);
    const now = Date.now();
    const waitingGameId = randomUUID();
    const playerToken = createPlayerToken();
    const slotId = `${this.definition.gameType}-${audience}-${playerCount}`;
    const slotRef = adminDb.collection(MATCHMAKING_COLLECTION).doc(slotId);
    const result = await adminDb.runTransaction(async (transaction) => {
      const slotSnapshot = await transaction.get(slotRef);
      const slot = slotSnapshot.data();
      if (
        slotSnapshot.exists &&
        slot?.gameType === this.definition.gameType &&
        slot?.audience === audience &&
        slot?.playerCount === playerCount &&
        typeof slot?.gameId === "string" &&
        timestampMillis(slot.expiresAt) > now
      ) {
        const gameRef = adminDb.collection(GAME_COLLECTION).doc(slot.gameId);
        const gameSnapshot = await transaction.get(gameRef);
        if (gameSnapshot.exists) {
          const match = this.parseStoredMatch(gameSnapshot.data());
          if (
            timestampMillis(match.expiresAt) > now &&
            match.status === "waiting" &&
            match.participants.length < match.desiredPlayers
          ) {
            const participants = [
              ...match.participants,
              createParticipant(this.definition.gameType, playerToken),
            ];
            const full = participants.length === match.desiredPlayers;
            const joinedMatch: StoredGameMatch<TState> = {
              ...match,
              participants,
              status: full ? "active" : "waiting",
              expiresAt: new Date(
                now + (full ? GAME_LIFETIME_MS : MATCHMAKING_LIFETIME_MS),
              ),
            };
            transaction.update(gameRef, {
              participants: joinedMatch.participants,
              status: joinedMatch.status,
              expiresAt: joinedMatch.expiresAt,
            });
            if (full) {
              transaction.delete(slotRef);
            } else {
              transaction.set(slotRef, {
                gameType: this.definition.gameType,
                audience,
                playerCount,
                gameId: slot.gameId,
                expiresAt: joinedMatch.expiresAt,
              });
            }
            return {
              matched: full,
              playerToken,
              game: this.toDto(
                slot.gameId,
                joinedMatch,
                participants.length - 1,
              ),
            };
          }
        }
      }

      const waitingMatch = this.createStoredMatch(
        playerToken,
        playerCount,
        now,
        MATCHMAKING_LIFETIME_MS,
      );
      const gameRef = adminDb.collection(GAME_COLLECTION).doc(waitingGameId);
      transaction.create(gameRef, waitingMatch);
      transaction.set(slotRef, {
        gameType: this.definition.gameType,
        audience,
        playerCount,
        gameId: waitingGameId,
        expiresAt: new Date(now + MATCHMAKING_LIFETIME_MS),
      });
      return {
        matched: false,
        playerToken,
        game: this.toDto(waitingGameId, waitingMatch, 0),
      };
    });
    return result;
  }

  async sync(gameId: string, playerToken: string) {
    const gameRef = adminDb.collection(GAME_COLLECTION).doc(gameId);
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(gameRef);
      if (!snapshot.exists) {
        throw new ApiError(404, "Online match not found.", "GAME_NOT_FOUND");
      }
      const match = this.parseStoredMatch(snapshot.data());
      this.assertNotExpired(match);
      const playerIndex = this.playerIndexForToken(match, playerToken);
      const participant = match.participants[playerIndex];
      if (participant.syncsRemaining <= 0) {
        throw new ApiError(
          429,
          "This match has reached its synchronization budget.",
          "GAME_SYNC_BUDGET",
        );
      }
      const participants = [...match.participants];
      participants[playerIndex] = {
        ...participant,
        syncsRemaining: participant.syncsRemaining - 1,
      };
      const updatedMatch = { ...match, participants };
      transaction.update(gameRef, { participants });
      return this.toDto(gameId, updatedMatch, playerIndex);
    });
  }

  async action(
    gameId: string,
    playerToken: string,
    revision: GameActionRevision,
    action: TAction,
  ) {
    const gameRef = adminDb.collection(GAME_COLLECTION).doc(gameId);
    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(gameRef);
      if (!snapshot.exists) {
        throw new ApiError(404, "Online match not found.", "GAME_NOT_FOUND");
      }
      const match = this.parseStoredMatch(snapshot.data());
      this.assertNotExpired(match);
      const playerIndex = this.playerIndexForToken(match, playerToken);
      if (match.status !== "active") {
        throw new ApiError(
          409,
          "This match is not ready for actions.",
          "GAME_NOT_ACTIVE",
        );
      }
      if (match.version > this.definition.maxActions) {
        throw new ApiError(
          409,
          "This match has reached its action limit.",
          "GAME_ACTION_LIMIT",
        );
      }
      const participant = match.participants[playerIndex];
      if (this.definition.actionPolicy === "sequential") {
        if (this.definition.activePlayerIndex(match.state) !== playerIndex) {
          throw new ApiError(
            409,
            "Wait for the other player to move.",
            "GAME_WRONG_TURN",
          );
        }
        if (match.version !== revision.expectedVersion) {
          throw new ApiError(
            409,
            "The match changed. Refresh its state and try again.",
            "GAME_STALE_ACTION",
          );
        }
      } else if (
        participant.actionSequence !== revision.expectedActionSequence
      ) {
        throw new ApiError(
          409,
          "Your game state changed. Refresh and try again.",
          "GAME_STALE_ACTION",
        );
      }

      const state = this.definition.applyAction(
        match.state,
        playerIndex,
        action,
      );
      const participants = [...match.participants];
      participants[playerIndex] = {
        ...participant,
        actionSequence: participant.actionSequence + 1,
      };
      const updatedMatch: StoredGameMatch<TState> = {
        ...match,
        state,
        participants,
        status: this.definition.isFinished(state) ? "finished" : "active",
        version: match.version + 1,
      };
      transaction.update(gameRef, {
        state: updatedMatch.state,
        participants: updatedMatch.participants,
        status: updatedMatch.status,
        version: updatedMatch.version,
      });
      return this.toDto(gameId, updatedMatch, playerIndex);
    });
  }
}
