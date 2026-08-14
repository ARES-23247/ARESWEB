"use client";

import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Ruler, Info, Sparkles } from "lucide-react";
import {
  SIZE_GUIDE_CHART,
  type MeasurementUnit,
} from "@/lib/storeCatalogData";

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SizeGuideModal({ isOpen, onClose }: SizeGuideModalProps) {
  const [unit, setUnit] = useState<MeasurementUnit>("inches");

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 ares-cut-lg border border-ares-gold/40 bg-obsidian p-6 md:p-8 text-marble shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto"
          aria-describedby="size-guide-description"
        >
          <div className="flex items-start justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ares-gold/10 text-ares-gold border border-ares-gold/30">
                <Ruler className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl md:text-2xl font-black uppercase tracking-tight text-white font-heading">
                  Merchandise Size Guide
                </Dialog.Title>
                <p id="size-guide-description" className="text-xs text-marble/70">
                  Standard sizing specifications for official ARES jerseys and fleece hoodies.
                </p>
              </div>
            </div>
            <Dialog.Close
              aria-label="Close size guide"
              className="rounded-lg p-2 text-marble/60 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {/* Unit Switcher */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ares-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Apparel Measurements</span>
            </div>
            <div
              role="group"
              aria-label="Measurement units"
              className="inline-flex rounded-md bg-white/5 p-1 border border-white/10 text-xs font-bold"
            >
              <button
                type="button"
                onClick={() => setUnit("inches")}
                className={`px-3 py-1 rounded transition-all ${
                  unit === "inches"
                    ? "bg-ares-red text-white shadow-md font-extrabold"
                    : "text-marble/70 hover:text-white"
                }`}
                aria-pressed={unit === "inches"}
              >
                Inches (in)
              </button>
              <button
                type="button"
                onClick={() => setUnit("cm")}
                className={`px-3 py-1 rounded transition-all ${
                  unit === "cm"
                    ? "bg-ares-red text-white shadow-md font-extrabold"
                    : "text-marble/70 hover:text-white"
                }`}
                aria-pressed={unit === "cm"}
              >
                Centimeters (cm)
              </button>
            </div>
          </div>

          {/* Sizing Table */}
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02]">
            <table className="w-full text-left text-xs" data-testid="size-guide-table">
              <caption className="sr-only">ARES Apparel Size Specifications</caption>
              <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-ares-gold">
                <tr>
                  <th scope="col" className="px-4 py-3">Size</th>
                  <th scope="col" className="px-4 py-3">Chest Width ({unit === "inches" ? "in" : "cm"})</th>
                  <th scope="col" className="px-4 py-3">Body Length ({unit === "inches" ? "in" : "cm"})</th>
                  <th scope="col" className="px-4 py-3">Sleeve Length ({unit === "inches" ? "in" : "cm"})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {SIZE_GUIDE_CHART.map((row) => (
                  <tr key={row.size} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-sans font-black text-white">{row.size}</td>
                    <td className="px-4 py-3 text-marble/90">
                      {unit === "inches" ? `${row.chestIn}"` : `${row.chestCm} cm`}
                    </td>
                    <td className="px-4 py-3 text-marble/90">
                      {unit === "inches" ? `${row.lengthIn}"` : `${row.lengthCm} cm`}
                    </td>
                    <td className="px-4 py-3 text-marble/90">
                      {unit === "inches" ? `${row.sleeveIn}"` : `${row.sleeveCm} cm`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Measuring Instructions */}
          <div className="mt-6 space-y-3 rounded-lg border border-ares-cyan/20 bg-ares-cyan/5 p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-ares-cyan">
              <Info className="h-4 w-4" aria-hidden="true" />
              <span>How to Measure Your Fit</span>
            </div>
            <ul className="grid gap-2 text-marble/80 md:grid-cols-3">
              <li>
                <strong className="text-white block font-semibold">1. Chest:</strong>
                Measure around the fullest part of the chest, keeping the tape level.
              </li>
              <li>
                <strong className="text-white block font-semibold">2. Body Length:</strong>
                Measure from the highest shoulder point down to the bottom waist hem.
              </li>
              <li>
                <strong className="text-white block font-semibold">3. Sleeve Length:</strong>
                Measure from the center back collar seam across the shoulder to the wrist.
              </li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase px-6 py-2.5 transition-all"
            >
              Got It
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
