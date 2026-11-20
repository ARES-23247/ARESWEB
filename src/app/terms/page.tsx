"use client";

import React from "react";
import { MotionConfig, motion } from "framer-motion";
import { Scale, BookOpen, CreditCard, ShieldAlert } from "lucide-react";

import { siteConfig } from "@/lib/site-config";
import SEO from "@/components/SEO";

export default function TermsPage() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-obsidian text-white py-12 md:py-16 w-full"
    >
      <SEO 
        title="Terms of Service" 
        description="ARES 23247 Terms of Service. Acceptable use, payments, and liability policies." 
      />
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold font-heading mb-6 tracking-tight uppercase">
            Terms of <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">Service</span>
          </h1>
          <p className="text-xl text-marble border-l-2 border-ares-gold/30 pl-6">
            These Terms of Service govern your use of the ARES 23247 Web Portal and its associated services.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan">
                <BookOpen size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">1. General Provisions & Acceptance</h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              By accessing our website, you agree to these Terms of Service. This portal is provided by <strong>{siteConfig.team.name}</strong>, a registered <em>FIRST</em>® Tech Challenge robotics team located in the United States. 
            </p>
            <p className="text-marble leading-relaxed">
              If you do not agree with any of these terms, you are prohibited from using or accessing this site. All materials contained in this website are protected by applicable copyright and trademark law.
            </p>
            <p className="text-marble leading-relaxed mt-4">
              These terms also cover the optional online features of the ARES Robotics Studio desktop
              application. Its local authoring, simulation, and analysis tools do not require a
              Google account. If you enable Google Drive synchronization, your use of Google Drive
              remains subject to Google&apos;s terms and to the permissions of the folder or Shared Drive
              you select.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold">
                <Scale size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">2. Acceptable Use & Conduct</h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              Users of this platform must adhere to Gracious Professionalism®, the core ethos of <em>FIRST</em>® Robotics.
            </p>
            <ul className="list-disc pl-6 text-marble space-y-2">
              <li>You may not use this website in any way that causes damage, impairment, or disruption to its availability or accessibility.</li>
              <li>You may not engage in any data mining, unauthorized data extraction, or brute-force access attempts against our API endpoints.</li>
              <li>Registered users (students, mentors, sponsors) must maintain the confidentiality of their authentication credentials and are responsible for all activities under their accounts.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan">
                <CreditCard size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">3. Sponsorships, Payments & Refunds</h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              Sponsorships and donations are coordinated directly through our team inquiry process rather than an on-site payment checkout.
            </p>
            <ul className="list-disc pl-6 text-marble space-y-2">
              <li><strong>Inquiries &amp; Contributions:</strong> Our website collects partnership inquiries only and does not process or store credit card or bank account details.</li>
              <li><strong>Donations:</strong> Approved sponsorships and charitable contributions support our youth STEM educational mission and are generally non-refundable once received by our fiscal sponsor.</li>
              <li><strong>Questions &amp; Corrections:</strong> If a contribution was sent in error or requires documentation, please contact {siteConfig.team.name} leadership within 7 days so we can assist you.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red">
                <ShieldAlert size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">4. Liability & Jurisdiction</h2>
            </div>
            <p className="text-marble leading-relaxed mb-4">
              The materials on {siteConfig.team.name}&apos;s website are provided on an &apos;as is&apos; basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
            <p className="text-marble leading-relaxed">
              In no event shall {siteConfig.team.name} or its suppliers be liable for any damages arising out of the use or inability to use the materials on our website. These terms and conditions are governed by and construed in accordance with the laws of the United States, and you irrevocably submit to the exclusive jurisdiction of the courts in that State or location.
            </p>
          </section>
        </div>

        <div className="mt-16 text-center text-marble text-sm">
          <p>Last updated: November 20, 2026</p>
          <p>For legal inquiries, contact us at <a href={`mailto:${siteConfig.contact.email}`} className="text-marble hover:text-ares-red-light transition-colors font-bold tracking-widest uppercase">{siteConfig.contact.email}</a></p>
        </div>
      </div>
    </motion.div>
    </MotionConfig>
  );
}
