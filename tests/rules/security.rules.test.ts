import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "aresweb-ci";
let testEnvironment: RulesTestEnvironment;

async function seedAuthorizedUser(uid: string, role: string) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "authorized_users", uid), {
      role,
      email: `${uid}@example.test`,
    });
  });
}

async function seedDocument(collection: string, id: string, data: Record<string, unknown>) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), collection, id), data);
  });
}

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment?.cleanup();
});

describe("Firestore zero-trust rules", () => {
  it("allows only published, non-deleted posts to be read publicly", async () => {
    await seedDocument("posts", "published", { status: "published", isDeleted: 0 });
    await seedDocument("posts", "draft", { status: "draft", isDeleted: 0 });
    await seedDocument("posts", "deleted", { status: "published", isDeleted: 1 });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, "posts", "published")));
    await assertFails(getDoc(doc(publicDb, "posts", "draft")));
    await assertFails(getDoc(doc(publicDb, "posts", "deleted")));
  });

  it("keeps inquiry PII restricted to admin and coach roles", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("inquiries", "private", { encryptedPayload: "ciphertext" });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(adminDb, "inquiries", "private")));
    await assertFails(getDoc(doc(memberDb, "inquiries", "private")));
    await assertFails(getDoc(doc(publicDb, "inquiries", "private")));
  });

  it("requires an authorized user for team task access", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("tasks", "team-task", { title: "Build robot" });

    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const unknownDb = testEnvironment.authenticatedContext("unknown-user").firestore();

    await assertSucceeds(getDoc(doc(memberDb, "tasks", "team-task")));
    await assertFails(getDoc(doc(unknownDb, "tasks", "team-task")));
  });

  it("routes public calendar reads and all event or venue writes through server DTO APIs", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("events", "published-event", { status: "published", isDeleted: 0, title: "Practice" });
    await seedDocument("events/published-event/photos", "private-photo", {
      url: "https://images.example.test/practice.jpg",
      uploadedBy: "private-user-id",
      uploadedAt: "2026-08-10T12:00:00.000Z",
      isDeleted: 0,
    });
    await seedDocument("locations", "team-venue", { name: "Team Venue", address: "Private team address" });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    await assertFails(getDoc(doc(publicDb, "events", "published-event")));
    await assertFails(getDoc(doc(publicDb, "locations", "team-venue")));
    await assertFails(getDoc(doc(publicDb, "events", "published-event", "photos", "private-photo")));
    await assertSucceeds(getDoc(doc(memberDb, "events", "published-event")));
    await assertSucceeds(getDoc(doc(memberDb, "locations", "team-venue")));
    await assertSucceeds(getDoc(doc(memberDb, "events", "published-event", "photos", "private-photo")));
    await assertFails(updateDoc(doc(adminDb, "events", "published-event"), { title: "Forged client edit" }));
    await assertFails(deleteDoc(doc(adminDb, "events", "published-event")));
    await assertFails(updateDoc(doc(adminDb, "locations", "team-venue"), { name: "Forged venue edit" }));
  });

  it("blocks public raw sponsor and outreach reads while allowing administrators", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("sponsors", "inactive", { name: "Private sponsor", isActive: false });
    await seedDocument("outreach_logs", "draft", { title: "Draft visit", status: "draft" });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    await assertFails(getDoc(doc(publicDb, "sponsors", "inactive")));
    await assertFails(getDoc(doc(publicDb, "outreach_logs", "draft")));
    await assertSucceeds(getDoc(doc(adminDb, "sponsors", "inactive")));
    await assertSucceeds(getDoc(doc(adminDb, "outreach_logs", "draft")));
  });

  it("does not allow a hard-coded email to bootstrap its own admin record", async () => {
    const unprovisionedDb = testEnvironment.authenticatedContext("new-user", {
      email: "coach.david@gmail.com",
    }).firestore();

    await assertFails(setDoc(doc(unprovisionedDb, "authorized_users", "new-user"), {
      email: "coach.david@gmail.com",
      role: "admin",
    }));

    await seedAuthorizedUser("admin-user", "admin");
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    await assertFails(setDoc(doc(adminDb, "authorized_users", "client-invite"), {
      email: "invitee@example.test",
      role: "member",
    }));
  });

  it("keeps administrative audit records server-written and admin-readable", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("audit_logs", "permission-change", {
      action: "user.permissions.updated",
      actorUid: "admin-user",
      targetUid: "member-user",
    });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    await assertSucceeds(getDoc(doc(adminDb, "audit_logs", "permission-change")));
    await assertFails(getDoc(doc(memberDb, "audit_logs", "permission-change")));
    await assertFails(setDoc(doc(adminDb, "audit_logs", "client-write"), { action: "forged" }));
  });

  it("keeps Zulip invitation settings behind the audited API", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("settings", "zulip", {
      inviteUrl: "private-server-config",
      updatedBy: "admin-user",
    });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(publicDb, "settings", "zulip")));
    await assertFails(getDoc(doc(memberDb, "settings", "zulip")));
    await assertFails(getDoc(doc(adminDb, "settings", "zulip")));
    await assertFails(setDoc(doc(adminDb, "settings", "zulip"), { inviteUrl: "forged" }));
    await assertFails(updateDoc(doc(adminDb, "settings", "zulip"), { inviteUrl: "forged" }));
    await assertFails(deleteDoc(doc(adminDb, "settings", "zulip")));
  });

  it("keeps private profile documents server-only for subjects and administrators", async () => {
    await seedAuthorizedUser("student-user", "member");
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("user_profiles", "student-user", {
      nickname: "Student Nickname",
      memberType: "student",
      phone: "encrypted-private-value",
      showEmail: false,
      showPhone: false,
    });

    const studentDb = testEnvironment.authenticatedContext("student-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const profileRef = doc(studentDb, "user_profiles", "student-user");

    await assertFails(getDoc(profileRef));
    await assertFails(getDoc(doc(adminDb, "user_profiles", "student-user")));
    await assertFails(getDoc(doc(publicDb, "user_profiles", "student-user")));
    await assertFails(setDoc(doc(studentDb, "user_profiles", "new-profile"), { nickname: "Forged" }));
    await assertFails(updateDoc(profileRef, { showEmail: false, showPhone: false }));
    await assertFails(updateDoc(profileRef, { showEmail: true }));
    await assertFails(updateDoc(doc(adminDb, "user_profiles", "student-user"), { memberType: "mentor" }));
    await assertFails(deleteDoc(doc(adminDb, "user_profiles", "student-user")));
  });

  it("limits tournament and match writes to admin and coach roles", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("tournaments", "states", { name: "States", isDeleted: 0 });
    await seedDocument("tournament_matches", "qm1", {
      tournamentId: "states",
      matchNumber: "QM1",
      isDeleted: 0,
    });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const coachDb = testEnvironment.authenticatedContext("coach-user").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();

    await assertSucceeds(getDoc(doc(memberDb, "tournaments", "states")));
    await assertSucceeds(getDoc(doc(mentorDb, "tournament_matches", "qm1")));
    await assertSucceeds(setDoc(doc(adminDb, "tournaments", "admin-event"), { name: "Admin event", isDeleted: 0 }));
    await assertSucceeds(setDoc(doc(coachDb, "tournament_matches", "coach-match"), { tournamentId: "states", isDeleted: 0 }));
    await assertFails(setDoc(doc(mentorDb, "tournaments", "mentor-event"), { name: "Mentor event", isDeleted: 0 }));
    await assertFails(setDoc(doc(memberDb, "tournament_matches", "member-match"), { tournamentId: "states", isDeleted: 0 }));
  });
});

