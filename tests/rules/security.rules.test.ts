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
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
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
  it("keeps simulator admission control and authoritative results inaccessible to browser clients", async () => {
    await seedAuthorizedUser("sim-admin", "admin");
    for (const name of ["internal_biobuzz_control", "biobuzz_results"]) {
      await seedDocument(name, "service", { admissionOpen: true, score: { red: 20 } });
      for (const db of [testEnvironment.unauthenticatedContext().firestore(), testEnvironment.authenticatedContext("sim-admin").firestore()]) {
        const target = doc(db, name, "service");
        await assertFails(getDoc(target));
        await assertFails(getDocs(collection(db, name)));
        await assertFails(setDoc(target, { admissionOpen: true, score: { red: 9999 } }));
        await assertFails(deleteDoc(target));
      }
    }
  });
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

  it("blocks direct client deletion and writes on awards even when archived (mutations use /api/awards/admin)", async () => {
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
    await assertFails(deleteDoc(doc(adminDb, "awards", "archived-award")));
    await assertFails(deleteDoc(doc(coachDb, "awards", "coach-archived-award")));
    await assertFails(deleteDoc(doc(mentorDb, "awards", "mentor-archived-award")));
  });

  it("enforces role checks for private collection queries, not only document reads", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("inquiries", "private", { status: "pending" });
    await seedDocument("outreach_logs", "private-log", { status: "draft" });
    await seedDocument("tasks", "team-task", { title: "Build robot" });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDocs(collection(adminDb, "inquiries")));
    await assertFails(getDocs(collection(memberDb, "inquiries")));
    await assertSucceeds(getDocs(collection(adminDb, "outreach_logs")));
    await assertFails(getDocs(collection(memberDb, "outreach_logs")));
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
          authorId: "member-user",
          isApproved: false,
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
      updateDoc(draftRef, { authorId: "other-member" }),
    );
    await assertFails(
      updateDoc(draftRef, { isApproved: true }),
    );
    await assertFails(
      updateDoc(draftRef, { approvalStatus: "approved" }),
    );
    await assertFails(
      updateDoc(draftRef, { approvedBy: "Forged Approver" }),
    );
    await assertFails(
      updateDoc(draftRef, { approvedAt: "2026-08-20T12:05:00.000Z" }),
    );
    await assertFails(
      updateDoc(draftRef, { isDeleted: 1 }),
    );
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
        approvalStatus: "approved",
        approvedBy: "Mentor",
        approvedAt: "2026-08-20T12:10:00.000Z",
        authorId: "mentor-user",
      }),
    );
    await assertFails(
      updateDoc(doc(otherDb, "posts", "published-post"), {
        title: "Student edit keeping stale approval",
        status: "pending_approval",
        approvalStatus: "pending_approval",
        lastEditedByUid: "other-member",
      }),
    );
    await assertFails(
      updateDoc(doc(otherDb, "posts", "published-post"), {
        title: "Student unpublish attempt without snapshot",
        status: "pending_approval",
        approvalStatus: "pending_approval",
        approvedBy: deleteField(),
        approvedAt: deleteField(),
        approvedByUid: deleteField(),
        approvedByRole: deleteField(),
        isApproved: deleteField(),
        lastEditedByUid: "other-member",
      }),
    );
    await assertSucceeds(
      runTransaction(otherDb, async (transaction) => {
        transaction.set(
          doc(otherDb, "posts", "published-post"),
          {
            title: "Student edit awaiting mentor review",
            status: "published",
            approvalStatus: "pending_approval",
            approvedBy: deleteField(),
            approvedAt: deleteField(),
            approvedByUid: deleteField(),
            approvedByRole: deleteField(),
            isApproved: deleteField(),
            lastEditedByUid: "other-member",
            publishedSnapshot: {
              title: "Reviewed update",
            },
          },
          { merge: true },
        );
        transaction.set(
          doc(otherDb, "posts", "published-post", "revisions", "rev-student-1"),
          {
            editedBy: "other-member",
            timestamp: "2026-08-20T12:15:00.000Z",
          },
        );
      }),
    );
    await assertSucceeds(
      runTransaction(otherDb, async (transaction) => {
        transaction.set(
          doc(otherDb, "posts", "published-post"),
          {
            title: "Student follow-up edit before mentor review",
            status: "published",
            approvalStatus: "pending_approval",
            lastEditedByUid: "other-member",
            publishedSnapshot: {
              title: "Reviewed update",
            },
          },
          { merge: true },
        );
        transaction.set(
          doc(otherDb, "posts", "published-post", "revisions", "rev-student-2"),
          {
            editedBy: "other-member",
            timestamp: "2026-08-20T12:16:00.000Z",
          },
        );
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

  it("allows members to submit pending-approval edits on published docs and documents while blocking member archival", async () => {
    await seedAuthorizedUser("member-editor", "member");
    const memberDb = testEnvironment.authenticatedContext("member-editor").firestore();

    await seedDocument("docs", "published-lesson", {
      title: "Published lesson",
      content: "Original lesson",
      status: "published",
      approvalStatus: "approved",
      approvedAt: "2026-08-20T12:00:00.000Z",
      isDeleted: 0,
    });
    await seedDocument("documents", "published-spec", {
      title: "Published spec",
      description: "Original spec",
      status: "published",
      approvalStatus: "approved",
      approvedAt: "2026-08-20T12:00:00.000Z",
      isDeleted: 0,
      source: "google_drive",
      driveFileId: "1DRIVE_FILE_123456789",
    });

    await assertFails(updateDoc(doc(memberDb, "docs", "published-lesson"), {
      isDeleted: 1,
      updatedAt: "2026-08-21T12:00:00.000Z",
    }));
    await assertFails(updateDoc(doc(memberDb, "documents", "published-spec"), {
      isDeleted: 1,
      updatedAt: "2026-08-21T12:00:00.000Z",
    }));

    await assertFails(
      updateDoc(doc(memberDb, "docs", "published-lesson"), {
        content: "Member unpublish attempt",
        status: "pending_approval",
        approvalStatus: "pending_approval",
        approvedAt: deleteField(),
        lastEditedByUid: "member-editor",
      }),
    );
    await assertFails(
      updateDoc(doc(memberDb, "documents", "published-spec"), {
        description: "Member unpublish attempt",
        status: "pending_approval",
        approvalStatus: "pending_approval",
        approvedAt: deleteField(),
        lastEditedByUid: "member-editor",
      }),
    );

    await assertSucceeds(
      runTransaction(memberDb, async (transaction) => {
        transaction.set(
          doc(memberDb, "docs", "published-lesson"),
          {
            content: "Member pending lesson edit",
            status: "published",
            approvalStatus: "pending_approval",
            approvedAt: deleteField(),
            lastEditedByUid: "member-editor",
            publishedSnapshot: {
              title: "Published lesson",
              content: "Original lesson",
            },
          },
          { merge: true },
        );
        transaction.set(
          doc(memberDb, "docs", "published-lesson", "revisions", "rev-member-1"),
          {
            editedBy: "member-editor",
            timestamp: "2026-08-21T12:05:00.000Z",
          },
        );
      }),
    );

    await assertSucceeds(
      runTransaction(memberDb, async (transaction) => {
        transaction.set(
          doc(memberDb, "documents", "published-spec"),
          {
            description: "Member pending spec edit",
            status: "published",
            approvalStatus: "pending_approval",
            approvedAt: deleteField(),
            lastEditedByUid: "member-editor",
            publishedSnapshot: {
              title: "Published spec",
              description: "Original spec",
            },
          },
          { merge: true },
        );
        transaction.set(
          doc(memberDb, "documents", "published-spec", "revisions", "rev-member-1"),
          {
            editedBy: "member-editor",
            timestamp: "2026-08-21T12:06:00.000Z",
          },
        );
      }),
    );

    // Staged pending edits keeping status === "published" with a verified publishedSnapshot
    await seedDocument("posts", "staged-post", {
      title: "Approved Blog Title",
      content: "Approved Blog Content",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    await assertFails(
      updateDoc(doc(memberDb, "posts", "staged-post"), {
        title: "Student Draft Title",
        content: "Student Draft Content",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-editor",
        publishedSnapshot: {
          title: "Forged Live Title",
          content: "Approved Blog Content",
        },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "staged-post"), {
        title: "Student Draft Title",
        content: "Student Draft Content",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-editor",
        publishedSnapshot: {
          title: "Approved Blog Title",
          content: "Approved Blog Content",
        },
      }),
    );
    // Subsequent pending edit must preserve the original publishedSnapshot
    await assertFails(
      updateDoc(doc(memberDb, "posts", "staged-post"), {
        title: "Student Draft Title v2",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-editor",
        publishedSnapshot: {
          title: "Student Draft Title",
          content: "Student Draft Content",
        },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "staged-post"), {
        title: "Student Draft Title v2",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-editor",
        publishedSnapshot: {
          title: "Approved Blog Title",
          content: "Approved Blog Content",
        },
      }),
    );
  });

  it("hardens staged publishedSnapshot edits against unpublishing, unreviewed live mutations, and key injection (AUD-01)", async () => {
    await seedAuthorizedUser("member-attacker", "member");
    await seedAuthorizedUser("mentor-reviewer", "mentor");
    const memberDb = testEnvironment.authenticatedContext("member-attacker").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-reviewer").firestore();

    // 1. Direct unpublishing of published records by member is denied across posts, docs, documents
    //    (even if the member originally owned the content_owners record).
    for (const collectionName of ["posts", "docs", "documents"] as const) {
      await seedDocument(collectionName, "live-record", {
        title: "Live Record",
        content: "Approved body",
        description: "Approved description",
        status: "published",
        approvalStatus: "approved",
        approvedBy: "Coach",
        approvedAt: "2026-08-20T12:00:00.000Z",
        isDeleted: 0,
      });
      await seedDocument("content_owners", `${collectionName}__live-record`, {
        collectionName,
        contentId: "live-record",
        ownerUid: "member-attacker",
        createdAt: "2026-08-19T12:00:00.000Z",
      });

      for (const nextStatus of ["draft", "pending", "pending_approval"] as const) {
        await assertFails(
          updateDoc(doc(memberDb, collectionName, "live-record"), {
            title: "Unpublished by member",
            status: nextStatus,
            approvalStatus: "pending_approval",
            approvedBy: deleteField(),
            approvedAt: deleteField(),
            lastEditedByUid: "member-attacker",
          }),
        );
      }
    }

    // Publishers can still update published posts/documents directly and move docs to pending_approval
    await assertSucceeds(
      updateDoc(doc(mentorDb, "posts", "live-record"), {
        title: "Publisher Direct Edit",
        status: "published",
        approvalStatus: "approved",
      }),
    );
    await assertSucceeds(
      updateDoc(doc(mentorDb, "documents", "live-record"), {
        description: "Publisher Direct Spec Edit",
        status: "published",
        approvalStatus: "approved",
      }),
    );

    // 2. Non-allowlisted keys inside publishedSnapshot are denied (both non-null and null values).
    await seedDocument("posts", "snapshot-key-guard", {
      title: "Approved Title",
      content: "Approved Content",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    for (const forbiddenSnapshot of [
      { title: "Approved Title", approvedBy: "Forged Coach" },
      { title: "Approved Title", approvedByUid: "coach-uid" },
      { title: "Approved Title", approvedByRole: "admin" },
      { title: "Approved Title", approvedAt: "2026-08-20T12:00:00.000Z" },
      { title: "Approved Title", isApproved: true },
      { title: "Approved Title", isDeleted: 0 },
      { title: "Approved Title", status: "published" },
      { title: "Approved Title", approvalStatus: "approved" },
      { title: "Approved Title", authorId: "member-attacker" },
      { title: "Approved Title", importedFrom: "ares-robotics-studio" },
      { title: "Approved Title", driveFileId: "1DRIVE_FORGED" },
      { title: "Approved Title", publishedSnapshot: { title: "Nested" } },
      { title: "Approved Title", evilKey: "injected" },
      { title: "Approved Title", evilKey: null },
    ]) {
      await assertFails(
        updateDoc(doc(memberDb, "posts", "snapshot-key-guard"), {
          title: "Pending Title",
          status: "published",
          approvalStatus: "pending_approval",
          lastEditedByUid: "member-attacker",
          publishedSnapshot: forbiddenSnapshot,
        }),
      );
    }

    // 3. Unreviewed mutation of public/media fields on 1st AND 2nd staged edits is denied
    //    unless the prior published value is preserved inside publishedSnapshot.
    await seedDocument("posts", "media-protected-post", {
      title: "Live Media Post",
      content: "Live body",
      snippet: "Approved snippet",
      thumbnail: "https://aresfirst.org/thumb.webp",
      description: "Approved description",
      mediaPhotoIds: ["public-photo-1"],
      authorAvatar: "https://aresfirst.org/avatar.webp",
      date: "2026-08-20",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });

    // 1st edit: mutating mediaPhotoIds/snippet/thumbnail/description without snapshotting them fails
    for (const unguardedMutation of [
      { mediaPhotoIds: ["public-photo-1", "private-photo-exfil"] },
      { snippet: "Defaced live snippet" },
      { thumbnail: "https://attacker.example/defaced.png" },
      { description: "Defaced description" },
      { authorAvatar: "https://attacker.example/spoof.png" },
      { date: "2099-01-01" },
    ]) {
      await assertFails(
        updateDoc(doc(memberDb, "posts", "media-protected-post"), {
          title: "Draft Title",
          ...unguardedMutation,
          status: "published",
          approvalStatus: "pending_approval",
          lastEditedByUid: "member-attacker",
          publishedSnapshot: {
            title: "Live Media Post",
          },
        }),
      );
    }

    // 1st edit: forging a snapshot field value (even when root field is untouched) fails
    await assertFails(
      updateDoc(doc(memberDb, "posts", "media-protected-post"), {
        title: "Draft Title",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Live Media Post",
          mediaPhotoIds: ["private-photo-exfil"],
        },
      }),
    );

    // 1st edit: legitimately staging title + content only (leaving other fields untouched) succeeds
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "media-protected-post"), {
        title: "Draft Title v1",
        content: "Draft body v1",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Live Media Post",
          content: "Live body",
        },
      }),
    );

    // 2nd edit (subtle second-step bypass): mutating un-snapshotted fields while keeping
    // publishedSnapshot identical MUST fail!
    for (const secondStepMutation of [
      { mediaPhotoIds: ["public-photo-1", "private-photo-exfil"] },
      { snippet: "Second-step defaced snippet" },
      { thumbnail: "https://attacker.example/step2.png" },
      { description: "Second-step defaced description" },
      { date: "2099-12-31" },
    ]) {
      await assertFails(
        updateDoc(doc(memberDb, "posts", "media-protected-post"), {
          title: "Draft Title v2",
          ...secondStepMutation,
          status: "published",
          approvalStatus: "pending_approval",
          lastEditedByUid: "member-attacker",
          publishedSnapshot: {
            title: "Live Media Post",
            content: "Live body",
          },
        }),
      );
    }

    // 2nd edit: modifying only fields that ARE preserved in publishedSnapshot succeeds
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "media-protected-post"), {
        title: "Draft Title v2",
        content: "Draft body v2",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Live Media Post",
          content: "Live body",
        },
      }),
    );

    // 4. Absent fields on a published record: member cannot add mediaPhotoIds/snippet/thumbnail/description
    //    without shadowing them as null in publishedSnapshot (and cannot forge non-null values in snapshot).
    await seedDocument("posts", "sparse-published-post", {
      title: "Sparse Live Post",
      content: "Sparse live body",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    // Omitting mediaPhotoIds from snapshot while adding it on root fails
    await assertFails(
      updateDoc(doc(memberDb, "posts", "sparse-published-post"), {
        title: "Sparse Draft",
        mediaPhotoIds: ["private-photo-1"],
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Sparse Live Post",
        },
      }),
    );
    // Forging a non-null value in snapshot for an absent field fails
    await assertFails(
      updateDoc(doc(memberDb, "posts", "sparse-published-post"), {
        title: "Sparse Draft",
        mediaPhotoIds: ["private-photo-1"],
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Sparse Live Post",
          mediaPhotoIds: ["forged-live-photo"],
        },
      }),
    );
    // Explicitly shadowing absent fields with null in publishedSnapshot succeeds on 1st and 2nd edits
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "sparse-published-post"), {
        title: "Sparse Draft v1",
        mediaPhotoIds: ["pending-photo-1"],
        snippet: "Pending snippet",
        thumbnail: "https://aresfirst.org/pending.webp",
        description: "Pending description",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Sparse Live Post",
          mediaPhotoIds: null,
          snippet: null,
          thumbnail: null,
          description: null,
        },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(memberDb, "posts", "sparse-published-post"), {
        title: "Sparse Draft v2",
        mediaPhotoIds: ["pending-photo-1", "pending-photo-2"],
        snippet: "Pending snippet v2",
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "Sparse Live Post",
          mediaPhotoIds: null,
          snippet: null,
          thumbnail: null,
          description: null,
        },
      }),
    );

    // 5. Academy / ARESLib docs learning metadata + searchIndexable guard (1st & 2nd edits)
    await seedDocument("docs", "published-academy-doc", {
      title: "PID Tuning",
      content: "Approved lesson body",
      description: "Approved lesson description",
      displayInAreslib: 1,
      displayInMathCorner: 0,
      displayInScienceCorner: 0,
      learningSchemaVersion: 1,
      subject: "robotics-engineering",
      objectives: ["Tune kP safely"],
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    // Mutating learning/visibility fields without snapshotting them fails
    await assertFails(
      updateDoc(doc(memberDb, "docs", "published-academy-doc"), {
        title: "PID Tuning Draft",
        displayInAreslib: 0,
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: { title: "PID Tuning" },
      }),
    );
    await assertFails(
      updateDoc(doc(memberDb, "docs", "published-academy-doc"), {
        title: "PID Tuning Draft",
        objectives: ["Injected live objective"],
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: { title: "PID Tuning" },
      }),
    );
    // Flipping searchIndexable on a staged edit is denied even if shadowed as null in snapshot
    await assertFails(
      updateDoc(doc(memberDb, "docs", "published-academy-doc"), {
        title: "PID Tuning Draft",
        searchIndexable: false,
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "PID Tuning",
          searchIndexable: null,
        },
      }),
    );
    // Legitimate member staged edit preserving changed learning fields in snapshot succeeds
    await assertSucceeds(
      updateDoc(doc(memberDb, "docs", "published-academy-doc"), {
        title: "PID Tuning Draft",
        description: "Updated lesson description",
        objectives: ["Tune kP safely", "Verify steady-state error"],
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "PID Tuning",
          description: "Approved lesson description",
          objectives: ["Tune kP safely"],
        },
      }),
    );
    // 2nd edit cannot touch un-snapshotted learningSchemaVersion or displayInAreslib
    await assertFails(
      updateDoc(doc(memberDb, "docs", "published-academy-doc"), {
        title: "PID Tuning Draft v2",
        learningSchemaVersion: 0,
        status: "published",
        approvalStatus: "pending_approval",
        lastEditedByUid: "member-attacker",
        publishedSnapshot: {
          title: "PID Tuning",
          description: "Approved lesson description",
          objectives: ["Tune kP safely"],
        },
      }),
    );
    // Mentor staging an edit on docs also passes valid snapshot checks and is blocked from forging snapshot
    await assertFails(
      updateDoc(doc(mentorDb, "docs", "published-academy-doc"), {
        title: "Mentor Draft",
        status: "published",
        approvalStatus: "pending_approval",
        publishedSnapshot: {
          title: "Forged Live Title",
          description: "Approved lesson description",
          objectives: ["Tune kP safely"],
        },
      }),
    );
    await assertSucceeds(
      updateDoc(doc(mentorDb, "docs", "published-academy-doc"), {
        title: "Mentor Draft",
        status: "published",
        approvalStatus: "pending_approval",
        publishedSnapshot: {
          title: "PID Tuning",
          description: "Approved lesson description",
          objectives: ["Tune kP safely"],
        },
      }),
    );
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

  it("keeps inquiry PII server-only behind /api/inquiries for all roles", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("inquiries", "private", {
      encryptedPayload: "ciphertext",
    });

    const adminDb = testEnvironment
      .authenticatedContext("admin-user")
      .firestore();
    const coachDb = testEnvironment
      .authenticatedContext("coach-user")
      .firestore();
    const memberDb = testEnvironment
      .authenticatedContext("member-user")
      .firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(adminDb, "inquiries", "private")));
    await assertFails(getDoc(doc(coachDb, "inquiries", "private")));
    await assertFails(getDoc(doc(memberDb, "inquiries", "private")));
    await assertFails(getDoc(doc(publicDb, "inquiries", "private")));
    await assertFails(
      setDoc(doc(adminDb, "inquiries", "forged"), { encryptedPayload: "forged" }),
    );
    await assertFails(
      updateDoc(doc(adminDb, "inquiries", "private"), { status: "approved" }),
    );
    await assertFails(deleteDoc(doc(adminDb, "inquiries", "private")));
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

    // chat_sessions is retired: even an authorized owner is denied (B05).
    await assertFails(
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

  it("keeps event revisions server-written audit history that members can only read", async () => {
    await seedAuthorizedUser("revision-member", "member");
    await seedAuthorizedUser("revision-admin", "admin");
    await seedDocument("events", "audited-event", {
      status: "published",
      isDeleted: 0,
      title: "Practice",
    });
    await seedDocument("events/audited-event/revisions", "server-rev", {
      title: "Practice",
      editedBy: "revision-admin",
      editedByName: "ARES Member",
      editedByAvatar: "",
      timestamp: "2026-10-01T12:00:00.000Z",
    });

    const publicDb = testEnvironment.unauthenticatedContext().firestore();
    const memberDb = testEnvironment.authenticatedContext("revision-member").firestore();
    const adminDb = testEnvironment.authenticatedContext("revision-admin").firestore();
    const revisionsPath = ["events", "audited-event", "revisions"] as const;

    await assertSucceeds(getDoc(doc(memberDb, ...revisionsPath, "server-rev")));
    await assertSucceeds(
      getDocs(
        query(collection(memberDb, ...revisionsPath), orderBy("timestamp", "desc"), limit(50)),
      ),
    );
    await assertFails(getDoc(doc(publicDb, ...revisionsPath, "server-rev")));
    await assertFails(getDocs(collection(publicDb, ...revisionsPath)));

    for (const db of [memberDb, adminDb]) {
      await assertFails(
        setDoc(doc(db, ...revisionsPath, "forged-rev"), {
          title: "Forged history",
          editedBy: "revision-admin",
          editedByName: "ARES Member",
          editedByAvatar: "",
          timestamp: "2026-10-02T12:00:00.000Z",
        }),
      );
      await assertFails(
        updateDoc(doc(db, ...revisionsPath, "server-rev"), { title: "Rewritten history" }),
      );
      await assertFails(deleteDoc(doc(db, ...revisionsPath, "server-rev")));
    }
  });

  it("denies all browser access to retired collections without a live consumer", async () => {
    await seedAuthorizedUser("retired-member", "member");
    await seedAuthorizedUser("retired-admin", "admin");
    const retiredCollections = ["team_layouts", "judge_access_codes", "orders", "chat_sessions"];
    for (const name of retiredCollections) {
      await seedDocument(name, "legacy", {
        userId: "retired-member",
        value: "legacy record",
      });
    }

    for (const uid of ["retired-member", "retired-admin"]) {
      const db = testEnvironment.authenticatedContext(uid).firestore();
      for (const name of retiredCollections) {
        const existing = doc(db, name, "legacy");
        await assertFails(getDoc(existing));
        await assertFails(getDocs(collection(db, name)));
        await assertFails(
          setDoc(doc(db, name, `new-${uid}`), { userId: uid, value: "new record" }),
        );
        await assertFails(updateDoc(existing, { value: "tampered" }));
        await assertFails(deleteDoc(existing));
      }
    }
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

  it("blocks public raw sponsor and outreach reads and routes sponsor writes through the server API", async () => {
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
    await assertFails(
      setDoc(doc(adminDb, "sponsors", "forged-sponsor"), {
        name: "Forged sponsor",
        isActive: true,
      }),
    );
    await assertFails(
      updateDoc(doc(adminDb, "sponsors", "inactive"), { isActive: true }),
    );
    await assertFails(deleteDoc(doc(adminDb, "sponsors", "inactive")));
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

  it("routes tournament and match writes through the server API while allowing authorized reads", async () => {
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
    await assertFails(
      setDoc(doc(adminDb, "tournaments", "admin-event"), {
        name: "Admin event",
        isDeleted: 0,
      }),
    );
    await assertFails(
      updateDoc(doc(adminDb, "tournaments", "states"), {
        name: "Tampered States",
      }),
    );
    await assertFails(deleteDoc(doc(adminDb, "tournaments", "states")));
    await assertFails(
      setDoc(doc(coachDb, "tournament_matches", "coach-match"), {
        tournamentId: "states",
        isDeleted: 0,
      }),
    );
    await assertFails(
      updateDoc(doc(coachDb, "tournament_matches", "qm1"), {
        matchNumber: "QM99",
      }),
    );
    await assertFails(deleteDoc(doc(coachDb, "tournament_matches", "qm1")));
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

  it("blocks all direct client writes on seasons and awards (mutations use Express DTO APIs)", async () => {
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("member-user", "member");
    await seedDocument("seasons", "active-season", {
      name: "2025-2026",
      isDeleted: 0,
    });
    await seedDocument("seasons", "admin-archived-season", {
      name: "2023-2024",
      isDeleted: 1,
    });
    await seedDocument("awards", "existing-award", {
      name: "Inspire Award",
      isDeleted: 0,
    });

    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const coachDb = testEnvironment.authenticatedContext("coach-user").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const publicDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(memberDb, "seasons", "active-season")));
    await assertSucceeds(getDoc(doc(memberDb, "awards", "existing-award")));
    await assertFails(getDoc(doc(publicDb, "seasons", "active-season")));
    await assertFails(getDoc(doc(publicDb, "awards", "existing-award")));

    for (const db of [adminDb, coachDb, mentorDb, memberDb]) {
      await assertFails(
        setDoc(doc(db, "seasons", "direct-season"), {
          name: "Direct Season",
          isDeleted: 0,
        }),
      );
      await assertFails(
        updateDoc(doc(db, "seasons", "active-season"), {
          name: "Direct Update",
        }),
      );
      await assertFails(deleteDoc(doc(db, "seasons", "admin-archived-season")));

      await assertFails(
        setDoc(doc(db, "awards", "direct-award"), {
          name: "Direct Award",
          isDeleted: 0,
        }),
      );
      await assertFails(
        updateDoc(doc(db, "awards", "existing-award"), {
          name: "Direct Award Update",
        }),
      );
      await assertFails(deleteDoc(doc(db, "awards", "existing-award")));
    }
  });

  it("validates event signup payloads while blocking member self-promotion of attended and allowing mentor/coach/admin roll call", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("other-member", "member");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("admin-user", "admin");
    await seedAuthorizedUser("coach-user", "coach");
    await seedDocument("events", "practice-1", {
      title: "Practice",
      status: "published",
      isDeleted: 0,
    });

    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const otherDb = testEnvironment.authenticatedContext("other-member").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const coachDb = testEnvironment.authenticatedContext("coach-user").firestore();
    const ownSignup = doc(memberDb, "events", "practice-1", "signups", "member-user");

    // Regular member cannot forge attended: true on initial create
    await assertFails(
      setDoc(ownSignup, {
        userId: "member-user",
        nickname: "RobotBuilder",
        attended: true,
      }),
    );

    await assertSucceeds(
      setDoc(ownSignup, {
        userId: "member-user",
        nickname: "RobotBuilder",
        bringing: "Battery charger",
        prepHours: 2.5,
        notes: "Arriving 10 minutes early",
        attended: false,
      }),
    );

    // Regular member cannot self-promote attended: true from client SDK
    await assertFails(setDoc(ownSignup, { attended: true }, { merge: true }));

    // Mentor can take roll call and mark member attended: true
    await assertSucceeds(
      setDoc(
        doc(mentorDb, "events", "practice-1", "signups", "member-user"),
        { attended: true },
        { merge: true },
      ),
    );

    // Once checked in, member can still update RSVP notes while preserving attended: true
    await assertSucceeds(
      setDoc(
        ownSignup,
        { notes: "In lab — working on odometry", attended: true },
        { merge: true },
      ),
    );

    await assertSucceeds(
      setDoc(
        doc(adminDb, "events", "practice-1", "signups", "other-member"),
        { attended: true },
        { merge: true },
      ),
    );
    await assertSucceeds(
      updateDoc(
        doc(coachDb, "events", "practice-1", "signups", "member-user"),
        { attended: false },
      ),
    );

    // Server-only check-in PIN records are closed to all browser SDK roles
    await assertFails(
      setDoc(doc(adminDb, "event_checkin_codes", "practice-1"), {
        codeHash: "forged",
      }),
    );

    await assertFails(
      setDoc(doc(otherDb, "events", "practice-1", "signups", "member-user"), {
        attended: true,
      }),
    );
    await assertFails(
      setDoc(ownSignup, {
        userId: "member-user",
        nickname: "RobotBuilder",
        unexpectedKey: "rejected",
      }),
    );
    await assertFails(
      setDoc(ownSignup, {
        userId: "spoofed-uid",
        nickname: "RobotBuilder",
      }),
    );
    await assertFails(
      setDoc(ownSignup, {
        userId: "member-user",
        notes: "n".repeat(1001),
      }),
    );
    await assertFails(
      setDoc(ownSignup, {
        userId: "member-user",
        prepHours: -1,
      }),
    );
    await assertSucceeds(deleteDoc(ownSignup));
  });

  it("bounds user layout documents to valid owner column lists", async () => {
    await seedAuthorizedUser("member-user", "member");
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const layoutRef = doc(memberDb, "user_profiles", "member-user", "layouts", "kanban");

    await assertSucceeds(setDoc(layoutRef, { columns: ["todo", "in_progress", "done"] }));
    await assertSucceeds(updateDoc(layoutRef, { columns: [] }));
    await assertFails(
      setDoc(layoutRef, {
        columns: Array.from({ length: 51 }, (_, index) => `col-${index}`),
      }),
    );
    await assertFails(
      setDoc(layoutRef, {
        columns: "not-a-list",
      }),
    );
    await assertSucceeds(deleteDoc(layoutRef));
  });

  it("denies unlisted collections and nested subcollections via the explicit catch-all rule", async () => {
    await seedAuthorizedUser("catchall-member", "member");
    await seedAuthorizedUser("catchall-admin", "admin");
    await seedDocument("unlisted_collection", "secret-doc", { flag: true });
    await seedDocument("posts", "parent-post", {
      title: "Parent Post",
      status: "published",
      isDeleted: 0,
    });
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "posts", "parent-post", "unlisted_sub", "secret-note"),
        { secret: "hidden" },
      );
    });

    const contexts = [
      testEnvironment.unauthenticatedContext().firestore(),
      testEnvironment.authenticatedContext("catchall-member").firestore(),
      testEnvironment.authenticatedContext("catchall-admin").firestore(),
    ];

    for (const db of contexts) {
      for (const path of [
        ["unlisted_collection", "secret-doc"],
        ["posts", "parent-post", "unlisted_sub", "secret-note"],
      ] as const) {
        const refDoc =
          path.length === 2
            ? doc(db, path[0], path[1])
            : doc(db, path[0], path[1], path[2], path[3]);
        const refCol =
          path.length === 2
            ? collection(db, path[0])
            : collection(db, path[0], path[1], path[2]);
        await assertFails(getDoc(refDoc));
        await assertFails(getDocs(refCol));
        await assertFails(setDoc(refDoc, { injected: true }));
        await assertFails(updateDoc(refDoc, { injected: true }));
        await assertFails(deleteDoc(refDoc));
      }
    }
  });

  it("hardens docs_feedback against empty fields, non-int values, and mutations", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("admin-user", "admin");
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    const validFeedback = {
      slug: "areslib-fundamentals",
      isHelpful: 0,
      comment: "Needs one more code example",
      isResolved: 0,
      createdAt: "2026-11-21T12:00:00.000Z",
    };

    const createdRef = doc(memberDb, "docs_feedback", "fb_valid_zero");
    await assertSucceeds(setDoc(createdRef, validFeedback));
    await assertSucceeds(getDoc(createdRef));

    // Reject empty slug, empty/oversized createdAt, non-int isHelpful/isResolved, oversized id, extra keys
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_empty_slug"), {
        ...validFeedback,
        slug: "",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_empty_created"), {
        ...validFeedback,
        createdAt: "",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_long_created"), {
        ...validFeedback,
        createdAt: "2".repeat(41),
      }),
    );
    for (const badHelpful of [true, "1", 0.5, 2, -1]) {
      await assertFails(
        setDoc(doc(memberDb, "docs_feedback", `fb_bad_helpful_${String(badHelpful)}`), {
          ...validFeedback,
          isHelpful: badHelpful,
        }),
      );
    }
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_bad_resolved_float"), {
        ...validFeedback,
        isResolved: 0.5,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_bad_resolved_one"), {
        ...validFeedback,
        isResolved: 1,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "f".repeat(161)), validFeedback),
    );
    await assertFails(
      setDoc(doc(memberDb, "docs_feedback", "fb_extra"), {
        ...validFeedback,
        extra: "injected",
      }),
    );

    // Explicit update/delete deny even for admin
    await assertFails(updateDoc(doc(adminDb, "docs_feedback", "fb_valid_zero"), { isResolved: 1 }));
    await assertFails(deleteDoc(doc(adminDb, "docs_feedback", "fb_valid_zero")));
  });

  it("validates content revision schemas and bounds without breaking pending blog post revisions", async () => {
    await seedAuthorizedUser("member-author", "member");
    await seedAuthorizedUser("mentor-reviewer", "mentor");
    await seedAuthorizedUser("admin-user", "admin");
    const memberDb = testEnvironment.authenticatedContext("member-author").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-reviewer").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    const fullClientRevision = (revId: string, uid: string) => ({
      id: revId,
      title: "Season Kickoff Pending Post",
      description: "Summary of our kickoff brainstorm",
      content: "# Kickoff\n\nDetailed notes.",
      category: "Engineering",
      sortOrder: 1,
      status: "pending_approval",
      displayInAreslib: 0,
      displayInMathCorner: 0,
      displayInScienceCorner: 0,
      isPortfolio: 0,
      isExecutiveSummary: 0,
      fileUrl: "",
      createdAt: "2026-11-21T12:00:00.000Z",
      author: "Member Author",
      date: "2026-11-21",
      thumbnail: "/api/photos/public/content/posts/kickoff-draft/photo-1/medium",
      mediaPhotoIds: ["photo-1"],
      learningSchemaVersion: 1,
      metadataStatus: "complete",
      subject: "robotics-engineering",
      topics: ["drivetrain", "cad"],
      contentType: "lesson",
      level: "beginner",
      estimatedMinutes: 25,
      pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
      prerequisites: ["intro-safety"],
      objectives: ["Design a rigid chassis"],
      platforms: ["ftc"],
      sourceReferences: [{ label: "ARESLib", url: "https://aresfirst.org/areslib" }],
      appliesToVersion: "v2.0",
      reviewedAt: "2026-11-21",
      reviewedByLabel: "Mentor",
      safetyScope: "none",
      editedBy: uid,
      editedByName: "Member Author",
      editedByAvatar: "https://api.dicebear.com/9.x/bottts/svg?seed=member-author",
      timestamp: "2026-11-21T12:00:00.000Z",
    });

    // Full useDocumentSync-shaped transaction succeeds for pending blog posts, docs, and documents
    for (const collectionName of ["posts", "docs", "documents"] as const) {
      const slug = `pending-${collectionName}-entry`;
      const revId = "rev_1732190400000";
      await assertSucceeds(
        runTransaction(memberDb, async (tx) => {
          tx.set(doc(memberDb, collectionName, slug), {
            title: "Season Kickoff Pending Post",
            status: "pending_approval",
            approvalStatus: "pending_approval",
            isDeleted: 0,
          });
          tx.set(doc(memberDb, "content_owners", `${collectionName}__${slug}`), {
            collectionName,
            contentId: slug,
            ownerUid: "member-author",
            createdAt: "2026-11-21T12:00:00.000Z",
          });
          tx.set(
            doc(memberDb, collectionName, slug, "revisions", revId),
            fullClientRevision(revId, "member-author"),
          );
        }),
      );

      // Oversized revisionId
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "r".repeat(161)),
          { editedBy: "member-author", timestamp: "2026-11-21T12:05:00.000Z" },
        ),
      );
      // Injected non-allowlisted key
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_extra_key"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            approvedBy: "Forged Mentor",
          },
        ),
      );
      // Spoofed editedBy
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_spoofed"),
          { editedBy: "mentor-reviewer", timestamp: "2026-11-21T12:05:00.000Z" },
        ),
      );
      // Empty timestamp
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_empty_ts"),
          { editedBy: "member-author", timestamp: "" },
        ),
      );
      // Mismatched id
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_mismatch"),
          { id: "other_id", editedBy: "member-author", timestamp: "2026-11-21T12:05:00.000Z" },
        ),
      );
      // Oversized title & editedByName & editedByAvatar
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_big_title"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            title: "T".repeat(301),
          },
        ),
      );
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_big_name"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            editedByName: "N".repeat(161),
          },
        ),
      );
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_big_avatar"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            editedByAvatar: "A".repeat(2001),
          },
        ),
      );
      // Invalid types & list element bounds
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_bad_types"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            displayInAreslib: true,
          },
        ),
      );
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_bad_topic"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            topics: ["x".repeat(1621)],
          },
        ),
      );
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_nonstring_topic"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            topics: [123],
          },
        ),
      );
      await assertFails(
        setDoc(
          doc(memberDb, collectionName, slug, "revisions", "rev_bad_minutes"),
          {
            editedBy: "member-author",
            timestamp: "2026-11-21T12:05:00.000Z",
            estimatedMinutes: 0,
          },
        ),
      );
      // Orphaned revision under non-existent parent denied even for publisher
      await assertFails(
        setDoc(
          doc(mentorDb, collectionName, "does-not-exist", "revisions", "rev_orphan"),
          { editedBy: "mentor-reviewer", timestamp: "2026-11-21T12:05:00.000Z" },
        ),
      );
      // Revisions remain immutable even for admin
      await assertFails(
        updateDoc(doc(adminDb, collectionName, slug, "revisions", revId), {
          title: "Rewritten history",
        }),
      );
      await assertFails(
        deleteDoc(doc(adminDb, collectionName, slug, "revisions", revId)),
      );
    }
  });

  it("enforces strict schema, element bounds, and update consistency on user layouts", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("admin-user", "admin");
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();
    const layoutRef = doc(memberDb, "user_profiles", "member-user", "layouts", "board");

    // Accepts valid columns + updatedAt and full 50-item list
    await assertSucceeds(
      setDoc(layoutRef, {
        columns: Array.from({ length: 50 }, (_, index) => `col-${index}`),
        updatedAt: "2026-11-21T12:00:00.000Z",
      }),
    );
    await assertSucceeds(
      updateDoc(layoutRef, {
        columns: ["todo", "done"],
        updatedAt: "2026-11-21T12:05:00.000Z",
      }),
    );

    // Blocks arbitrary keys / storage abuse on create and update
    await assertFails(
      setDoc(doc(memberDb, "user_profiles", "member-user", "layouts", "polluted"), {
        columns: ["todo"],
        arbitraryBlob: "X".repeat(10000),
      }),
    );
    await assertFails(updateDoc(layoutRef, { injectedKey: "bad" }));
    await assertFails(updateDoc(layoutRef, { columns: deleteField() }));

    // Blocks non-string or oversized column entries and invalid updatedAt
    await assertFails(updateDoc(layoutRef, { columns: [123] }));
    await assertFails(updateDoc(layoutRef, { columns: ["c".repeat(4051)] }));
    await assertFails(updateDoc(layoutRef, { updatedAt: "" }));
    await assertFails(updateDoc(layoutRef, { updatedAt: "u".repeat(41) }));
    await assertFails(
      setDoc(doc(memberDb, "user_profiles", "member-user", "layouts", "l".repeat(81)), {
        columns: [],
      }),
    );

    // Owner-only isolation holds even against admin
    await assertFails(
      getDoc(doc(adminDb, "user_profiles", "member-user", "layouts", "board")),
    );
    await assertFails(
      updateDoc(doc(adminDb, "user_profiles", "member-user", "layouts", "board"), {
        columns: [],
      }),
    );
  });

  it("hardens tasks, task comments, task revisions, event signups, content_owners, and approved doc archival", async () => {
    await seedAuthorizedUser("member-user", "member");
    await seedAuthorizedUser("other-member", "member");
    await seedAuthorizedUser("mentor-user", "mentor");
    await seedAuthorizedUser("admin-user", "admin");
    const memberDb = testEnvironment.authenticatedContext("member-user").firestore();
    const otherDb = testEnvironment.authenticatedContext("other-member").firestore();
    const mentorDb = testEnvironment.authenticatedContext("mentor-user").firestore();
    const adminDb = testEnvironment.authenticatedContext("admin-user").firestore();

    // 1. Tasks: non-empty createdAt, int isDeleted, bounded string assignees on create & update
    const validTask = {
      id: "hardened-task",
      title: "Inspect chassis",
      description: "Verify fasteners",
      status: "todo",
      priority: "high",
      subteam: "hardware",
      assignees: Array.from({ length: 50 }, (_, index) => `uid-${index}`),
      subtasks: [],
      archived: false,
      isDeleted: 0,
      createdAt: "2026-11-21T12:00:00.000Z",
    };
    const taskRef = doc(memberDb, "tasks", "hardened-task");
    await assertSucceeds(setDoc(taskRef, validTask));
    await assertFails(
      setDoc(doc(memberDb, "tasks", "empty-created"), {
        ...validTask,
        id: "empty-created",
        createdAt: "",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "float-deleted"), {
        ...validTask,
        id: "float-deleted",
        isDeleted: 0.5,
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "bad-assignee-len"), {
        ...validTask,
        id: "bad-assignee-len",
        assignees: ["u".repeat(6451)],
      }),
    );
    await assertFails(updateDoc(taskRef, { assignees: [42] }));
    await assertFails(updateDoc(taskRef, { assignees: ["u".repeat(6451)] }));
    await assertFails(updateDoc(taskRef, { isDeleted: 0.5 }));

    // 2. Task comments: non-empty createdAt + validator consistency on author-only update/delete
    const commentRef = doc(memberDb, "tasks", "hardened-task", "comments", "c-1");
    await assertFails(
      setDoc(doc(memberDb, "tasks", "hardened-task", "comments", "c-empty-ts"), {
        authorUid: "member-user",
        content: "Missing timestamp",
        source: "web",
        createdAt: "",
      }),
    );
    await assertSucceeds(
      setDoc(commentRef, {
        id: "c-1",
        authorUid: "member-user",
        author: "Member",
        content: "Initial comment",
        source: "web",
        createdAt: "2026-11-21T12:00:00.000Z",
      }),
    );
    await assertSucceeds(updateDoc(commentRef, { content: "Edited comment" }));
    await assertFails(updateDoc(commentRef, { content: "x".repeat(4001) }));
    await assertFails(updateDoc(commentRef, { authorUid: "other-member" }));
    await assertFails(
      updateDoc(doc(otherDb, "tasks", "hardened-task", "comments", "c-1"), {
        content: "Hijacked edit",
      }),
    );
    await seedDocument("tasks/hardened-task/comments", "zulip-comment", {
      author: "Zulip Bot",
      content: "Synced from Zulip",
      source: "zulip",
      createdAt: "2026-11-21T12:01:00.000Z",
    });
    await assertFails(
      updateDoc(doc(memberDb, "tasks", "hardened-task", "comments", "zulip-comment"), {
        content: "Tampered Zulip comment",
      }),
    );
    await assertFails(
      deleteDoc(doc(memberDb, "tasks", "hardened-task", "comments", "zulip-comment")),
    );

    // 3. Task revisions: non-empty createdAt + bounded string elements inside fields
    await assertSucceeds(
      setDoc(doc(memberDb, "tasks", "hardened-task", "revisions", "rev-fields-ok"), {
        action: "updated",
        actorUid: "member-user",
        actorName: "Member",
        createdAt: "2026-11-21T12:02:00.000Z",
        fields: ["title", "due date"],
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "hardened-task", "revisions", "rev-empty-ts"), {
        action: "updated",
        actorUid: "member-user",
        actorName: "Member",
        createdAt: "",
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "hardened-task", "revisions", "rev-big-field"), {
        action: "updated",
        actorUid: "member-user",
        actorName: "Member",
        createdAt: "2026-11-21T12:02:00.000Z",
        fields: ["f".repeat(973)],
      }),
    );
    await assertFails(
      setDoc(doc(memberDb, "tasks", "hardened-task", "revisions", "rev-nonstring-field"), {
        action: "updated",
        actorUid: "member-user",
        actorName: "Member",
        createdAt: "2026-11-21T12:02:00.000Z",
        fields: [99],
      }),
    );

    // 4. Event signups: require parent event existence, non-empty payload, and immutable userId
    await assertFails(
      setDoc(doc(mentorDb, "events", "nonexistent-event", "signups", "member-user"), {
        userId: "member-user",
        attended: true,
      }),
    );
    await seedDocument("events", "hardened-event", {
      title: "Build Day",
      status: "published",
      isDeleted: 0,
    });
    const signupRef = doc(memberDb, "events", "hardened-event", "signups", "member-user");
    await assertFails(setDoc(signupRef, {}));
    await assertSucceeds(
      setDoc(signupRef, {
        userId: "member-user",
        nickname: "Member",
        attended: false,
      }),
    );
    await assertFails(updateDoc(signupRef, { userId: deleteField() }));
    await assertFails(updateDoc(signupRef, { nickname: "n".repeat(101) }));
    await assertFails(updateDoc(signupRef, { bringing: "b".repeat(301) }));
    await assertFails(updateDoc(signupRef, { prepHours: 501 }));

    // 5. content_owners: reject empty createdAt and deny updates/deletes even for admin
    await assertFails(
      runTransaction(memberDb, async (tx) => {
        tx.set(doc(memberDb, "posts", "empty-owner-ts"), {
          title: "Draft",
          status: "pending_approval",
          approvalStatus: "pending_approval",
          isDeleted: 0,
        });
        tx.set(doc(memberDb, "content_owners", "posts__empty-owner-ts"), {
          collectionName: "posts",
          contentId: "empty-owner-ts",
          ownerUid: "member-user",
          createdAt: "",
        });
      }),
    );
    await seedDocument("content_owners", "posts__seeded-owner", {
      collectionName: "posts",
      contentId: "seeded-owner",
      ownerUid: "member-user",
      createdAt: "2026-11-21T12:00:00.000Z",
    });
    await assertFails(
      updateDoc(doc(adminDb, "content_owners", "posts__seeded-owner"), {
        ownerUid: "admin-user",
      }),
    );
    await assertFails(
      deleteDoc(doc(adminDb, "content_owners", "posts__seeded-owner")),
    );

    // 6. Approved docs lifecycle-only update rejects non-int isDeleted and empty/oversized updatedAt
    await seedDocument("docs", "approved-lifecycle-guard", {
      title: "Approved Doc",
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
    });
    const approvedDocRef = doc(mentorDb, "docs", "approved-lifecycle-guard");
    await assertFails(updateDoc(approvedDocRef, { isDeleted: true }));
    await assertFails(updateDoc(approvedDocRef, { isDeleted: 0.5 }));
    await assertFails(updateDoc(approvedDocRef, { updatedAt: "" }));
    await assertFails(updateDoc(approvedDocRef, { updatedAt: "u".repeat(41) }));
    await assertSucceeds(
      updateDoc(approvedDocRef, {
        isDeleted: 1,
        updatedAt: "2026-11-21T12:10:00.000Z",
      }),
    );
  });
});

