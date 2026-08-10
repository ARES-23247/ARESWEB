import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
