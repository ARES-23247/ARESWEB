"use client";

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, GraduationCap, MapPin, Rocket, Search, Users, Wrench } from "lucide-react";

import SEO from "@/components/SEO";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Robotics in West Virginia", path: "/robotics-west-virginia" },
];

const EXTERNAL_LINKS = {
  firstStart: "https://www.firstinspires.org/robotics/ftc/start-a-team",
  firstFinder: "https://www.firstinspires.org/team-event-search",
  toa: "https://theorangealliance.org/teams/23247",
};

export default function RoboticsWestVirginiaPage() {
  return (
    <div className="flex flex-col w-full bg-obsidian">
      <SEO
        title="Robotics in West Virginia: Teams, Programs & How to Start | ARES 23247"
        description="A guide to robotics in West Virginia from ARES 23247 — FIRST programs available to West Virginia students, how to find a team near you, and how to start a new robotics team in WV."
      />
      <BreadcrumbSchema breadcrumbs={breadcrumbs} />

      {/* Hero */}
      <section className="relative py-24 bg-obsidian text-marble overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-ares-red/5" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-ares-red px-4 py-2 rounded-full mb-6 text-white">
            <MapPin aria-hidden="true" className="w-4 h-4" />
            <span className="font-bold text-sm uppercase tracking-wider">West Virginia</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-heading uppercase tracking-tighter">
            Robotics in <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-lg text-white font-bold inline-block mt-2">West Virginia</span>
          </h1>
          <p className="text-marble text-xl max-w-3xl mx-auto leading-relaxed">
            West Virginia students have more ways than ever to build, program, and compete with robots.
            ARES 23247, a FIRST® Tech Challenge team from Morgantown, put this guide together to help
            families across the Mountain State find their path into robotics.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <Link
              to="/join"
              className="bg-ares-red hover:bg-ares-bronze text-white px-8 py-4 font-bold uppercase tracking-widest transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 ares-cut-sm hover:-translate-y-0.5"
            >
              Join ARES 23247 <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/location-morgantown"
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest transition-all border border-white/20 flex items-center gap-2 ares-cut-sm"
            >
              <MapPin className="w-5 h-5" />
              Robotics in Morgantown
            </Link>
          </div>
        </div>
      </section>

      {/* FIRST programs */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-center font-heading uppercase">
            <em>FIRST</em>® Robotics <span className="text-ares-gold">Programs in West Virginia</span>
          </h2>
          <p className="text-marble/70 text-center max-w-3xl mx-auto mb-12">
            FIRST runs a progression of robotics programs for every school age. West Virginia teams
            participate in each level, and new teams form every season.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-cyan/50 transition-all">
              <div className="w-14 h-14 bg-ares-cyan/20 rounded-lg flex items-center justify-center mb-6">
                <Compass aria-hidden="true" className="w-7 h-7 text-ares-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3"><em>FIRST</em>® LEGO® League</h3>
              <p className="text-marble/70 leading-relaxed">
                An elementary and middle school program where teams explore a real-world theme, build a
                LEGO prototype, and present their ideas. A welcoming first step into competitive robotics.
              </p>
            </div>
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-red/50 transition-all">
              <div className="w-14 h-14 bg-ares-red rounded-lg flex items-center justify-center mb-6 text-white">
                <Wrench aria-hidden="true" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3"><em>FIRST</em>® Tech Challenge</h3>
              <p className="text-marble/70 leading-relaxed">
                Grades 7–12 teams design, build, and program metal robots from a reusable kit, competing
                in alliances at qualifiers and championship events. This is the program ARES 23247
                competes in.
              </p>
            </div>
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-gold/50 transition-all">
              <div className="w-14 h-14 bg-ares-gold/20 rounded-lg flex items-center justify-center mb-6">
                <Rocket aria-hidden="true" className="w-7 h-7 text-ares-gold" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3"><em>FIRST</em>® Robotics Competition</h3>
              <p className="text-marble/70 leading-relaxed">
                The high-school level where teams build large, industrial-scale robots for a new game
                each season. Many West Virginia graduates continue into college engineering and
                robotics programs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Find a team */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
                Find a Robotics Team <span className="text-ares-gold">Near You</span>
              </h2>
              <p className="text-marble/80 leading-relaxed mb-4">
                West Virginia robotics teams meet in schools, libraries, 4-H clubs, and community
                centers across the state. The official FIRST team and event search lists programs by
                location and age group, and The Orange Alliance tracks FIRST Tech Challenge team
                histories and results.
              </p>
              <p className="text-marble/80 leading-relaxed">
                Many teams — including ours — welcome students from surrounding communities, so check
                nearby towns even if your county has no team yet.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-8 space-y-4">
              <a
                href={EXTERNAL_LINKS.firstFinder}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
              >
                <Search aria-hidden="true" className="w-5 h-5 shrink-0" />
                Search FIRST teams and events (firstinspires.org)
              </a>
              <a
                href={EXTERNAL_LINKS.toa}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
              >
                <Search aria-hidden="true" className="w-5 h-5 shrink-0" />
                Browse FIRST Tech Challenge teams (The Orange Alliance)
              </a>
              <Link
                to="/join"
                className="flex items-center gap-3 text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
              >
                <Users aria-hidden="true" className="w-5 h-5 shrink-0" />
                Ask ARES 23247 about joining from your town
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Start a team */}
      <section className="py-20 bg-obsidian border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-14 h-14 bg-ares-red rounded-lg flex items-center justify-center mx-auto mb-6 text-white">
            <GraduationCap aria-hidden="true" className="w-7 h-7" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
            No Team in Your Area? <span className="text-ares-gold">Start One.</span>
          </h2>
          <p className="text-marble/80 text-lg max-w-3xl mx-auto mb-8 leading-relaxed">
            FIRST Tech Challenge teams start with one or two adults and a handful of curious students.
            FIRST publishes a step-by-step guide covering costs, kits, registration, and finding local
            events — and West Virginia teams are often willing to share what they have learned.
          </p>
          <a
            href={EXTERNAL_LINKS.firstStart}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-ares-red hover:bg-ares-bronze text-white px-8 py-4 font-bold uppercase tracking-widest transition-all shadow-lg shadow-ares-red/20 ares-cut-sm hover:-translate-y-0.5"
          >
            How to Start an FTC Team <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-obsidian border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
            Join a <span className="bg-ares-red px-2 text-white">West Virginia Robotics Team</span>
          </h2>
          <p className="text-marble/80 text-lg mb-10 max-w-2xl mx-auto">
            ARES 23247 trains in Morgantown and welcomes students in grades 7–12 plus mentors and
            volunteers from across North Central West Virginia.
          </p>
          <Link
            to="/join"
            className="inline-block bg-ares-red hover:bg-ares-bronze text-white px-10 py-5 font-bold uppercase tracking-widest text-lg transition-all shadow-lg shadow-ares-red/20 ares-cut-sm hover:-translate-y-0.5"
          >
            Apply to Join ARES
          </Link>
        </div>
      </section>
    </div>
  );
}
