import { Context } from "hono";
import { AppEnv, getSocialConfig } from "../api/middleware";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}

/**
 * Sends a single email using the Resend API.
 * Pulls configuration (API key, from email) from the context/environment.
 */
export async function sendEmail(c: Context<AppEnv>, options: EmailOptions): Promise<boolean> {
  try {
    const social = await getSocialConfig(c);
    
    if (!social.RESEND_API_KEY) {
      console.warn("[Email] Resend API key not found. Skipping email.");
      return false;
    }

    const fromEmail = social.RESEND_FROM_EMAIL || "team@aresfirst.org";
    const fromName = options.fromName || "ARES Robotics";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${social.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Email] Resend API Error:", errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Email] Exception sending email:", err);
    return false;
  }
}
