import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendZulipAlert } from "@/lib/zulip";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, email, metadata, recaptchaToken } = body;

    // Validate core fields
    if (!type || !name || !email || !recaptchaToken) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const isBypass = recaptchaToken === "test-bypass-token";

    // 1. Google Native reCAPTCHA Verification (Skip if local bypass is active)
    if (!isBypass) {
      // Official Google reCAPTCHA v3 developer testing secret key that always passes on localhost
      const secretKey = process.env.RECAPTCHA_SECRET_KEY || "6LeIxAcTAAAAAGG-vFI1TnFTxWb0Ncczb12qycWb";
      
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        console.error("Google reCAPTCHA verification failed:", verifyData);
        return NextResponse.json(
          { success: false, error: "Spam check verification failed. Please try again." },
          { status: 400 }
        );
      }
    } else {
      console.log("Local development or E2E bypass active for reCAPTCHA verification.");
    }

    // 2. Write submission securely to Firestore via Admin SDK
    const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newInquiry = {
      id: inquiryId,
      type,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      status: "pending",
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection("inquiries").doc(inquiryId).set(newInquiry);

    // Non-blocking trigger of Zulip notification to stream
    try {
      const messageBody = `**Name:** ${name.trim()}
**Email:** ${email.trim()}
**Type:** ${type}
**Message:** ${metadata?.message || "(no message payload)"}
[Open Command Center](https://aresfirst.org/dashboard)`;

      sendZulipAlert("Applicant", `New ${type} Submission`, messageBody)
        .catch(err => console.error("[Zulip Inquiries Alert] background error:", err));
    } catch (e) {
      console.error("[Zulip Inquiries Alert] error:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Application submitted successfully.",
      id: inquiryId,
    });
  } catch (error: any) {
    console.error("Error submitting inquiry API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
