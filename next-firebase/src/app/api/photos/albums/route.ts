import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/photos/albums
 * Fetches all albums stored in Firestore sorted by creation date.
 */
export async function GET() {
  try {
    const albumsSnap = await adminDb
      .collection("albums")
      .orderBy("createdAt", "desc")
      .get();

    const albums = albumsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ albums });
  } catch (error: any) {
    console.error("[Albums GET Endpoint Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/photos/albums
 * Creates a brand new album directory in Firestore.
 */
export async function POST(request: Request) {
  try {
    const { title, description, category, coverImageUrl } = await request.json() as {
      title: string;
      description?: string;
      category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design";
      coverImageUrl?: string;
    };

    if (!title || !category) {
      return NextResponse.json({ error: "Missing required fields: title, category" }, { status: 400 });
    }

    const albumId = title
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    const albumDocRef = adminDb.collection("albums").doc(albumId);
    const existing = await albumDocRef.get();

    if (existing.exists) {
      return NextResponse.json({ error: "An album with this title slug already exists." }, { status: 400 });
    }

    const newAlbum = {
      id: albumId,
      title,
      description: description || "",
      category,
      coverImageUrl: coverImageUrl || "",
      mediaCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await albumDocRef.set(newAlbum);
    console.log(`[Firestore] Created photo album: ${title} (${albumId})`);

    return NextResponse.json({ success: true, album: newAlbum });
  } catch (error: any) {
    console.error("[Albums POST Endpoint Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
