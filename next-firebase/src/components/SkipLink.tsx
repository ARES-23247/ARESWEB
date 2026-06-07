/**
 * SkipLink - Accessibility component for keyboard navigation
 * Allows users to skip to main content, bypassing navigation
 *
 * WCAG 2.1 Level A Success Criterion 2.4.1: Bypass Blocks
 */
import React from "react";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] bg-ares-red text-white px-6 py-3 ares-cut-sm font-bold shadow-2xl border border-white/20 transition-all rounded"
    >
      Skip to main content
    </a>
  );
}

export default SkipLink;
