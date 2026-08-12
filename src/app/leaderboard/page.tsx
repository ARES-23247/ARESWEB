"use client";

import { Award, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";

const RECOGNITION_PRINCIPLES = [
  {
    title: "Teamwork",
    description: "We celebrate members who help the whole team learn and improve.",
    icon: ShieldCheck,
  },
  {
    title: "Impact",
    description: "Outreach, mentoring, and service matter as much as robot results.",
    icon: Sparkles,
  },
  {
    title: "Growth",
    description: "Recognition should show effort, new skills, and steady progress.",
    icon: Award,
  },
] as const;

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-obsidian text-marble">
      <SEO
        title="Team Recognition"
        description="Learn how ARES 23247 plans to recognize teamwork, community impact, and growth without publishing unverified rankings."
      />

      <section className="relative flex min-h-[50vh] items-center overflow-hidden bg-obsidian py-28">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute left-0 top-0" />
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-ares-gold/30 bg-ares-gold/10">
            <Trophy aria-hidden="true" size={32} className="text-ares-gold" />
          </div>
          <p className="mb-4 font-heading text-[10px] font-black uppercase tracking-[0.4em] text-ares-gold">
            Recognition program
          </p>
          <h1 className="mb-6 font-heading text-4xl font-black uppercase tracking-tight text-white md:text-7xl">
            Team <span className="ares-cut-sm inline-block bg-ares-red px-4 py-1 pb-3 text-white shadow-xl sm:px-6">Recognition</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl border-t border-white/10 pt-6 text-base leading-relaxed text-marble/85 md:text-lg">
            ARES has not published an official member ranking. We will only show results after the team approves clear rules and verifies the data.
          </p>
        </div>
      </section>

      <section aria-labelledby="recognition-status" className="border-y border-white/5 bg-black/10 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="hero-card border border-ares-gold/30 bg-ares-gold/5 p-8 text-center md:p-12">
            <h2 id="recognition-status" className="font-heading text-2xl font-black uppercase text-white md:text-3xl">
              No standings are published
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-marble/80">
              We removed placeholder names, avatars, badge totals, and ranks. This page will stay unranked until every result comes from an approved source.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-marble/80">
              When the program launches, it will support <em>FIRST</em>® values and reward teamwork, inclusion, discovery, and service.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {RECOGNITION_PRINCIPLES.map(({ title, description, icon: Icon }) => (
              <article key={title} className="hero-card border border-white/10 bg-white/5 p-7 text-center">
                <Icon aria-hidden="true" className="mx-auto h-7 w-7 text-ares-gold" />
                <h2 className="mt-4 font-heading text-lg font-black uppercase text-white">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-marble/75">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
