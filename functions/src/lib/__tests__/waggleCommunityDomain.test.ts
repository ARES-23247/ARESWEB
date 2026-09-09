import { describe, expect, it } from "vitest";
import {
  createBlankLevel,
  type LevelDefinition,
} from "../../generated/games/waggle-way/level";
import {
  applyCommand,
  createRun,
  stepRun,
} from "../../generated/games/waggle-way/engine";
import { captureReplay } from "../../generated/games/waggle-way/replay";
import { evaluateWaggleProof } from "../waggleProof";
import {
  communityCard,
  communityId,
  ownedCommunityGarden,
  prepareCommunityRevision,
  readCommunityHead,
  readCommunityRevision,
  type CommunityHead,
} from "../waggleCommunityDomain";
import { CAMPAIGN } from "../../../../src/test/fixtures/waggle-way-legacy/campaign";
import { CAMPAIGN_SOLUTIONS } from "../../../../src/test/fixtures/waggle-way-legacy/solutions";

const id = "a5e8ad6c-f249-44cf-8d5e-f8807b471833";
const otherId = "78bfcc6d-25e4-463d-98c1-15e6799249ea";
const metadata = {
  nickname: "Clover",
  difficulty: "gentle",
  estimatedLength: "short",
};
function proofFor(level: LevelDefinition) {
  const solutions = CAMPAIGN_SOLUTIONS.filter(
    (solution) => solution.levelId === level.id,
  );
  const actions = solutions.length
    ? solutions.map((solution) => solution.actions)
    : [[{ tick: 0, command: { type: "start" as const } }]];
  const replays = actions.map((commands) => {
    let run = createRun(level);
    let cursor = 0;
    while (run.phase !== "finished" && run.tick < 1800) {
      while (commands[cursor]?.tick === run.tick)
        run = applyCommand(level, run, commands[cursor++].command);
      run = stepRun(level, run);
    }
    return captureReplay(level, run);
  });
  return evaluateWaggleProof(JSON.stringify({ level, replays }));
}
const level = createBlankLevel();
const proof = proofFor(level);
const revision = prepareCommunityRevision(id, 1, metadata, level, proof);
const pending: CommunityHead = {
  schema: 1,
  id,
  ownerUid: "private-creator",
  version: 1,
  title: level.title,
  isDeleted: false,
  visibility: "private",
  publishedRevision: null,
  candidateRevision: 1,
  candidateStatus: "pending",
  publishedCard: null,
  reviewReason: null,
  parent: null,
  publishedAt: null,
  retireAt: null,
  createdAt: "2026-09-06T00:00:00.000Z",
  updatedAt: "2026-09-06T00:00:00.000Z",
};
describe("community records and explicit DTOs", () => {
  it("validates public identities and rejects nickname controls or extra identity fields", () => {
    expect(communityId(id)).toBe(id);
    for (const value of ["../private", "uid", null, 4])
      expect(() => communityId(value)).toThrow("identifier");
    for (const value of [
      null,
      { ...metadata, nickname: "" },
      { ...metadata, nickname: "a\u202eb" },
      { ...metadata, uid: "private-creator" },
      { ...metadata, difficulty: "expert" },
    ]) {
      expect(() =>
        prepareCommunityRevision(id, 1, value, level, proof),
      ).toThrow("nickname");
    }
    expect(() => prepareCommunityRevision(id, 1, metadata, {}, proof)).toThrow(
      "supported garden",
    );
    expect(() =>
      prepareCommunityRevision("invalid", 1, metadata, level, proof),
    ).toThrow("unavailable");
  });
  it("binds canonical content, public text and exact revision to review", () => {
    expect(readCommunityRevision(revision, id, 1)).toEqual(revision);
    const changed = prepareCommunityRevision(
      id,
      2,
      { ...metadata, nickname: "Fern" },
      level,
      proof,
    );
    expect(changed.reviewDigest).not.toBe(revision.reviewDigest);
    for (const value of [
      null,
      { ...revision, ownerUid: "private" },
      { ...revision, revision: 2 },
      { ...revision, levelText: "{}" },
      { ...revision, levelText: revision.levelText + " " },
      { ...revision, reviewDigest: "0".repeat(64) },
      { ...revision, metadata: { ...metadata, nickname: "Changed" } },
    ]) {
      expect(() => readCommunityRevision(value, id, 1)).toThrow("unavailable");
    }
    expect(() => readCommunityRevision(revision, otherId, 1)).toThrow(
      "unavailable",
    );
    for (const value of [
      {},
      { ...proof, contentHash: "0".repeat(64) },
      { ...proof, rulesVersion: 4 },
      { ...proof, bindingHash: "0".repeat(64) },
      { ...proof, bestRescued: 0 },
      { ...proof, bestPollen: 1 },
      { ...proof, fewestTools: 1 },
      { ...proof, allBeesProven: false },
      { ...proof, witnesses: [proof.witnesses[0], proof.witnesses[0]] },
      {
        ...proof,
        witnesses: [{ ...proof.witnesses[0], rescued: 0 }],
        bestRescued: 0,
        allBeesProven: false,
      },
    ]) {
      expect(() =>
        prepareCommunityRevision(id, 1, metadata, level, value),
      ).toThrow("unavailable");
      expect(() =>
        readCommunityRevision({ ...revision, verification: value }, id, 1),
      ).toThrow("unavailable");
    }
  });
  it.each(CAMPAIGN)(
    "projects only approved card fields for $level.title",
    ({ level: puzzle }) => {
      const saved = prepareCommunityRevision(
        id,
        1,
        metadata,
        puzzle,
        proofFor(puzzle),
      );
      const card = communityCard(readCommunityRevision(saved, id, 1));
      expect(card.title).toBe(puzzle.title);
      expect(card.nickname).toBe("Clover");
      expect(card.mechanics).not.toContain("hive");
      expect(card.mechanics).not.toContain("flowers");
      expect(Object.keys(card).sort()).toEqual(
        [
          "difficulty",
          "estimatedLength",
          "id",
          "mechanics",
          "nickname",
          "population",
          "rescueTarget",
          "revision",
          "theme",
          "title",
          ...(puzzle.objectives ? ["objectives"] : []),
        ].sort(),
      );
      expect(JSON.stringify(card)).not.toMatch(
        /ownerUid|verification|reviewDigest|witnesses|levelText/u,
      );
    },
  );
  it("rejects corrupt heads instead of presenting unpublished data as a published level", () => {
    expect(readCommunityHead(pending, id)).toEqual(pending);
    const published: CommunityHead = {
      ...pending,
      version: 2,
      visibility: "published",
      publishedRevision: 1,
      publishedAt: pending.createdAt,
      publishedCard: communityCard(revision),
      candidateRevision: null,
      candidateStatus: null,
    };
    expect(
      ownedCommunityGarden(readCommunityHead(published, id)),
    ).toMatchObject({ status: "published", publishedRevision: 1 });
    expect(ownedCommunityGarden(pending)).toMatchObject({ status: "pending" });
    expect(
      ownedCommunityGarden({
        ...pending,
        candidateStatus: "rejected",
        reviewReason: "text",
      }),
    ).toMatchObject({ status: "rejected", reviewReason: "text" });
    const removed: CommunityHead = {
      ...pending,
      visibility: "removed",
      candidateRevision: null,
      candidateStatus: null,
      reviewReason: "unsafe",
    };
    expect(ownedCommunityGarden(readCommunityHead(removed, id)).status).toBe(
      "removed",
    );
    expect(
      ownedCommunityGarden(
        readCommunityHead(
          {
            ...removed,
            visibility: "deleted",
            isDeleted: true,
            title: "",
            reviewReason: null,
            retireAt: "2026-12-05T00:00:00.000Z",
          },
          id,
        ),
      ).status,
    ).toBe("deleted");
    for (const value of [
      null,
      { ...pending, id: otherId },
      { ...pending, visibility: "deleted" },
      { ...pending, publishedRevision: 1 },
      { ...pending, candidateRevision: null },
      { ...pending, candidateRevision: null, candidateStatus: null },
      { ...pending, candidateRevision: 2 },
      { ...pending, parent: { id, revision: 1 } },
      { ...published, version: 1, publishedRevision: 2 },
      { ...published, candidateRevision: 1, candidateStatus: "pending" },
      { ...published, publishedCard: null },
      {
        ...published,
        publishedCard: { ...published.publishedCard, id: otherId },
      },
      {
        ...published,
        publishedCard: { ...published.publishedCard, revision: 2 },
      },
      {
        ...published,
        publishedCard: { ...published.publishedCard, rescueTarget: 100 },
      },
      { ...removed, candidateRevision: 1, candidateStatus: "pending" },
      { ...removed, visibility: "deleted", isDeleted: true },
      {
        ...removed,
        visibility: "deleted",
        isDeleted: true,
        title: "",
        parent: { id: otherId, revision: 1 },
      },
    ])
      expect(() => readCommunityHead(value, id)).toThrow("unavailable");
    expect(JSON.stringify(ownedCommunityGarden(pending))).not.toContain(
      "private-creator",
    );
  });
});
