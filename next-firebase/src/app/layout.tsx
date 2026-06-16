import type { Metadata } from "next";
import { Inter, League_Spartan } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const leagueSpartan = League_Spartan({
  variable: "--font-spartan",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARES 23247 Team Portal",
  description: "AI-Powered Robotics Telemetry & Collaborative Team Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${leagueSpartan.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-obsidian text-marble">
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || (import.meta.env.DEV ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" : "")}`}
            strategy="lazyOnload"
          />
        </AuthProvider>
      </body>
    </html>
  );
}

