import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { encrypt } from "@/lib/crypto";

/**
 * GET /api/photos/auth
 * Handles both:
 * 1. Initiating Google OAuth authorization link (redirecting to Google Consent Screen).
 * 2. OAuth Callback (Google redirects back with ?code=...). Exchanges code for refresh token and saves to Firestore.
 */
export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) not configured in env variables." },
        { status: 500 }
      );
    }

    const redirectUri = `${origin}/api/photos/auth`;

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 1: Google returned an error
    // ─────────────────────────────────────────────────────────────────────────
    if (error) {
      console.error("[Google OAuth Callback Error]:", error);
      return NextResponse.redirect(`${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent(error)}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 2: Google redirected back with auth code — Complete the exchange
    // ─────────────────────────────────────────────────────────────────────────
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
        return NextResponse.redirect(
          `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("Token exchange failed: " + errorText)}`
        );
      }

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
        token_type: string;
      };

      if (!tokens.refresh_token) {
        console.warn("[Google OAuth] No refresh token returned. This happens if access_type=offline was omitted, or prompt=consent was bypassed.");
      }

      // Save refresh token & configuration securely in Firestore
      const authRef = adminDb.collection("system_settings").doc("google_auth");
      
      // Keep old refresh token if Google didn't return a new one (sometimes happens if prompt=consent is not triggered)
      const existingDoc = await authRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      const finalRefreshToken = tokens.refresh_token || existingData?.refreshToken;

      if (!finalRefreshToken) {
        return NextResponse.redirect(
          `${origin}/dashboard/photos?auth_status=error&error_msg=${encodeURIComponent("No refresh token received. Please remove access in Google Account Settings and re-link.")}`
        );
      }

      const secret = process.env.ENCRYPTION_SECRET || "01234567890123456789012345678901";
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

      console.log("[Google OAuth] Central team Gmail linked successfully! Refresh token persisted.");
      return NextResponse.redirect(`${origin}/dashboard/photos?auth_status=success`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CASE 3: Initiate Auth Link — Redirect user to Google
    // ─────────────────────────────────────────────────────────────────────────
    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/photospicker.mediaitems.readonly");
    googleAuthUrl.searchParams.set("access_type", "offline"); // Crucial to receive a refresh token
    googleAuthUrl.searchParams.set("prompt", "consent"); // Crucial to force refresh token generation

    console.log("[Google OAuth] Redirecting administrator to consent screen...");
    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error: any) {
    console.error("[Google OAuth Endpoint Error]:", error);
    return NextResponse.json(
      { error: "Internal server error: " + error.message },
      { status: 500 }
    );
  }
}
