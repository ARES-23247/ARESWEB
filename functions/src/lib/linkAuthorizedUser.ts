import { adminDb } from "./firebase-admin";
import { logger } from "./logger";

export interface LinkIdentity {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Re-keys pre-authorized `authorized_users` documents (created by inquiry
 * approval or admin invite before the applicant ever signed in) to the
 * authenticated user's UID. Pre-authorization docs are keyed by a generated
 * ID that no Firebase Auth user will ever receive, so without this link the
 * member stays locked out after their first sign-in.
 *
 * Only verified emails may claim a pre-authorization: the email claim in a
 * verified ID token is attested by the identity provider.
 */
export async function linkAuthorizedUserByEmail({ uid, email, emailVerified }: LinkIdentity): Promise<boolean> {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || emailVerified !== true) return false;

  const snapshot = await adminDb.collection("authorized_users")
    .where("email", "==", normalizedEmail)
    .limit(5)
    .get();
  const orphans = snapshot.docs.filter((doc) => doc.id !== uid);
  if (orphans.length === 0) return false;

  const batch = adminDb.batch();
  const targetRef = adminDb.collection("authorized_users").doc(uid);
  const userProfilesCollection = adminDb.collection("user_profiles");
  for (const doc of orphans) {
    const data = doc.data();
    batch.delete(doc.ref);
    const orphanProfileRef = userProfilesCollection?.doc?.(doc.id);
    const orphanProfileSnap =
      orphanProfileRef && typeof orphanProfileRef.get === "function"
        ? await orphanProfileRef.get()
        : null;
    // An archived pre-authorization is dropped, not inherited.
    if (data.isDeleted !== 1 && data.isDeleted !== true) {
      batch.set(targetRef, {
        ...data,
        email: normalizedEmail,
        linkedAt: new Date().toISOString(),
      }, { merge: true });
      if (orphanProfileSnap?.exists) {
        const profileData = orphanProfileSnap.data();
        const targetProfileRef = userProfilesCollection.doc(uid);
        if (profileData) {
          batch.set(targetProfileRef, profileData, { merge: true });
        }
        batch.delete(orphanProfileRef);
      }
    } else if (orphanProfileSnap?.exists) {
      batch.delete(orphanProfileRef);
    }
  }
  await batch.commit();
  logger.info("auth-link", "Linked a pre-authorized account to the signed-in identity", {
    linkedDocs: orphans.length,
  });
  return true;
}
