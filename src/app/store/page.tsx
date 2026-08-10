"use client";

import { CreditCard, ShoppingBag } from "lucide-react";
import SEO from "@/components/SEO";

export default function StorePage() {
  return (
    <div className="min-h-screen w-full bg-obsidian py-8 text-marble">
      <SEO
        title="Team Store"
        description="Official ARES 23247 merchandise and team fundraising information."
      />

      <div className="mx-auto w-full max-w-5xl px-6 py-12 md:py-20">
        <header className="mb-12 border-b border-ares-bronze/30 pb-8">
          <p className="mb-4 text-sm font-bold uppercase tracking-widest text-ares-gold">
            Support Team 23247
          </p>
          <h1 className="mb-6 text-5xl font-black tracking-tighter text-white md:text-7xl">
            ARES{" "}
            <span className="ares-cut inline-block bg-ares-red px-6 py-2 font-bold text-white shadow-xl">
              Store
            </span>
          </h1>
          <p className="max-w-2xl text-lg font-medium text-marble/85">
            Official merchandise helps fund robot materials and community outreach.
          </p>
        </header>

        <section
          aria-labelledby="store-unavailable-title"
          className="hero-card border border-ares-gold/40 bg-ares-gold/10 p-8 text-center md:p-12"
        >
          <ShoppingBag aria-hidden="true" className="mx-auto mb-5 h-12 w-12 text-ares-gold" />
          <h2 id="store-unavailable-title" className="text-2xl font-black text-white md:text-3xl">
            Online ordering is not available yet
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-marble/85">
            We are connecting the catalog to a verified payment provider. Checkout will remain disabled
            until orders and payment confirmation can be completed securely.
          </p>
          <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded bg-ares-red px-5 py-3 font-bold text-white">
            <CreditCard aria-hidden="true" className="h-4 w-4" />
            Checkout unavailable
          </div>
        </section>
      </div>
    </div>
  );
}
