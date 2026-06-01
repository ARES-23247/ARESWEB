import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/photos
 * Returns all successfully imported Google Photos from Firestore.
 */
export async function GET() {
  try {
    const photosSnap = await adminDb
      .collection("imported_photos")
      .orderBy("importedAt", "desc")
      .get();

    const photos = photosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ photos });
  } catch (error: any) {
    console.error("[Photos GET Endpoint Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
