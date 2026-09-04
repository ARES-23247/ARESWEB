import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const projectId = "aresweb-ci";
let testEnvironment: RulesTestEnvironment;

async function seedAuthorizedUser(uid: string, role: string, isDeleted?: boolean | number) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "authorized_users", uid), {
      role,
      email: `${uid}@example.test`,
      ...(isDeleted === undefined ? {} : { isDeleted }),
    });
  });
}

async function seedDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
) {
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
  it("keeps every raw finance operation behind the admin/coach API", async () => {
    await seedDocument("finance_transactions", "private-ledger", {
      amount: 19.99, receiptUrl: "https://example.test/receipt", isDeleted: 0,
    });
    for (const role of ["admin", "coach", "mentor", "member"]) {
      await seedAuthorizedUser(`finance-${role}`, role);
      const db = testEnvironment.authenticatedContext(`finance-${role}`).firestore();
      const existing = doc(db, "finance_transactions", "private-ledger");
      await assertFails(getDoc(existing));
      await assertFails(getDocs(collection(db, "finance_transactions")));
      await assertFails(setDoc(doc(db, "finance_transactions", `new-${role}`), { amount: 1 }));
      await assertFails(updateDoc(existing, { amount: -100, recordedBy: "spoofed" }));
      await assertFails(deleteDoc(existing));
    }
  });

  it("binds ownership only to atomic new content, never an existing ownerless draft", async () => {
    await seedAuthorizedUser("draft-owner", "member");
    await seedAuthorizedUser("draft-other", "member");
    const db = testEnvironment.authenticatedContext("draft-owner").firestore();
    const other = testEnvironment.authenticatedContext("draft-other").firestore();
    for (const collectionName of ["posts", "docs", "documents"]) {
      const ownership = { collectionName, contentId: "existing", ownerUid: "draft-owner", createdAt: "2026-09-04" };
      const draft = { title: "Original", status: "pending_approval", approvalStatus: "pending_approval", isDeleted: 0 };
      await seedDocument(collectionName, "existing", draft);
      await assertFails(setDoc(doc(db, "content_owners", `${collectionName}__existing`), ownership));
      await assertFails(updateDoc(doc(db, collectionName, "existing"), { title: "Claimed" }));
      await assertFails(runTransaction(db, async tx => {
        tx.set(doc(db, "content_owners", `${collectionName}__existing`), ownership);
        tx.update(doc(db, collectionName, "existing"), { title: "Claimed atomically" });
      }));
      await assertSucceeds(runTransaction(db, async tx => {
        tx.set(doc(db, collectionName, "new-draft"), draft);
        tx.set(doc(db, "content_owners", `${collectionName}__new-draft`), { ...ownership, contentId: "new-draft" });
      }));
      await assertSucceeds(updateDoc(doc(db, collectionName, "new-draft"), { title: "Owner edit" }));
      await assertFails(updateDoc(doc(other, collectionName, "new-draft"), { title: "Other edit" }));
    }
  });

  it("keeps raw public-content records behind server DTO APIs", async () => {
    await seedAuthorizedUser("member-user", "member");
    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();

    for (const [collectionName, id] of [
      ["posts", "published"],
      ["docs", "published"],
      ["documents", "published"],
      ["seasons", "season_2026"],
      ["awards", "award_2026"],
    ] as const) {
      await seedDocument(collectionName, id, {
        status: "published",
        isDeleted: 0,
        internalFutureField: "must-not-cross-the-public-boundary",
      });
      await assertFails(getDoc(doc(publicDb, collectionName, id)));
      await assertFails(getDocs(collection(publicDb, collectionName)));
      await assertSucceeds(getDoc(doc(memberDb, collectionName, id)));
    }
  });

  it("allows publishers to permanently delete only archived awards", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedDocument("awards", "active-award", {
      status: "published",
      isDeleted: 0,
    });
    await seedDocument("awards", "archived-award", {
      status: "published",
      isDeleted: 1,
    });
    await seedDocument("awards", "coach-archived-award", {
      status: "published",
      isDeleted: 1,
    });
    await seedDocument("awards", "mentor-archived-award", {
      status: "published",
      isDeleted: 1,
    });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const coachDb = testEnvironment.authenticatedContext("coach-user").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();

    await assertFails(deleteDoc(doc(adminDb, "awards", "active-award")));
    await assertSucceeds(deleteDoc(doc(adminDb, "awards", "archived-award")));
    await assertSucceeds(deleteDoc(doc(coachDb, "awards", "coach-archived-award")));
    await assertFails(deleteDoc(doc(mentorDb, "awards", "mentor-archived-award")));
  });

  it("enforces role checks for private collection queries, not only document reads", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("inquiries", "private", { status: "pending" });
    await seedDocument("tasks", "team-task", { title: "Build robot" });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDocs(collection(adminDb, "inquiries")));
    await assertFails(getDocs(collection(memberDb, "inquiries")));
    await assertSucceeds(getDocs(collection(memberDb, "tasks")));
    await assertFails(getDocs(collection(publicDb, "tasks")));
  });

  it("binds member drafts to a private owner and protects published content", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("other-member", "member");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedDocument("posts", "published-post", {
      title: "Approved",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });

    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const otherDb = testEnvironment
      .authenticatedContext("other-member")
      .firestore();
    const mentorDb = testEnvironment
      .authenticatedContext("mentor-user")
      .firestore();
    const draftRef = doc(memberDb, "posts", "member-draft");

    await assertSucceeds(
      runTransaction(memberDb, async (transaction) => {
        transaction.set(draftRef, {
          title: "Member draft",
          status: "pending_approval",
          approvalStatus: "pending_approval",
          isDeleted: 0,
        });
        transaction.set(
          doc(memberDb, "content_owners", "posts__member-draft"),
          {
            collectionName: "posts",
            contentId: "member-draft",
            ownerUid: "member-user",
            createdAt: "2026-08-20T12:00:00.000Z",
          },
        );
        transaction.set(
          doc(memberDb, "posts", "member-draft", "revisions", "rev-1"),
          {
            editedBy: "member-user",
            timestamp: "2026-08-20T12:00:00.000Z",
          },
        );
      }),
    );
    await assertSucceeds(updateDoc(draftRef, { title: "Revised by owner" }));
    await assertFails(
      updateDoc(doc(otherDb, "posts", "member-draft"), { title: "Hijacked" }),
    );
    await assertFails(
      getDoc(doc(memberDb, "content_owners", "posts__member-draft")),
    );

    await assertFails(
      updateDoc(doc(memberDb, "posts", "published-post"), {
        title: "Replaced",
        status: "pending_approval",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(mentorDb, "posts", "published-post"), {
        title: "Reviewed update",
        status: "published",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "seasons", "member-season"), {
        status: "draft",
        isDeleted: 0,
      }),
    );
  });

  it("keeps documentation publication behind the server approval transaction", async () => {
    await seedAuthorizedUser("mentor-user", "mentor");
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const pendingRef = doc(mentorDb, "docs", "pending-lesson");

    await assertFails(setDoc(doc(mentorDb, "docs", "direct-publish"), {
      title: "Direct publication",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    }));
    await assertSucceeds(setDoc(pendingRef, {
      title: "Pending lesson",
      status: "pending_approval",
      approvalStatus: "pending_approval",
      isDeleted: 0,
    }));
    await assertFails(updateDoc(pendingRef, {
      status: "published",
      approvalStatus: "approved",
    }));

    await seedDocument("docs", "approved-lesson", {
      title: "Approved lesson",
      content: "Reviewed content",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    const approvedRef = doc(mentorDb, "docs", "approved-lesson");
    await assertFails(updateDoc(approvedRef, { content: "Unreviewed live edit" }));
    await assertSucceeds(updateDoc(approvedRef, {
      content: "Revised pending content",
      status: "pending_approval",
      approvalStatus: "pending_approval",
    }));

    await seedDocument("docs", "approved-archive", {
      title: "Approved archive",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    await assertSucceeds(updateDoc(doc(mentorDb, "docs", "approved-archive"), {
      isDeleted: 1,
      updatedAt: "2026-08-25T12:00:00.000Z",
    }));
    await assertFails(setDoc(doc(mentorDb, "content_approval_audit", "fake"), {
      action: "content.approved",
    }));
  });

  it("limits docs_feedback writes to authorized team members", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("unverified-user", "unverified");
    const feedback = {
      slug: "areslib-fundamentals",
      isHelpful: 1,
      comment: "Clear examples",
      isResolved: 0,
      createdAt: new Date().toISOString(),
    };

    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const unverifiedDb = testEnvironment
      .authenticatedContext("unverified-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, "docs_feedback", "fb_member"), feedback),
    );
    await assertFails(
      setDoc(doc(unverifiedDb, "docs_feedback", "fb_unverified"), feedback),
    );
    await assertFails(
      setDoc(doc(publicDb, "docs_feedback", "fb_public"), feedback),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_oversize"), {
        ...feedback,
        slug: "x".repeat(201),
      }),
    );
  });

  it("keeps inquiry PII restricted to admin and coach roles", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("inquiries", "private", {
      encryptedPayload: "ciphertext",
    });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(adminDb, "inquiries", "private")));
    await assertFails(getDoc(doc(memberDb, "inquiries", "private")));
    await assertFails(getDoc(doc(publicDb, "inquiries", "private")));
  });

  it("requires an authorized user for team task access", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("tasks", "team-task", { title: "Build robot" });

    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const unknownDb = testEnvironment
      .authenticatedContext("unknown-user")
      .firestore();

    await assertSucceeds(getDoc(doc(memberDb, "tasks", "team-task")));
    await assertFails(getDoc(doc(unknownDb, "tasks", "team-task")));
  });

  it("accepts bounded task revision entries and rejects malformed or edited ones", async () => {
    await seedAuthorizedUser("member-user", "member");
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    await seedAuthorizedUser("other-user", "member");

    const baseRevision = {
      action: "moved",
      actorUid: "member-user",
      actorName: "CircuitFox",
      createdAt: "2026-08-17T00:00:00.000Z",
      from: "todo",
      to: "in_progress",
    };
    await assertSucceeds(
      setDoc(doc(memberDb, "tasks/team-task/revisions", "rev-1"), baseRevision),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks/team-task/revisions", "rev-bad-action"), {
        ...baseRevision,
        action: "exploded",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks/team-task/revisions", "rev-foreign-actor"), {
        ...baseRevision,
        actorUid: "someone-else",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks/team-task/revisions", "rev-secret"), {
        ...baseRevision,
        secret: true,
      }),
    );
    await assertFails(
      updateDoc(doc(memberDb, "tasks/team-task/revisions", "rev-1"), {
        action: "deleted",
      }),
    );
    const unknownReader = testEnvironment
      .authenticatedContext("not-a-member")
      .firestore();
    await assertFails(
      getDoc(doc(unknownReader, "tasks/team-task/revisions", "rev-1")),
    );
  });

  it("accepts canonical task creates and bounds untrusted task fields", async () => {
    await seedAuthorizedUser("member-user", "member");
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const canonicalTask = {
      id: "canonical-task",
      title: "Build robot",
      description: "Assemble the drivetrain",
      status: "todo",
      priority: "medium",
      subteam: "hardware",
      assignees: ["member-user"],
      subtasks: [],
      archived: false,
      dueDate: "2026-08-20",
      createdAt: "2026-08-14T00:00:00.000Z",
    };

    await assertSucceeds(
      setDoc(doc(memberDb, "tasks", "canonical-task"), canonicalTask),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "invalid-priority"), {
        ...canonicalTask,
        id: "invalid-priority",
        priority: "normal",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "oversized-title"), {
        ...canonicalTask,
        id: "oversized-title",
        title: "T".repeat(241),
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "unknown-field"), {
        ...canonicalTask,
        id: "unknown-field",
        internalOverride: true,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "invalid-due-date"), {
        ...canonicalTask,
        id: "invalid-due-date",
        dueDate: "August 20",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "oversized-list"), {
        ...canonicalTask,
        id: "oversized-list",
        subtasks: Array.from({ length: 101 }, (_, index) => ({
          id: `${index}`,
          title: "Task",
          done: false,
        })),
      }),
    );
  });

  it("validates only changed fields on legacy tasks and blocks hard deletes", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("tasks", "legacy-task", {
      title: "Legacy task",
      priority: "normal",
      subteam: "Mechanical",
      legacyMetadata: "preserve without trusting",
    });
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const legacyTask = doc(memberDb, "tasks", "legacy-task");

    await assertSucceeds(updateDoc(legacyTask, { title: "Canonical title" }));
    await assertSucceeds(
      updateDoc(legacyTask, { priority: "medium", subteam: "hardware" }),
    );
    await assertSucceeds(updateDoc(legacyTask, { dueDate: "2026-08-20" }));
    await assertSucceeds(updateDoc(legacyTask, { dueDate: null }));
    await assertFails(updateDoc(legacyTask, { priority: "normal" }));
    await assertFails(updateDoc(legacyTask, { dueDate: "08/20/2026" }));
    await assertFails(updateDoc(legacyTask, { forgedRole: "admin" }));
    await assertFails(deleteDoc(legacyTask));
  });

  it("binds web task comments to the authenticated author", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("other-user", "member");
    await seedDocument("tasks", "team-task", { title: "Build robot" });
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const ownComment = doc(
      memberDb,
      "tasks",
      "team-task",
      "comments",
      "comment-1",
    );

    await assertSucceeds(
      setDoc(ownComment, {
        authorUid: "member-user",
        author: "Display label",
        content: "Ready for review",
        source: "web",
        createdAt: "2026-08-12T12:00:00.000Z",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "team-task", "comments", "comment-2"), {
        authorUid: "other-user",
        author: "Spoofed label",
        content: "Forged",
        source: "web",
        createdAt: "2026-08-12T12:00:00.000Z",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "team-task", "comments", "comment-3"), {
        id: "different-id",
        authorUid: "member-user",
        content: "Forged metadata",
        source: "web",
        createdAt: "2026-08-12T12:00:00.000Z",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "team-task", "comments", "comment-4"), {
        authorUid: "member-user",
        content: "Ready",
        source: "web",
        createdAt: "2026-08-12T12:00:00.000Z",
        unexpected: "payload",
      }),
    );
  });

  it("fails closed for unknown roles and archived authorization records", async () => {
    await seedAuthorizedUser("unknown-role", "superuser");
    await seedAuthorizedUser("archived-boolean", "member", true);
    await seedAuthorizedUser("archived-number", "mentor", 1);
    await seedDocument("tasks", "private-task", { title: "Private" });

    for (const uid of ["unknown-role", "archived-boolean", "archived-number"]) {
      const context = testEnvironment.authenticatedContext(uid);
      await assertFails(
        getDoc(doc(context.firestore(), "tasks", "private-task")),
      );
      await assertFails(
        uploadBytes(
          ref(context.storage(), `blog/${uid}.txt`),
          new Blob(["private"], { type: "text/plain" }),
        ),
      );
    }
  });

  it("does not grant legacy owner-scoped data access to Firebase-only accounts", async () => {
    await seedAuthorizedUser("member-user", "member");
    const firebaseOnlyDb = testEnvironment
      .authenticatedContext("firebase-only-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();

    await assertFails(
      setDoc(doc(firebaseOnlyDb, "chat_sessions", "firebase-only-session"), {
        userId: "firebase-only-user",
        messages: [],
      }),
    );
    await assertFails(
      setDoc(
        doc(firebaseOnlyDb, "user_profiles", "firebase-only-user", "layouts", "default"),
        { columns: [] },
      ),
    );

    await assertSucceeds(
      setDoc(doc(memberDb, "chat_sessions", "member-session"), {
        userId: "member-user",
        messages: [],
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(memberDb, "user_profiles", "member-user", "layouts", "default"),
        { columns: [] },
      ),
    );
  });

  it("routes public calendar reads and all event or venue writes through server DTO APIs", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("events", "published-event", {
      status: "published",
      isDeleted: 0,
      title: "Practice",
    });
    await seedDocument("events/published-event/photos", "private-photo", {
      url: "https://images.example.test/practice.jpg",
      uploadedBy: "private-user-id",
      uploadedAt: "2026-08-10T12:00:00.000Z",
      isDeleted: 0,
    });
    await seedDocument("locations", "team-venue", {
      name: "Team Venue",
      address: "Private team address",
    });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();

    await assertFails(getDoc(doc(publicDb, "events", "published-event")));
    await assertFails(getDoc(doc(publicDb, "locations", "team-venue")));
    await assertFails(
      getDoc(
        doc(publicDb, "events", "published-event", "photos", "private-photo"),
      ),
    );
    await assertSucceeds(getDoc(doc(memberDb, "events", "published-event")));
    await assertSucceeds(getDoc(doc(memberDb, "locations", "team-venue")));
    await assertSucceeds(
      getDoc(
        doc(memberDb, "events", "published-event", "photos", "private-photo"),
      ),
    );
    await assertFails(
      setDoc(
        doc(memberDb, "events", "published-event", "photos", "session-photo"),
        {
          url: "https://images.example.test/session.jpg",
          filename: "Session photo",
          uploadedAt: "2026-08-20T20:00:00.000Z",
          occurrenceDate: "2026-08-20",
        },
      ),
    );
    await assertFails(
      setDoc(
        doc(
          memberDb,
          "events",
          "published-event",
          "photos",
          "forged-session-photo",
        ),
        {
          url: "https://images.example.test/session.jpg",
          filename: "Session photo",
          uploadedAt: "2026-08-20T20:00:00.000Z",
          occurrenceDate: "next-practice",
        },
      ),
    );
    await assertFails(
      updateDoc(doc(adminDb, "events", "published-event"), {
        title: "Forged client edit",
      }),
    );
    await assertFails(deleteDoc(doc(adminDb, "events", "published-event")));
    await assertFails(
      updateDoc(doc(adminDb, "locations", "team-venue"), {
        name: "Forged venue edit",
      }),
    );
  });

  it("blocks public raw sponsor and outreach reads while allowing administrators", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("sponsors", "inactive", {
      name: "Private sponsor",
      isActive: false,
    });
    await seedDocument("outreach_logs", "draft", {
      title: "Draft visit",
      status: "draft",
    });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();

    await assertFails(getDoc(doc(publicDb, "sponsors", "inactive")));
    await assertFails(getDoc(doc(publicDb, "outreach_logs", "draft")));
    await assertSucceeds(getDoc(doc(adminDb, "sponsors", "inactive")));
    await assertSucceeds(getDoc(doc(adminDb, "outreach_logs", "draft")));
  });

  it("does not allow a hard-coded email to bootstrap its own admin record", async () => {
    const unprovisionedDb = testEnvironment
      .authenticatedContext("new-user", {
        email: "coach.david@gmail.com",
      })
      .firestore();

    await assertFails(
      setDoc(doc(unprovisionedDb, "authorized_users", "new-user"), {
        email: "coach.david@gmail.com",
        role: "admin",
      }),
    );

    await seedAuthorizedUser("admin-user", "admin");
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    await assertFails(
      setDoc(doc(adminDb, "authorized_users", "client-invite"), {
        email: "invitee@example.test",
        role: "member",
      }),
    );
  });

  it("keeps administrative audit records server-written and admin-readable", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("audit_logs", "permission-change", {
      action: "user.permissions.updated",
      actorUid: "admin-user",
      targetUid: "member-user",
    });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    await assertSucceeds(
      getDoc(doc(adminDb, "audit_logs", "permission-change")),
    );
    await assertFails(getDoc(doc(memberDb, "audit_logs", "permission-change")));
    await assertFails(
      setDoc(doc(adminDb, "audit_logs", "client-write"), { action: "forged" }),
    );
  });

  it("keeps Zulip invitation settings behind the audited API", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("settings", "zulip", {
      inviteUrl: "private-server-config",
      updatedBy: "admin-user",
    });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(publicDb, "settings", "zulip")));
    await assertFails(getDoc(doc(memberDb, "settings", "zulip")));
    await assertFails(getDoc(doc(adminDb, "settings", "zulip")));
    await assertFails(
      setDoc(doc(adminDb, "settings", "zulip"), { inviteUrl: "forged" }),
    );
    await assertFails(
      updateDoc(doc(adminDb, "settings", "zulip"), { inviteUrl: "forged" }),
    );
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

    const studentDb = testEnvironment
      .authenticatedContext("student-user")
      .firestore();
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const profileRef = doc(studentDb, "user_profiles", "student-user");

    await assertFails(getDoc(profileRef));
    await assertFails(getDoc(doc(adminDb, "user_profiles", "student-user")));
    await assertFails(getDoc(doc(publicDb, "user_profiles", "student-user")));
    await assertFails(
      setDoc(doc(studentDb, "user_profiles", "new-profile"), {
        nickname: "Forged",
      }),
    );
    await assertFails(
      updateDoc(profileRef, { showEmail: false, showPhone: false }),
    );
    await assertFails(updateDoc(profileRef, { showEmail: true }));
    await assertFails(
      updateDoc(doc(adminDb, "user_profiles", "student-user"), {
        memberType: "mentor",
      }),
    );
    await assertFails(deleteDoc(doc(adminDb, "user_profiles", "student-user")));
  });

  it("limits tournament and match writes to admin and coach roles", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("tournaments", "states", {
      name: "States",
      isDeleted: 0,
    });
    await seedDocument("tournament_matches", "qm1", {
      tournamentId: "states",
      matchNumber: "QM1",
      isDeleted: 0,
    });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const coachDb = testEnvironment
      .authenticatedContext("coach-user")
      .firestore();
    const mentorDb = testEnvironment
      .authenticatedContext("mentor-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();

    await assertSucceeds(getDoc(doc(memberDb, "tournaments", "states")));
    await assertSucceeds(getDoc(doc(mentorDb, "tournament_matches", "qm1")));
    await assertSucceeds(
      setDoc(doc(adminDb, "tournaments", "admin-event"), {
        name: "Admin event",
        isDeleted: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(coachDb, "tournament_matches", "coach-match"), {
        tournamentId: "states",
        isDeleted: 0,
      }),
    );
    await assertFails(
      setDoc(doc(mentorDb, "tournaments", "mentor-event"), {
        name: "Mentor event",
        isDeleted: 0,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tournament_matches", "member-match"), {
        tournamentId: "states",
        isDeleted: 0,
      }),
    );
  });
});

