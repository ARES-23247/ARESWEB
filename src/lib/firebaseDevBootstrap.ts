import { doc, setDoc } from "firebase/firestore";
import { db, getDocWithTimeout } from "./firebaseFirestore";

interface DevelopmentAuthorizedUser {
  uid: string;
  email: string;
  role: string;
  name: string;
}

export async function bootstrapDevelopmentAuthorizedUser(user: DevelopmentAuthorizedUser) {
  const userRef = doc(db, "authorized_users", user.uid);
  const userSnap = await getDocWithTimeout(userRef, 1000);
  if (userSnap.exists()) return;

  await Promise.race([
    setDoc(userRef, { email: user.email, role: user.role, name: user.name }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Firestore setDoc timeout")), 1000);
    }),
  ]);
}
