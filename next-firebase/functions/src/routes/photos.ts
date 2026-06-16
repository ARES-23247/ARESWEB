import express from "express";
import crypto from "crypto";
import { adminDb, adminStorage, adminAuth } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { validateImageMagicBytes, sanitizeAlbumName } from "../lib/imageImport";
import { ensureAuth, ensureAdmin } from "../middleware/auth";
import { encrypt } from "../lib/crypto";

const router = express.Router();
const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32 || secret === "01234567890123456789012345678901" || secret === "test-encryption-secret-with-32-chars-long") {
    throw new Error("Fatal: ENCRYPTION_SECRET must be configured with a strong secret of at least 32 characters.");
  }
  return secret;
}

// GET /api/photos
router.get("/", ensureAuth, async (req, res) => {
  try {
    const photosSnap = await adminDb
      .collection("imported_photos")
      .orderBy("importedAt", "desc")
      .get();

    const photos = photosSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ photos });
  } catch (error: any) {
    console.error("[Photos GET Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/photos/albums
router.get("/albums", ensureAuth, async (req, res) => {
  try {
    const albumsSnap = await adminDb
      .collection("albums")
      .orderBy("createdAt", "desc")
      .get();

    const albums = albumsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ albums });
  } catch (error: any) {
    console.error("[Albums GET Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/photos/albums
router.post("/albums", ensureAdmin, async (req, res) => {
  try {
    const { title, description, category, coverImageUrl } = req.body as {
      title: string;
      description?: string;
      category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
      coverImageUrl?: string;
    };

    if (!title || !category) {
      res.status(400).json({ error: "Missing required fields: title, category" });
      return;
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
      res.status(400).json({ error: "An album with this title slug already exists." });
      return;
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
    res.json({ success: true, album: newAlbum });
  } catch (error: any) {
    console.error("[Albums POST Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/photos/import
router.post("/import", ensureAdmin, async (req, res) => {
  try {
    const { items, albumId, albumName } = req.body as {
      items: Array<{
        id: string;
        baseUrl?: string;
        filename?: string;
        mimeType?: string;
        mediaFile?: {
          baseUrl?: string;
          filename?: string;
          mimeType?: string;
        };
      }>;
      albumId?: string;
      albumName?: string;
    };

    if (!items || items.length === 0) {
      res.status(400).json({ error: "No items provided for import" });
      return;
    }

    console.log(`[Photo Import] Starting ingestion of ${items.length} items on Firebase...`);

    const googleToken = await getGooglePhotosAccessToken();
    const bucket = adminStorage.bucket();
    const results: any[] = [];

    const dateStr = new Date().toISOString().split("T")[0];
    const sanitizedAlbum = albumName ? sanitizeAlbumName(albumName) : "imported";
    const baseFolder = `gallery/${sanitizedAlbum}/${dateStr}`;

    let successCount = 0;
    let failedCount = 0;

    // EFF-F01 Batch Optimization: Read all existing photos in a single batch read
    const itemIds = items.map(item => item.id);
    const docRefs = itemIds.map(id => adminDb.collection("imported_photos").doc(id));
    const docSnaps = await adminDb.getAll(...docRefs);
    const docMap = new Map(docSnaps.map(snap => [snap.id, snap]));

    // We compile writes in an array of operations to commit in chunks
    const batchOperations: { ref: any; data: any }[] = [];

    // Process items in parallel chunks of 4 for downloads & GCS uploads
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const itemChunks = chunkArray(items, 4);
    for (const chunk of itemChunks) {
      await Promise.all(
        chunk.map(async (item) => {
          const baseUrl = item.baseUrl || item.mediaFile?.baseUrl;
          let filename = item.filename || item.mediaFile?.filename || `photo-${item.id}.jpg`;

          // Google Photos API returns a JPEG when downscaling via =w2048-h2048.
          // Force mimeType to image/jpeg and map extensions to .jpg (including HEIC/PNG/WEBP).
          const lowerName = filename.toLowerCase();
          if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif") || lowerName.endsWith(".png") || lowerName.endsWith(".webp") || lowerName.endsWith(".jpeg")) {
            filename = filename.replace(/\.(heic|heif|png|webp|jpeg)$/i, ".jpg");
          }
          const mimeType = "image/jpeg";

          try {
            const docSnap = docMap.get(item.id);

            if (docSnap && docSnap.exists) {
              const existingData = docSnap.data();
              results.push({
                mediaItemId: item.id,
                status: "success",
                filename,
                storagePath: existingData?.storagePath,
                publicUrl: existingData?.publicUrl,
              });
              successCount++;
              return;
            }

            if (!baseUrl) {
              throw new Error("No download URL provided for photo.");
            }

            // Downscale to max 2048px on Google Photos side (which also transcodes to JPEG)
            const downloadUrl = `${baseUrl}=w2048-h2048`;
            const downloadRes = await fetch(downloadUrl, {
              headers: { Authorization: `Bearer ${googleToken}` },
            });

            if (!downloadRes.ok) {
              const errorText = await downloadRes.text().catch(() => "");
              throw new Error(`Google Photos download failed with status ${downloadRes.status}: ${errorText}`);
            }

            const buffer = await downloadRes.arrayBuffer();

            const validation = validateImageMagicBytes(buffer);
            if (!validation.valid) {
              throw new Error(validation.error ?? "File did not pass magic bytes verification");
            }

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
              resumable: false,
            });

            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileKey)}?alt=media`;

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

            const photoRef = adminDb.collection("imported_photos").doc(item.id);
            batchOperations.push({ ref: photoRef, data: photoMeta });

            if (albumId) {
              const albumPhotoRef = adminDb
                .collection("albums")
                .doc(albumId)
                .collection("photos")
                .doc(item.id);
              batchOperations.push({ ref: albumPhotoRef, data: photoMeta });
            }

            results.push({
              mediaItemId: item.id,
              status: "success",
              filename,
              storagePath: fileKey,
              publicUrl,
            });

            successCount++;
          } catch (err: any) {
            console.error(`[Photo Import Item Error] Item ID: ${item.id}, Filename: ${filename}. Error details:`, err);
            results.push({
              mediaItemId: item.id,
              status: "failed",
              filename,
              error: err.message || "Unknown import error",
            });
            failedCount++;
          }
        })
      );
    }

    // Commit all Firestore writes in chunks of max 400 operations to prevent 500 limit crash
    if (batchOperations.length > 0) {
      const batchSize = 400;
      for (let i = 0; i < batchOperations.length; i += batchSize) {
        const batch = adminDb.batch();
        const slice = batchOperations.slice(i, i + batchSize);
        for (const op of slice) {
          batch.set(op.ref, op.data);
        }
        await batch.commit();
      }
      console.log(`[Photo Import] Batch committed ${successCount} entries successfully.`);
    }

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

    res.json({
      imported: successCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error("[Photos Ingestion Endpoint Error]:", error);
    res.status(500).json({ error: "Inward pipeline error." });
  }
});

// GET /api/photos/auth/init
// Handle deprecated GET request gracefully if browser cache is stale
router.get("/auth/init", (req, res) => {
  const origin = `${req.protocol}://${req.get("host")}`;
  res.redirect(`${origin}/dashboard/photos?auth_status=error&error_msg=Stale%20browser%20cache%20detected.%20Please%20refresh%20the%20page%20and%20try%20again.`);
});

// POST /api/photos/auth/init
// Secure route to generate anti-CSRF token and return redirect URL
router.post("/auth/init", ensureAdmin, async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "Google OAuth credentials not configured." });
      return;
    }

    const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const origin = `${proto}://${host}`;
    const redirectUri = `${origin}/api/photos/auth`;

    // Generate secure state token
    const state = crypto.randomBytes(16).toString("hex");
    
    // Save to Firestore with a 10 minute expiration
    await adminDb.collection("oauth_states").doc(state).set({
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/photospicker.mediaitems.readonly");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("state", state);

    res.json({ redirectUrl: googleAuthUrl.toString() });
  } catch (error: any) {
    console.error("[Google OAuth Init Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/photos/auth (callback URL)
router.get("/auth", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const error = req.query.error as string | undefined;
    const state = req.query.state as string | undefined;
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const origin = `${proto}://${host}`;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "Google OAuth credentials not configured." });
      return;
    }

    const redirectUri = `${origin}/api/photos/auth`;

    if (error) {
      console.error("[Google OAuth Callback Error]:", error);
      res.redirect(`${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent(error)}`);
      return;
    }

    // SEC-F01: Verify State Parameter against database to prevent CSRF hijacking
    if (!state) {
      res.status(400).json({ error: "State parameter missing. Anti-CSRF check failed." });
      return;
    }
    const stateDocRef = adminDb.collection("oauth_states").doc(state);
    const stateSnap = await stateDocRef.get();
    if (!stateSnap.exists) {
      res.status(400).json({ error: "Invalid or expired state parameter. Anti-CSRF check failed." });
      return;
    }
    
    // Clean up state parameter
    await stateDocRef.delete();

    if (code) {
      console.log("[Google OAuth] Received auth code, exchanging for tokens...");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", errorText);
        res.redirect(
          `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("Token exchange failed")}`
        );
        return;
      }

      const tokens = (await tokenRes.json()) as any;
      const authRef = adminDb.collection("system_settings").doc("google_auth");
      const existingDoc = await authRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      const finalRefreshToken = tokens.refresh_token || existingData?.refreshToken;

      if (!finalRefreshToken) {
        res.redirect(
          `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("No refresh token received.")}`
        );
        return;
      }

      const secret = getEncryptionSecret();
      const encryptedClientId = await encrypt(clientId, secret);
      const encryptedClientSecret = await encrypt(clientSecret, secret);
      const encryptedRefreshToken = await encrypt(finalRefreshToken, secret);

      await authRef.set({
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        refreshToken: encryptedRefreshToken,
        linkedAt: new Date().toISOString(),
        scopes: tokens.scope.split(" "),
        tokenType: tokens.token_type,
      }, { merge: true });

      res.redirect(`${origin}/dashboard/photos?auth_status=success`);
      return;
    }

    res.status(400).json({ error: "Invalid OAuth handshake requests." });
  } catch (error: any) {
    console.error("[Google OAuth Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/photos/picker/media-proxy
router.get("/picker/media-proxy", async (req, res) => {
  try {
    const url = req.query.url as string | undefined;
    if (!url) {
      res.status(400).json({ error: "Missing 'url' query parameter" });
      return;
    }

    // Authenticate: support header or query parameter
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1];
    } else if (req.query.token && typeof req.query.token === "string") {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({ error: "Unauthorized: Missing token" });
      return;
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userDoc = await adminDb.collection("authorized_users").doc(decodedToken.uid).get();
      if (!userDoc.exists) {
        res.status(403).json({ error: "Forbidden: User not authorized" });
        return;
      }
      const userData = userDoc.data();
      if (userData?.role !== "admin" && userData?.role !== "coach" && userData?.role !== "mentor") {
        res.status(403).json({ error: "Forbidden: Insufficient privileges" });
        return;
      }
    } catch (authErr: any) {
      console.error("[media-proxy] Token verification failed:", authErr.message);
      res.status(401).json({ error: "Unauthorized: Invalid token" });
      return;
    }

    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();
      const isAllowedHost =
        host === "photospicker.googleapis.com" ||
        host.endsWith(".googleusercontent.com") ||
        host === "lh3.googleusercontent.com";
      if (!isAllowedHost) {
        console.error(`[media-proxy] Forbidden: Host '${host}' is not in the allowed list.`);
        res.status(400).json({ error: "Forbidden: Target host is not authorized" });
        return;
      }
    } catch (error: any) {
      console.error(`[media-proxy] Invalid URL format provided: '${url}'. Error:`, error.message);
      res.status(400).json({ error: "Invalid URL format" });
      return;
    }

    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[media-proxy] Failed to fetch raw media from url: ${url}. Status: ${response.status}. Error: ${errorText}`);
      res.status(response.status).json({ error: `Failed to proxy media: ${errorText}` });
      return;
    }

    const contentType = response.headers.get("Content-Type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error("[media-proxy] Internal proxy error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/photos/picker/:sessionId/items
router.get("/picker/:sessionId/items", ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `Picker API failed: ${errorText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/photos/picker/:sessionId
router.get("/picker/:sessionId", ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `Picker API failed: ${errorText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/photos/picker
router.post("/picker", ensureAdmin, async (req, res) => {
  try {
    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(`${PICKER_API_BASE}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `Picker API failed: ${errorText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// DELETE /api/photos/picker/:sessionId
router.delete("/picker/:sessionId", ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok && response.status !== 404) {
      console.warn("[Picker API] Warning: Delete session got status:", response.status);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
