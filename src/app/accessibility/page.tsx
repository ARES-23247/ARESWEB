"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Eye,
  Keyboard,
  BookOpen,
  Layers,
  CheckCircle2,
  Mail,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { siteConfig } from "@/lib/site-config";
import SEO from "@/components/SEO";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-obsidian text-white selection:bg-ares-gold selection:text-obsidian pt-24 pb-20">
      <SEO
        title="Accessibility Statement & Web Standards"
        description="ARES 23247's commitment to WCAG 2.2 Level AA web accessibility, inclusive design, assistive technology testing, and grievance reporting."
      />
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-1 bg-ares-red"></span>
            <span className="text-marble font-mono text-sm tracking-widest uppercase">
              Digital Manifesto & A11y Conformance
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight uppercase font-heading">
            Accessibility{" "}
            <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">
              Statement
            </span>
          </h1>
          <p className="text-marble text-lg md:text-xl leading-relaxed">
            As part of our commitment to the <em>FIRST</em>® Robotics core values
            and inclusive engineering, ARES 23247 architects our digital
            infrastructure to conform with the{" "}
            <strong className="text-white">
              Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
            </strong>{" "}
            standards, ensuring our resources and tools are accessible to every
            student, mentor, and supporter.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-ares-red/10 border border-ares-red/30 text-ares-red-light font-bold">
              <CheckCircle2 size={14} aria-hidden="true" />
              Target: WCAG 2.2 Level AA
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 border border-white/10 text-marble">
              <ShieldCheck size={14} aria-hidden="true" />
              Section 508 & EN 301 549 Aligned
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan">
              <Sparkles size={14} aria-hidden="true" />
              Continuous Auditing
            </span>
          </div>
        </motion.div>

        {/* 4 Core WCAG Principles */}
        <section aria-labelledby="core-principles-heading" className="mb-16">
          <h2
            id="core-principles-heading"
            className="text-2xl md:text-3xl font-bold font-heading uppercase tracking-wide mb-8 text-white flex items-center gap-3"
          >
            <span className="w-4 h-4 bg-ares-gold inline-block"></span>
            WCAG 2.2 AA Core Principles
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Principle 1: Perceivable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-white/5 border border-white/10 p-8 hero-card h-full flex flex-col justify-between">
                <div>
                  <div className="bg-ares-red/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-red">
                    <Eye size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">
                    1. Perceivable
                  </h3>
                  <p className="text-marble leading-relaxed mb-4">
                    Information and user interface components must be presentable
                    to users in ways they can perceive.
                  </p>
                  <ul className="list-disc pl-5 text-marble/90 space-y-2 text-sm">
                    <li>
                      <strong className="text-white">Text Alternatives:</strong>{" "}
                      Descriptive alternative text (<code>alt</code>) and captions are
                      authored for all published media, robot CAD models, and
                      diagrams.
                    </li>
                    <li>
                      <strong className="text-white">Contrast Standards:</strong>{" "}
                      Color tokens guarantee a minimum contrast ratio of 4.5:1
                      for normal text and 3:1 for large text and graphical user
                      interface elements against dark obsidian backgrounds.
                    </li>
                    <li>
                      <strong className="text-white">Reflow & Zoom:</strong>{" "}
                      Layouts support 200% to 400% browser zoom down to 320 CSS
                      pixels without loss of content or two-dimensional
                      scrolling.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Principle 2: Operable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="bg-white/5 border border-white/10 p-8 hero-card h-full flex flex-col justify-between">
                <div>
                  <div className="bg-ares-gold/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-gold">
                    <Keyboard size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">
                    2. Operable
                  </h3>
                  <p className="text-marble leading-relaxed mb-4">
                    User interface components and navigation must be fully
                    operable via keyboard and assistive technology.
                  </p>
                  <ul className="list-disc pl-5 text-marble/90 space-y-2 text-sm">
                    <li>
                      <strong className="text-white">Keyboard Navigation:</strong>{" "}
                      Every interactive control, navigation menu, and tab is
                      navigable using standard keyboard keys (Tab, Shift+Tab,
                      Arrows, Enter, Space, Escape).
                    </li>
                    <li>
                      <strong className="text-white">Skip Links:</strong> A
                      top-level skip link allows users to bypass repetitive
                      navigation and jump immediately to main content.
                    </li>
                    <li>
                      <strong className="text-white">
                        Focus Trapping & Dismissal:
                      </strong>{" "}
                      Dialogs, drawers, and photo lightboxes contain focus safely
                      on the active layer and restore focus to triggering elements
                      upon dismissal.
                    </li>
                    <li>
                      <strong className="text-white">
                        Simulation Alternatives:
                      </strong>{" "}
                      Interactive canvas and SVG simulations include native,
                      accessible HTML controls (spinbuttons, directional buttons,
                      selectors) as keyboard alternatives.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Principle 3: Understandable */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-white/5 border border-white/10 p-8 hero-card h-full flex flex-col justify-between">
                <div>
                  <div className="bg-ares-cyan/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-cyan">
                    <BookOpen size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">
                    3. Understandable
                  </h3>
                  <p className="text-marble leading-relaxed mb-4">
                    Information and the operation of the user interface must be
                    clear, readable, and predictable.
                  </p>
                  <ul className="list-disc pl-5 text-marble/90 space-y-2 text-sm">
                    <li>
                      <strong className="text-white">8th-Grade Readability:</strong>{" "}
                      We enforce Flesch-Kincaid 8th-grade readability constraints
                      across our technical blog and Outreach portals to minimize
                      unnecessary jargon.
                    </li>
                    <li>
                      <strong className="text-white">
                        Predictable Navigation:
                      </strong>{" "}
                      Route transitions announce newly focused headings via
                      polite ARIA live regions (<code>aria-live=&quot;polite&quot;</code>) and maintain
                      uniform visual hierarchy.
                    </li>
                    <li>
                      <strong className="text-white">Input Guidance & Alerts:</strong>{" "}
                      Forms provide clear labels, error alerts (<code>role=&quot;alert&quot;</code>),
                      and actionable instructions for required fields.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Principle 4: Robust */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="bg-white/5 border border-white/10 p-8 hero-card h-full flex flex-col justify-between">
                <div>
                  <div className="bg-ares-red/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-red">
                    <Layers size={24} aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">
                    4. Robust
                  </h3>
                  <p className="text-marble leading-relaxed mb-4">
                    Content must be robust enough that it can be reliably
                    interpreted by a wide variety of user agents, including
                    assistive technologies.
                  </p>
                  <ul className="list-disc pl-5 text-marble/90 space-y-2 text-sm">
                    <li>
                      <strong className="text-white">Semantic HTML5:</strong>{" "}
                      Semantic landmark tags (<code>&lt;main&gt;</code>, <code>&lt;nav&gt;</code>,
                      <code>&lt;header&gt;</code>, <code>&lt;section&gt;</code>, <code>&lt;footer&gt;</code>) and
                      standard ARIA attributes ensure maximum parser compatibility.
                    </li>
                    <li>
                      <strong className="text-white">
                        Assistive Tech Support:
                      </strong>{" "}
                      Screen readers like NVDA (Windows) and VoiceOver
                      (macOS/iOS) are routinely tested against all core flows.
                    </li>
                    <li>
                      <strong className="text-white">
                        Zero Trust & Sanitization:
                      </strong>{" "}
                      Input sanitization and App Check verification preserve
                      markup integrity without interfering with accessibility APIs.
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Assistive Tech Testing Disclosures */}
        <section aria-labelledby="testing-disclosures-heading" className="mb-16">
          <div className="p-8 hero-card bg-white/5 border border-white/10">
            <h2
              id="testing-disclosures-heading"
              className="text-2xl font-bold mb-4 text-white flex items-center gap-3 font-heading uppercase"
            >
              <ShieldCheck className="text-ares-gold" size={24} aria-hidden="true" />
              Assistive Technology & Compatibility Testing
            </h2>
            <p className="text-marble leading-relaxed mb-4">
              Automated tests validate focus wrapping, top-layer Escape
              behavior, contrast tokens, and route announcements in continuous
              integration. We supplement automated testing with manual reviews
              across the following environments:
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm text-marble/90 font-mono mt-6">
              <div className="p-4 bg-obsidian/60 border border-white/10 rounded">
                <span className="block font-bold text-white mb-1">
                  Screen Readers
                </span>
                NVDA (Windows 11, Firefox/Chromium) & VoiceOver (macOS/iOS, Safari)
              </div>
              <div className="p-4 bg-obsidian/60 border border-white/10 rounded">
                <span className="block font-bold text-white mb-1">
                  Keyboard & Zoom
                </span>
                Keyboard-only flows (Tab, arrows, Escape) and 200%–400% viewport reflow
              </div>
              <div className="p-4 bg-obsidian/60 border border-white/10 rounded">
                <span className="block font-bold text-white mb-1">
                  Contrast Modes
                </span>
                High Contrast / Forced-Colors mode with color-independent visual indicators
              </div>
            </div>
          </div>
        </section>

        {/* Grievance & Feedback Mechanism */}
        <section aria-labelledby="feedback-heading" className="mb-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-8 hero-card border border-ares-cyan/30 bg-ares-cyan/5"
          >
            <div className="max-w-2xl">
              <h2
                id="feedback-heading"
                className="text-2xl font-bold mb-3 text-white flex items-center gap-3 font-heading uppercase"
              >
                <Mail className="text-ares-cyan" size={24} aria-hidden="true" />
                Feedback & Grievance Mechanism
              </h2>
              <p className="text-marble leading-relaxed mb-6">
                We welcome your feedback on the accessibility of the ARES Web
                Portal. If you experience an accessibility barrier, notice an
                unlabeled element, or need information in an alternative format,
                please notify our engineering team. Reported accessibility
                issues are treated as high-priority defects.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={`mailto:${siteConfig.contact.email}?subject=Accessibility%20Feedback%20-%20ARES%20Web%20Portal`}
                  aria-label={`Send an email to ${siteConfig.team.name} accessibility team at ${siteConfig.contact.email}`}
                  className="inline-flex items-center gap-2 bg-ares-red hover:bg-ares-red-light text-white px-5 py-3 ares-cut-sm font-bold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ares-gold focus-visible:outline-none"
                >
                  <Mail size={16} aria-hidden="true" />
                  Email Accessibility Team ({siteConfig.contact.email})
                </a>
                <a
                  href={`https://github.com/${siteConfig.urls.githubOrg}/ARESWEB/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Submit an accessibility issue on GitHub (opens in a new tab)"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 ares-cut-sm font-bold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
                >
                  <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Report Issue on GitHub
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Deterministic Static Metadata / Footer */}
        <div className="border-t border-white/10 pt-8 text-center text-marble text-sm">
          <p className="font-mono text-xs text-marble/70">
            Last updated: August 14, 2026 • Target Conformance: WCAG 2.2 Level AA
          </p>
          <p className="mt-2 text-xs text-marble/50">
            Maintained by {siteConfig.team.fullName} Engineering & Outreach.
          </p>
        </div>
      </div>
    </div>
  );
}
