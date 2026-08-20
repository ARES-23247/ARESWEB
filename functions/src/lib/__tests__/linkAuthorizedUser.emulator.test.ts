import { describe, it, expect } from "vitest";
import { linkAuthorizedUserByEmail } from "../linkAuthorizedUser";
import { adminDb } from "../firebase-admin";

// Runs only under `pnpm run test:functions-emulator`, which executes this file
// inside `firebase emulators:exec --only firestore`. Verifies the real Admin
// SDK query and batch semantics (where-by-email lookup, re-key transaction)
// that the mocked unit tests cannot prove.
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

describe.skipIf(!emulatorHost)("linkAuthorizedUserByEmail (Firestore emulator)", () => {
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    it("re-keys a pre-authorized invite to the signed-in uid exactly once", async () => {
      const email = `invitee-${runId}@example.test`;
      const uid = `auth-${runId}`;

      const invite = await adminDb.collection("authorized_users").add({
        email,
        role: "member",
        memberType: "student",
        isDeleted: 0,
        createdAt: new Date().toISOString(),
      });

      const linked = await linkAuthorizedUserByEmail({
        uid,
        email,
        emailVerified: true,
      });
      expect(linked).toBe(true);

      // The exact retry semantics the auth middleware relies on: after linking,
      // loading authorized_users/{uid} must succeed and carry the invite's role.
      const keyed = await adminDb.collection("authorized_users").doc(uid).get();
      expect(keyed.exists).toBe(true);
      expect(keyed.data()?.role).toBe("member");
      expect(keyed.data()?.email).toBe(email);

      // The generated-ID document must be gone — one authorization per person.
      const orphan = await invite.get();
      expect(orphan.exists).toBe(false);

      // A second sign-in must be a no-op, not a duplicate re-key.
      const linkedAgain = await linkAuthorizedUserByEmail({
        uid,
        email,
        emailVerified: true,
      });
      expect(linkedAgain).toBe(false);
      const count = await adminDb
        .collection("authorized_users")
        .where("email", "==", email)
        .get();
      expect(count.size).toBe(1);
    });

    it("refuses to link an unverified email to someone else's pre-authorization", async () => {
      const email = `victim-${runId}@example.test`;
      const attackerUid = `attacker-${runId}`;

      await adminDb.collection("authorized_users").add({
        email,
        role: "mentor",
        isDeleted: 0,
      });

      const linked = await linkAuthorizedUserByEmail({
        uid: attackerUid,
        email,
        emailVerified: false,
      });
      expect(linked).toBe(false);

      const attackerDoc = await adminDb
        .collection("authorized_users")
        .doc(attackerUid)
        .get();
      expect(attackerDoc.exists).toBe(false);
    });

    it("drops an archived pre-authorization instead of inheriting it", async () => {
      const email = `archived-${runId}@example.test`;
      const uid = `returning-${runId}`;

      const invite = await adminDb.collection("authorized_users").add({
        email,
        role: "member",
        isDeleted: 1,
      });

      const linked = await linkAuthorizedUserByEmail({
        uid,
        email,
        emailVerified: true,
      });
      expect(linked).toBe(true);

      expect(
        (await adminDb.collection("authorized_users").doc(uid).get()).exists,
      ).toBe(false);
      expect((await invite.get()).exists).toBe(false);
    });
  },
);
