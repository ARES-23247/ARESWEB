import { describe, expect, it } from "vitest";
import { canUseMemberAi } from "@/lib/authorization";

describe("canUseMemberAi", () => {
  it.each(["admin", "coach", "mentor", "member", "student", "parent", "lead"])(
    "allows the active team role %s",
    (role) => expect(canUseMemberAi(role)).toBe(true),
  );

  it.each(["unverified", "sponsor", "", null, undefined, 1])(
    "denies the inactive or unknown role %s",
    (role) => expect(canUseMemberAi(role)).toBe(false),
  );
});