describe("Robot fleet rules", () => {
  it("keeps admin, coach, and mentor edits aligned while forbidding hard deletes", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("robots", "active", { name: "Active", isDeleted: 0 });
    await seedDocument("robots", "archived", { name: "Archived", isDeleted: 1 });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const coachDb = testEnvironment.authenticatedContext("coach-user").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();

    await assertSucceeds(getDoc(doc(publicDb, "robots", "active")));
    await assertFails(getDoc(doc(publicDb, "robots", "archived")));
    await assertSucceeds(setDoc(doc(adminDb, "robots", "admin-created"), { name: "Admin", isDeleted: 0 }));
    await assertSucceeds(setDoc(doc(coachDb, "robots", "coach-created"), { name: "Coach", isDeleted: 0 }));
    await assertSucceeds(setDoc(doc(mentorDb, "robots", "mentor-created"), { name: "Mentor", isDeleted: 0 }));
    await assertFails(setDoc(doc(memberDb, "robots", "member-created"), { name: "Member", isDeleted: 0 }));
    await assertSucceeds(updateDoc(doc(mentorDb, "robots", "active"), { isDeleted: 1 }));
    await assertSucceeds(updateDoc(doc(coachDb, "robots", "archived"), { isDeleted: 0 }));
    await assertFails(deleteDoc(doc(adminDb, "robots", "active")));
  });
});