describe("Robot fleet rules", () => {
  it("forbids all direct client writes while keeping team reads authorized", async () => {
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

    // Raw documents are team-only; writes go exclusively through validated Cloud Functions APIs.
    await assertFails(getDoc(doc(publicDb, "robots", "active")));
    await assertFails(getDoc(doc(publicDb, "robots", "archived")));
    await assertSucceeds(getDoc(doc(memberDb, "robots", "active")));
    await assertFails(
      setDoc(doc(adminDb, "robots", "admin-created"), {
        name: "Admin",
        isDeleted: 0,
      }),
    );
    await assertFails(
      setDoc(doc(coachDb, "robots", "coach-created"), {
        name: "Coach",
        isDeleted: 0,
      }),
    );
    await assertFails(
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
    await assertFails(
      updateDoc(doc(adminDb, "robots", "active"), { isDeleted: 1 }),
    );
    await assertFails(
      updateDoc(doc(mentorDb, "robots", "active"), { isDeleted: 1 }),
    );
    await assertFails(
      updateDoc(doc(coachDb, "robots", "archived"), { isDeleted: 0 }),
    );
    await assertFails(deleteDoc(doc(adminDb, "robots", "active")));
  });
});

describe("Media API boundary rules", () => {
  it("keeps all community garden records and nested revisions private even when marked published", async () => {
    const paths = [
      "waggle_levels/garden", "waggle_levels/garden/revisions/1",
      "waggle_creator_limits/creator", "waggle_events/garden_1", "waggle_reports/report",
    ];
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      for (const path of paths) await setDoc(doc(context.firestore(), path), {
        ownerUid: "creator", visibility: "published", isDeleted: false,
      });
    });
    const databases = [testEnvironment.unauthenticatedContext().firestore()];
    for (const role of ["member", "mentor", "coach", "admin"]) {
      const uid = role === "member" ? "creator" : `community-${role}`;
      await seedAuthorizedUser(uid, role);
      databases.push(testEnvironment.authenticatedContext(uid).firestore());
    }
    for (const database of databases) {
      for (const path of paths) {
        const reference = doc(database, path);
        await assertFails(getDoc(reference));
        await assertFails(getDocs(collection(database, path.slice(0, path.lastIndexOf("/")))));
        await assertFails(setDoc(reference, { ownerUid: "creator", visibility: "published", isDeleted: false }));
        await assertFails(updateDoc(reference, { visibility: "published" }));
        await assertFails(deleteDoc(reference));
      }
    }
  });
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

  it("denies reads and writes on arbitrary unlisted paths via the explicit catch-all rule", async () => {
    await seedAuthorizedUser("storage-member", "member");
    await seedAuthorizedUser("storage-admin", "admin");
    const payload = new Uint8Array([115, 101, 99, 114, 101, 116]);
    const storages = [
      testEnvironment.unauthenticatedContext().storage(),
      testEnvironment.authenticatedContext("storage-member").storage(),
      testEnvironment.authenticatedContext("storage-admin").storage(),
    ];

    for (const storage of storages) {
      for (const path of [
        "unlisted-prefix/secret.txt",
        "nested/unlisted/path/object.bin",
      ]) {
        const target = ref(storage, path);
        await assertFails(
          uploadBytes(target, payload, { contentType: "text/plain" }),
        );
        await assertFails(getBytes(target));
      }
    }
  });
});
