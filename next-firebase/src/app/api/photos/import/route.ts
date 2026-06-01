import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { getGooglePhotosAccessToken } from "@/lib/googleAuth";
import { validateImageMagicBytes, sanitizeAlbumName } from "@/lib/imageImport";

export async function POST(request: Request) {
  try {
    const { items, albumId, albumName } = await request.json() as {
      items: Array<{
        id: string;
        baseUrl: string;
        filename?: string;
        mimeType?: string;
      }>;
      albumId?: string;
      albumName?: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items provided for import" }, { status: 400 });
    }

    console.log(`[Photo Import] Starting ingestion of ${items.length} items on Firebase...`);

    const googleToken = await getGooglePhotosAccessToken();
    const bucket = adminStorage.bucket();
    const results: Array<{
      mediaItemId: string;
      status: "success" | "failed";
      filename: string;
      storagePath?: string;
      publicUrl?: string;
      error?: string;
    }> = [];

    const dateStr = new Date().toISOString().split("T")[0];
    const sanitizedAlbum = albumName ? sanitizeAlbumName(albumName) : "imported";
    const baseFolder = `gallery/${sanitizedAlbum}/${dateStr}`;

    let successCount = 0;
    let failedCount = 0;

    // Process sequentially to keep memory usage low and prevent timeouts
    for (const item of items) {
      const filename = item.filename ?? `photo-${item.id}.jpg`;
      const mimeType = item.mimeType ?? "image/jpeg";

      try {
        // 1. Check Firestore to prevent duplicate imports (Idempotency)
        const photoRef = adminDb.collection("imported_photos").doc(item.id);
        const docSnap = await photoRef.get();

        if (docSnap.exists) {
          console.log(`[Photo Import] Photo ${item.id} already imported. Skipping.`);
          const existingData = docSnap.data();
          results.push({
            mediaItemId: item.id,
            status: "success",
            filename,
            storagePath: existingData?.storagePath,
            publicUrl: existingData?.publicUrl,
          });
          successCount++;
          continue;
        }

        // 2. Download from Google CDN (use =d for maximum high-resolution)
        const downloadUrl = `${item.baseUrl}=d`;
        const downloadRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${googleToken}` },
        });

        if (!downloadRes.ok) {
          throw new Error(`Google Photos download failed with status ${downloadRes.status}`);
        }

        const buffer = await downloadRes.arrayBuffer();

        // 3. High-fidelity magic bytes check (JPEG, PNG, WEBP)
        const validation = validateImageMagicBytes(buffer);
        if (!validation.valid) {
          throw new Error(validation.error ?? "File did not pass magic bytes verification");
        }

        // 4. Stream upload into Firebase Cloud Storage
        const fileKey = `${baseFolder}/${item.id}-${filename}`;
        const storageFile = bucket.file(fileKey);

        await storageFile.save(Buffer.from(buffer), {
          metadata: {
            contentType: mimeType,
            metadata: {
              googleMediaItemId: item.id,
              importedBy: "ARES Team Picker",
            },
          },
          resumable: false, // Better performance for standard images
        });

        // Generate public web URL for standard Firebase Storage serving
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${
          bucket.name
        }/o/${encodeURIComponent(fileKey)}?alt=media`;

        // 5. Write metadata record inside Firestore collections
        const photoMeta = {
          id: item.id,
          storagePath: fileKey,
          publicUrl,
          originalFilename: filename,
          mimeType,
          fileSize: buffer.byteLength,
          importedAt: new Date().toISOString(),
          albumId: albumId || null,
        };

        // Save to global imported photos log
        await photoRef.set(photoMeta);

        // Link inside album photos if albumId is provided
        if (albumId) {
          await adminDb
            .collection("albums")
            .doc(albumId)
            .collection("photos")
            .doc(item.id)
            .set(photoMeta);
        }

        results.push({
          mediaItemId: item.id,
          status: "success",
          filename,
          storagePath: fileKey,
          publicUrl,
        });

        successCount++;
        console.log(`[Photo Import] Ingested photo: ${filename} -> Firebase Storage.`);
      } catch (err: any) {
        console.error(`[Photo Import] Failed to ingest item ${item.id}:`, err);
        results.push({
          mediaItemId: item.id,
          status: "failed",
          filename,
          error: err.message || "Unknown import error",
        });
        failedCount++;
      }
    }

    // 6. Update Album's total photo counts in Firestore if linking
    if (albumId && successCount > 0) {
      try {
        const albumRef = adminDb.collection("albums").doc(albumId);
        const albumSnap = await albumRef.get();
        if (albumSnap.exists) {
          const currentCount = albumSnap.data()?.mediaCount ?? 0;
          await albumRef.update({
            mediaCount: currentCount + successCount,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (countErr) {
        console.warn("[Photo Import] Failed to update album count doc:", countErr);
      }
    }

    return NextResponse.json({
      imported: successCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error("[Photos Ingestion Endpoint Error]:", error);
    return NextResponse.json({ error: "Inward pipeline error: " + error.message }, { status: 500 });
  }
}
