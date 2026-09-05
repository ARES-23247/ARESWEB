"use client";

import React from "react";
import { motion } from "framer-motion";
import { Shield, EyeOff, Server, Lock } from "lucide-react";

import { siteConfig } from "@/lib/site-config";
import SEO from "@/components/SEO";
import { AnalyticsConsentPreferencesButton } from "@/components/AnalyticsConsentBanner";

export default function PrivacyPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-obsidian text-white pt-24 pb-16 w-full"
    >
      <SEO
        title="Privacy Policy"
        description="ARES 23247 Privacy Policy. Read how we protect student information and provide optional website analytics."
      />
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold font-heading mb-6 tracking-tight uppercase">
            Privacy{" "}
            <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">
              Policy
            </span>
          </h1>
          <p className="text-xl text-marble border-l-2 border-ares-cyan/30 pl-6">
            ARES 23247 is committed to engineering privacy. Website analytics
            are <strong>optional</strong>, and advertising remains disabled.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan">
                <EyeOff size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">
                1. Optional Web Analytics
              </h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              We use Google Analytics with Consent Mode. Analytics storage is
              denied by default. Visitors may allow analytics cookies, or keep
              the default cookie-free setting. The website remains fully usable
              either way.
            </p>
            <ul className="list-disc pl-6 text-marble space-y-2">
              <li>
                Before a choice, and after a visitor declines, Google receives
                limited cookieless measurement requests without an ARES-set
                analytics identifier.
              </li>
              <li>
                If a visitor allows analytics, Google Analytics may store a
                first-party analytics identifier in that browser to measure
                visits, page views, and visit duration.
              </li>
              <li>
                Advertising storage, advertising user data, personalization,
                Google Signals, and interest-group features remain disabled for
                every choice.
              </li>
              <li>
                ARES does not send names, email addresses, account IDs, form
                entries, or student profile data to Google Analytics.
              </li>
            </ul>
            <AnalyticsConsentPreferencesButton />
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold">
                <Lock size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">
                2. ARES Robotics Studio and Google Drive
              </h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              ARES Robotics Studio is a local-first desktop application. Robot
              connections, authoring, simulation, imported logs, and analysis
              remain on the user&apos;s computer unless the user explicitly
              enables Google Drive synchronization.
            </p>
            <ul className="list-disc pl-6 text-marble space-y-2">
              <li>
                Google sign-in uses a public desktop OAuth client, Authorization
                Code with PKCE, and no client secret.
              </li>
              <li>
                ARES requests basic Google identity and the narrow{" "}
                <code>drive.file</code> permission.
              </li>
              <li>
                ARES may access files it creates or a folder the user explicitly
                selects through Google Picker. It does not scan unrelated Drive
                files.
              </li>
              <li>
                Google remains authoritative for account identity, file
                ownership, folder sharing, Shared Drive membership, and
                revocation.
              </li>
              <li>
                OAuth refresh tokens are stored locally for sign-in continuity.
                Windows releases protect them with the current user&apos;s DPAPI
                credential protection; signing out removes the local token
                record.
              </li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold">
                <Shield size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">
                3. Youth Privacy
              </h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              As a{" "}
              <a
                href="https://www.firstinspires.org/robotics/ftc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ares-red-light transition-colors underline decoration-ares-red/30 underline-offset-4 font-bold"
              >
                <i>FIRST</i>® Tech Challenge
              </a>{" "}
              team, we operate in an environment that includes minors. Our
              collection and publishing practices are designed to limit youth
              data and support applicable privacy requirements, including the
              Children&apos;s Online Privacy Protection Act (COPPA).
            </p>
            <ul className="list-disc pl-6 text-marble space-y-2">
              <li>
                Merely browsing the public website does not submit a visitor’s
                name, email address, phone number, or form entries to ARES.
                Information a person voluntarily enters in an application or
                contact form is used for that stated purpose and protected by
                the site’s access controls.
              </li>
              <li>
                ARES policy requires appropriate student media permission before
                publishing an identifiable student name, photograph, or video.
              </li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan">
                <Server size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">
                4. Optional AI Media Assistance
              </h2>
            </div>
            <p className="text-marble leading-relaxed">
              Authorized publishers may use Gemini on Google Vertex AI to suggest
              descriptions for uploaded team media. A team reviewer decides what
              text is published. Application and contact-form records are not
              sent through this media-assistance workflow.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red">
                <Lock size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">
                5. Secure Administration
              </h2>
            </div>
            <p className="text-marble leading-relaxed">
              The internal content-management system uses Google sign-in, then
              checks the signed-in account against current server-side team access
              records. Administrative actions also require an allowed role and
              the route-specific safeguards described in our security operations.
            </p>
          </section>
          <section className="bg-white/5 border border-white/10 p-8 hero-card">
            <h2 className="text-2xl font-bold font-heading mb-4">6. BUZZLE Dictionary</h2>
            <p className="text-marble leading-relaxed">
              Looking up an accepted BUZZLE word sends that word directly to
              Wiktionary. The provider also receives normal connection data,
              including your IP address. We omit credentials and the page referrer,
              and do not send your rack, match tokens, or account details. Definitions
              are cached temporarily in memory while Word Help is open. Word lists
              and Help Mode searches run locally after the game word list loads.
            </p>
          </section>
        </div>

        <div className="mt-16 text-center text-marble text-sm">
          <p>This privacy policy is actively maintained by ARES 23247.</p>
          <p>
            For inquiries, contact us at{" "}
            <a
              href={`mailto:${siteConfig.contact.email}`}
              aria-label={`Send an email to ${siteConfig.team.name} robotics team`}
              className="text-marble hover:text-ares-red-light transition-colors font-bold tracking-widest uppercase"
            >
              {siteConfig.contact.email}
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