describe("Media API boundary rules", () => {
  it("keeps photo, album, video, and runtime settings documents server-only", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("imported_photos", "photo-1", { publicUrl: "https://storage.googleapis.com/photo.jpg", isDeleted: 0 });
    await seedDocument("albums", "album-1", { title: "Competition", isPublic: true, isDeleted: 0 });
    await seedDocument("videos", "video_abcdefghijk", { title: "Robot", status: "published", isDeleted: 0 });
    await seedDocument("system_settings", "google_auth", { refreshToken: "encrypted-secret" });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    for (const [collectionName, id] of [
      ["imported_photos", "photo-1"],
      ["albums", "album-1"],
      ["videos", "video_abcdefghijk"],
      ["system_settings", "google_auth"],
    ] as const) {
      await assertFails(getDoc(doc(publicDb, collectionName, id)));
      await assertFails(getDoc(doc(adminDb, collectionName, id)));
      await assertFails(setDoc(doc(adminDb, collectionName, `${id}-forged`), { isDeleted: 0 }));
      await assertFails(updateDoc(doc(adminDb, collectionName, id), { isDeleted: 1 }));
      await assertFails(deleteDoc(doc(adminDb, collectionName, id)));
    }
  });
});

describe("Storage zero-trust rules", () => {
  it("rejects unauthenticated gallery uploads", async () => {
    const publicStorage = testEnvironment.unauthenticatedContext().storage();
    const image = new Uint8Array([137, 80, 78, 71]);

    await assertFails(
      uploadBytes(ref(publicStorage, "gallery/public-upload.png"), image, {
        contentType: "image/png",
      }),
    );
  });

  it("allows bounded image uploads for authorized members", async () => {
    await seedAuthorizedUser("member-user", "member");
    const memberStorage = testEnvironment.authenticatedContext("member-user").storage();
    const image = new Uint8Array([137, 80, 78, 71]);

    await assertSucceeds(
      uploadBytes(ref(memberStorage, "gallery/member-upload.png"), image, {
        contentType: "image/png",
      }),
    );
    await assertFails(
      uploadBytes(ref(memberStorage, "gallery/member-upload.txt"), image, {
        contentType: "text/plain",
      }),
    );
  });

  it("limits CAD uploads to content managers", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("mentor-user", "mentor");
    const memberStorage = testEnvironment.authenticatedContext("member-user").storage();
    const mentorStorage = testEnvironment.authenticatedContext("mentor-user").storage();
    const cadBytes = new Uint8Array([1, 2, 3, 4]);

    await assertFails(uploadBytes(ref(memberStorage, "cad/member.step"), cadBytes));
    await assertSucceeds(uploadBytes(ref(mentorStorage, "cad/mentor.step"), cadBytes));
  });
});
