"use client";

import React from "react";
import { motion } from "framer-motion";

import SEO from "@/components/SEO";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-obsidian text-white selection:bg-ares-gold selection:text-obsidian pt-24 pb-20">
      <SEO 
        title="Accessibility & Web Standards" 
        description="How ARES 23247 reviews and improves website accessibility for students, families, and community visitors."
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
            <span className="text-marble font-mono text-sm tracking-widest uppercase">Digital Manifesto</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight uppercase font-heading">
            Accessibility <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">Statement</span>
          </h1>
          <p className="text-marble text-lg md:text-xl leading-relaxed">
            As part of our commitment to the <em>FIRST</em>® Robotics core values,
            ARES 23247 works to make our website and engineering resources usable
            by students, families, and community visitors with different access
            needs.
          </p>
        </motion.div>

        {/* Grid of standards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/5 border border-white/10 p-8 hero-card h-full">
              <div className="bg-ares-red/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-red">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Useful media descriptions</h2>
              <p className="text-marble leading-relaxed">
                Authors provide meaningful alternative text and captions for published media. We are improving upload guidance and review tools so descriptions stay useful, accurate, and respectful.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="bg-white/5 border border-white/10 p-8 hero-card h-full">
              <div className="bg-ares-gold/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-gold">
                <span className="font-bold" aria-hidden="true">AA</span>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">WCAG 2.2 AA, continuously reviewed</h2>
              <p className="text-marble leading-relaxed">
                We work toward WCAG 2.2 AA with keyboard review, screen-reader checks, automated tests, and accessible design tokens. We do not publish a single conformance score: accessibility here is ongoing, evidence-based work, and reported barriers are treated as high-priority defects.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-white/5 border border-white/10 p-8 hero-card h-full">
              <div className="bg-ares-cyan/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-cyan">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Student-friendly technical writing</h2>
              <p className="text-marble leading-relaxed">
                Academy lessons are checked against a grade 6–8 readability
                target and a maximum sentence length. Technical words are still
                used when students need them, with explanations and examples to
                make the ideas easier to follow.
              </p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="bg-white/5 border border-white/10 p-8 hero-card h-full">
              <div className="bg-ares-gold/10 w-12 h-12 ares-cut-sm flex items-center justify-center mb-6 text-ares-gold">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-white">Layered access controls</h2>
              <p className="text-marble leading-relaxed">
                Administrative requests require Google sign-in and a current team
                role checked by server-side authorization. Firebase App Check,
                Firestore and Storage rules, request limits, and monitoring add
                independent safeguards. These controls reduce risk, but no single
                control is described as a guarantee.
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center p-8 hero-card border border-dashed border-white/10"
        >
          <p className="text-white text-sm max-w-lg mx-auto">
            Automated tests cover keyboard interaction and core semantics, but they do not replace manual keyboard, zoom, and assistive-technology review. If you encounter an accessibility hurdle on the ARES Web Portal, please contact us on GitHub or through our mentors.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
