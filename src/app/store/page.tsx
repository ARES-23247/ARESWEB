"use client";

import { ArrowRight, CreditCard, HandHeart, Mail, ShoppingBag, Users } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { siteConfig } from "@/lib/site-config";

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

        <section aria-labelledby="support-title" className="mt-10">
          <div className="mb-6 max-w-2xl">
            <h2 id="support-title" className="text-2xl font-black text-white md:text-3xl">
              You can still support ARES
            </h2>
            <p className="mt-3 text-marble/85">
              These options use our current team channels. They do not collect payment on this site.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Link
              to="/sponsors#sponsor-form-section"
              className="hero-card group border border-ares-gold/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <HandHeart aria-hidden="true" className="mb-4 h-8 w-8 text-ares-gold" />
              <h3 className="text-lg font-black text-white">Sponsor the team</h3>
              <p className="mt-2 text-sm text-marble/80">
                Ask about a verified team sponsorship or in-kind donation.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-ares-gold">
                View sponsor options <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </Link>

            <Link
              to="/join"
              className="hero-card group border border-ares-cyan/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Users aria-hidden="true" className="mb-4 h-8 w-8 text-ares-cyan" />
              <h3 className="text-lg font-black text-white">Join ARES</h3>
              <p className="mt-2 text-sm text-marble/80">
                Students and adult volunteers can learn how to get involved.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-ares-cyan">
                Visit the join page <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </Link>

            <a
              href={`mailto:${siteConfig.contact.email}?subject=${encodeURIComponent("Supporting ARES 23247")}`}
              className="hero-card group border border-ares-bronze/40 bg-white/5 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Mail aria-hidden="true" className="mb-4 h-8 w-8 text-ares-gold" />
              <h3 className="text-lg font-black text-white">Contact the team</h3>
              <p className="mt-2 text-sm text-marble/80">
                Ask about events, outreach, partnerships, or other ways to help.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-ares-gold">
                Email ARES <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
