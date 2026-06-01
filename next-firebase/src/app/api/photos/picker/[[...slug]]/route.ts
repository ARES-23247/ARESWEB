import { NextResponse } from "next/server";
import { getGooglePhotosAccessToken } from "@/lib/googleAuth";

const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Handles GET requests:
 * - GET /api/photos/picker/media-proxy?url=... -> Proxy Google Photos image CDN
 * - GET /api/photos/picker/[sessionId] -> Poll session status
 * - GET /api/photos/picker/[sessionId]/items -> Get chosen photo items
 */
export async function GET(request: Request, { params }: PageProps) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: GET /api/photos/picker/media-proxy?url=...
    // ─────────────────────────────────────────────────────────────────────────
    if (slug && slug[0] === "media-proxy") {
      const url = searchParams.get("url");
      if (!url) {
        return NextResponse.json({ error: "Missing 'url' query parameter" }, { status: 400 });
      }

      const googleToken = await getGooglePhotosAccessToken();
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });

      if (!response.ok) {
        console.error("[Picker Media Proxy] Google media fetch failed:", response.status);
        return NextResponse.json({ error: "Failed to proxy media" }, { status: response.status });
      }

      const contentType = response.headers.get("Content-Type") || "image/jpeg";
      const buffer = await response.arrayBuffer();

      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Must have a session ID for all other GET requests
    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Invalid path: Missing Session ID" }, { status: 400 });
    }

    const sessionId = slug[0];
    const googleToken = await getGooglePhotosAccessToken();

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: GET /api/photos/picker/[sessionId]/items -> Fetch Selected Items
    // ─────────────────────────────────────────────────────────────────────────
    if (slug.length > 1 && slug[1] === "items") {
      console.log(`[Picker API] Fetching selected items for session: ${sessionId}`);
      const response = await fetch(`${PICKER_API_BASE}/mediaItems?sessionId=${sessionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${googleToken}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Picker API] Fetch selected items failed:", errorText);
        return NextResponse.json({ error: `Picker API failed: ${errorText}` }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 3: GET /api/photos/picker/[sessionId] -> Poll Session Status
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`[Picker API] Polling status for session: ${sessionId}`);
    const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Picker API] Poll session failed:", errorText);
      return NextResponse.json({ error: `Picker API failed: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Picker GET Router Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handles POST requests:
 * - POST /api/photos/picker -> Create active Photos Picker Session
 */
export async function POST(request: Request, { params }: PageProps) {
  try {
    const { slug } = await params;

    // Only allow POST at root level `/api/photos/picker`
    if (slug && slug.length > 0) {
      return NextResponse.json({ error: "Invalid POST endpoint" }, { status: 405 });
    }

    console.log("[Picker API] Creating new selection session...");
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
      console.error("[Picker API] Create session failed:", errorText);
      return NextResponse.json({ error: `Picker API failed: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[Picker POST Router Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handles DELETE requests:
 * - DELETE /api/photos/picker/[sessionId] -> Terminate session
 */
export async function DELETE(request: Request, { params }: PageProps) {
  try {
    const { slug } = await params;

    if (!slug || slug.length === 0) {
      return NextResponse.json({ error: "Missing Session ID for delete" }, { status: 400 });
    }

    const sessionId = slug[0];
    console.log(`[Picker API] Terminating session: ${sessionId}`);
    
    const googleToken = await getGooglePhotosAccessToken();
    const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    if (!response.ok && response.status !== 404) {
      console.warn("[Picker API] Warning: Delete session got status:", response.status);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Picker DELETE Router Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