describe("Robot fleet rules", () => {
  it("keeps admin, coach, and mentor edits aligned while forbidding hard deletes", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("robots", "active", { name: "Active", isDeleted: 0 });
    await seedDocument("robots", "archived", {
      name: "Archived",
      isDeleted: 1,
    });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const coachDb = testEnvironment
      .authenticatedContext("coach-user")
      .firestore();
    const mentorDb = testEnvironment
      .authenticatedContext("mentor-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();

    // Raw documents are team-only; the public website uses the robots DTO API.
    await assertFails(getDoc(doc(publicDb, "robots", "active")));
    await assertFails(getDoc(doc(publicDb, "robots", "archived")));
    await assertSucceeds(getDoc(doc(memberDb, "robots", "active")));
    await assertSucceeds(
      setDoc(doc(adminDb, "robots", "admin-created"), {
        name: "Admin",
        isDeleted: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(coachDb, "robots", "coach-created"), {
        name: "Coach",
        isDeleted: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(mentorDb, "robots", "mentor-created"), {
        name: "Mentor",
        isDeleted: 0,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "robots", "member-created"), {
        name: "Member",
        isDeleted: 0,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(mentorDb, "robots", "active"), { isDeleted: 1 }),
    );
    await assertSucceeds(
      updateDoc(doc(coachDb, "robots", "archived"), { isDeleted: 0 }),
    );
    await assertFails(deleteDoc(doc(adminDb, "robots", "active")));
  });
});

describe("Media API boundary rules", () => {
  it("keeps photo, album, video, and runtime settings documents server-only", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("imported_photos", "photo-1", {
      publicUrl: "https://storage.googleapis.com/photo.jpg",
      isDeleted: 0,
    });
    await seedDocument("albums", "album-1", {
      title: "Competition",
      isPublic: true,
      isDeleted: 0,
    });
    await seedDocument("videos", "video_abcdefghijk", {
      title: "Robot",
      status: "published",
      isDeleted: 0,
    });
    await seedDocument("system_settings", "google_auth", {
      refreshToken: "encrypted-secret",
    });
    await seedDocument("internal_api_quotas", "opaque-quota", { count: 1 });
    await seedDocument("studio_integrations", "ares-team-23247", { status: "active" });
    await seedDocument("studio_integration_quotas", "opaque-studio-quota", { count: 1 });
    await seedDocument("studio_integration_receipts", "opaque-studio-receipt", { draftId: "draft-1" });
    await seedDocument("internal_public_artifacts", "sitemap", {
      version: 1,
      chunkCount: 1,
    });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();

    for (const [collectionName, id] of [
      ["imported_photos", "photo-1"],
      ["albums", "album-1"],
      ["videos", "video_abcdefghijk"],
      ["system_settings", "google_auth"],
      ["internal_api_quotas", "opaque-quota"],
      ["game_matches", "game-1"],
      ["game_invites", "invite-1"],
      ["game_matchmaking", "buzzello-guest-2"],
      ["studio_integrations", "ares-team-23247"],
      ["studio_integration_quotas", "opaque-studio-quota"],
      ["studio_integration_receipts", "opaque-studio-receipt"],
      ["internal_public_artifacts", "sitemap"],
    ] as const) {
      await assertFails(getDoc(doc(publicDb, collectionName, id)));
      await assertFails(getDoc(doc(adminDb, collectionName, id)));
      await assertFails(
        setDoc(doc(adminDb, collectionName, `${id}-forged`), { isDeleted: 0 }),
      );
      await assertFails(
        updateDoc(doc(adminDb, collectionName, id), { isDeleted: 1 }),
      );
      await assertFails(deleteDoc(doc(adminDb, collectionName, id)));
    }
  });

  it("keeps Google Drive identity and sync fields server-owned", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedDocument("documents", "drive_record", {
      title: "Robot Guide",
      status: "draft",
      isDeleted: 0,
      source: "google_drive",
      driveFileId: "1DRIVE_FILE_123456789",
      driveSyncState: "current",
    });
    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const existing = doc(adminDb, "documents", "drive_record");

    await assertSucceeds(
      updateDoc(existing, { title: "Reviewed Robot Guide" }),
    );
    await assertFails(
      updateDoc(existing, { driveFileId: "1FORGED_FILE_123456789" }),
    );
    await assertFails(updateDoc(existing, { driveSyncState: "changed" }));
    await assertFails(
      setDoc(doc(adminDb, "documents", "forged_drive_record"), {
        title: "Forged",
        status: "draft",
        isDeleted: 0,
        source: "google_drive",
        driveFileId: "1FORGED_FILE_123456789",
      }),
    );
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

  it("requires gallery uploads to use the validated server route", async () => {
    await seedAuthorizedUser("member-user", "member");
    const memberStorage = testEnvironment
      .authenticatedContext("member-user")
      .storage();
    const image = new Uint8Array([137, 80, 78, 71]);

    await assertFails(
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

  it("requires sponsor and editor uploads to use the validated server route", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    const image = new Uint8Array([137, 80, 78, 71]);

    for (const uid of ["admin-user", "coach-user"]) {
      const storage = testEnvironment.authenticatedContext(uid).storage();
      await assertFails(
        uploadBytes(ref(storage, `editor/uploads/sponsors/${uid}.png`), image, {
          contentType: "image/png",
        }),
      );
    }
  });

  it("keeps server-owned public-media objects private at the Storage boundary", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    const storage = testEnvironment.authenticatedContext("admin-user").storage();
    const logo = ref(storage, "public-media/sponsors/logo.webp");
    await assertFails(uploadBytes(logo, new Uint8Array([82, 73, 70, 70]), {
      contentType: "image/webp",
    }));
    await assertFails(getBytes(logo));
  });

  it("denies direct reads from every migrated media prefix", async () => {
    const publicStorage = testEnvironment.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(publicStorage, "blog/legacy-photo.jpg")));
    await assertFails(getBytes(ref(publicStorage, "gallery/legacy-photo.jpg")));
    await assertFails(getBytes(ref(publicStorage, "events/event-1/photos/photo-1.jpg")));
    await assertFails(getBytes(ref(publicStorage, "editor/uploads/legacy-photo.jpg")));
  });

  it("rejects retired direct CAD uploads for every role", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("mentor-user", "mentor");
    const memberStorage = testEnvironment
      .authenticatedContext("member-user")
      .storage();
    const mentorStorage = testEnvironment
      .authenticatedContext("mentor-user")
      .storage();
    const cadBytes = new Uint8Array([1, 2, 3, 4]);

    await assertFails(
      uploadBytes(ref(memberStorage, "cad/member.step"), cadBytes),
    );
    await assertFails(
      uploadBytes(ref(mentorStorage, "cad/mentor.step"), cadBytes),
    );
  });
});
