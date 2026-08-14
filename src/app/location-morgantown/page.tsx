"use client";

import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  MapPin,
  Users,
  Calendar,
  Trophy,
  GraduationCap,
  ExternalLink,
  Mail,
  Building2,
  Wrench,
  Sparkles,
  Compass,
  Navigation,
  CheckCircle2,
} from "lucide-react";

import SEO from "@/components/SEO";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { siteConfig } from "@/lib/site-config";
import { MOCK_LOCATIONS } from "@/utils/constants";

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Morgantown, West Virginia", path: "/location-morgantown" },
];

export default function LocationMorgantownPage() {
  return (
    <div className="flex flex-col w-full bg-obsidian text-marble">
      <SEO
        title="Robotics & STEM Hub in Morgantown, West Virginia | ARES 23247"
        description="ARES 23247 is a premier FIRST® Tech Challenge robotics team and STEM education hub based in Morgantown, West Virginia. Explore our laboratory facilities, county outreach footprint, and join us."
      />
      <BreadcrumbSchema breadcrumbs={breadcrumbs} />

      {/* Hero Section */}
      <section className="relative py-24 bg-obsidian text-marble overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="absolute inset-0 bg-ares-red/5" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-ares-red px-4 py-2 rounded-full mb-6 text-white shadow-md">
            <MapPin aria-hidden="true" className="w-4 h-4" />
            <span className="font-bold text-sm uppercase tracking-wider">
              Morgantown, West Virginia • Regional STEM Hub
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-heading uppercase tracking-tighter">
            Robotics in{" "}
            <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-lg text-white font-bold inline-block mt-2">
              Morgantown
            </span>
          </h1>
          <p className="text-marble text-xl max-w-3xl mx-auto leading-relaxed">
            ARES 23247 is North Central West Virginia\x27s premier <em>FIRST</em>® Tech Challenge robotics team and STEM innovation hub. We empower middle and high school students through world-class engineering, rapid prototyping, and hands-on mentorship.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <Link
              to="/join"
              className="bg-ares-red hover:bg-ares-bronze text-white px-8 py-4 font-bold uppercase tracking-widest transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 ares-cut-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Join Our Team <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/calendar"
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest transition-all border border-white/20 flex items-center gap-2 ares-cut-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              View Team Calendar <Calendar className="w-5 h-5" />
            </Link>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="bg-white/5 hover:bg-white/10 text-ares-gold px-8 py-4 font-bold uppercase tracking-widest transition-all border border-ares-gold/30 flex items-center gap-2 ares-cut-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Contact Hub <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Hub Highlights Stats */}
      <section className="py-12 bg-black/40 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <span className="block text-3xl md:text-4xl font-black text-ares-gold font-heading">3</span>
              <span className="text-xs uppercase font-bold text-marble/70 tracking-wider">Morgantown Lab Spaces</span>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <span className="block text-3xl md:text-4xl font-black text-white font-heading">Grades 7–12</span>
              <span className="text-xs uppercase font-bold text-marble/70 tracking-wider">Student Eligibility</span>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <span className="block text-3xl md:text-4xl font-black text-ares-cyan font-heading">2+ Counties</span>
              <span className="text-xs uppercase font-bold text-marble/70 tracking-wider">Monongalia &amp; Harrison</span>
            </div>
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <span className="block text-3xl md:text-4xl font-black text-ares-red font-heading">100% Free</span>
              <span className="text-xs uppercase font-bold text-marble/70 tracking-wider">No Cost to Participate</span>
            </div>
          </div>
        </div>
      </section>

      {/* Facilities & Laboratory Addresses Section */}
      <section id="facilities" className="py-20 bg-obsidian border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-ares-gold uppercase tracking-widest text-xs font-bold font-heading mb-2">
              <Building2 className="w-4 h-4" /> STEM Facilities &amp; Workshops
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white font-heading uppercase tracking-tight">
              Morgantown <span className="text-ares-gold">Laboratories &amp; Venues</span>
            </h2>
            <p className="text-marble/80 text-base max-w-2xl mx-auto mt-4">
              Our team operates out of dedicated engineering laboratories, rapid fabrication shops, and public exhibition venues in Morgantown, West Virginia.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {MOCK_LOCATIONS.map((loc) => {
              const icon =
                loc.id === "mars-building" ? (
                  <Building2 className="w-6 h-6 text-ares-gold" />
                ) : loc.id === "ares-shop" ? (
                  <Wrench className="w-6 h-6 text-ares-cyan" />
                ) : (
                  <Sparkles className="w-6 h-6 text-ares-red" />
                );

              const badgeText =
                loc.id === "mars-building"
                  ? "Primary Lab & Arena"
                  : loc.id === "ares-shop"
                  ? "Machining & Prototyping"
                  : "Public Outreach Venue";

              return (
                <div
                  key={loc.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col justify-between hover:border-ares-gold/50 transition-all group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center">
                        {icon}
                      </div>
                      <span className="px-2.5 py-1 bg-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded border border-white/10">
                        {badgeText}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 font-heading group-hover:text-ares-gold transition-colors">
                      {loc.name}
                    </h3>
                    <address className="not-italic text-sm text-ares-gold font-medium mb-3 flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{loc.address}</span>
                    </address>
                    <p className="text-sm text-marble/70 leading-relaxed mb-6">
                      {loc.description}
                    </p>
                  </div>

                  {loc.gmapsUrl && (
                    <div className="pt-4 border-t border-white/10">
                      <a
                        href={loc.gmapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Get directions to ${loc.name} on Google Maps`}
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white hover:text-ares-gold transition-colors bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-lg border border-white/10 w-full justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Google Maps Directions
                        <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-70" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-12 bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-white font-heading uppercase flex items-center gap-2">
                <Compass className="w-5 h-5 text-ares-cyan" /> Laboratory Access &amp; Visiting Guidelines
              </h4>
              <p className="text-sm text-marble/75 max-w-2xl leading-relaxed">
                All visitor sessions, parent tours, and new student trial builds are coordinated under <em>FIRST</em>® Youth Protection Program (YPP) guidelines. Scheduled weekend workshops require check-in upon arrival.
              </p>
            </div>
            <Link
              to="/join"
              className="shrink-0 bg-ares-red hover:bg-ares-bronze text-white px-6 py-3 font-bold uppercase tracking-wider text-xs rounded transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Schedule Lab Visit
            </Link>
          </div>
        </div>
      </section>

      {/* Regional Outreach Footprint: Monongalia & Harrison Counties */}
      <section className="py-20 bg-black/30 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-ares-cyan uppercase tracking-widest text-xs font-bold font-heading mb-2">
              <Compass className="w-4 h-4" /> Regional Impact Footprint
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white font-heading uppercase tracking-tight">
              Monongalia &amp; <span className="text-ares-cyan">Harrison Counties</span> Outreach
            </h2>
            <p className="text-marble/80 text-base max-w-2xl mx-auto mt-4">
              While rooted in Morgantown, ARES 23247 extends robotics education, scrimmage hosting, and STEM mentorship across North Central West Virginia.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Monongalia County Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-ares-red/40 transition-all">
              <div className="inline-flex items-center gap-2 bg-ares-red/20 text-ares-red border border-ares-red/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                <MapPin className="w-3.5 h-3.5" /> Monongalia County (Home Base)
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">
                Monongalia County STEM Footprint
              </h3>
              <p className="text-sm text-marble/80 leading-relaxed mb-6">
                Serving students and families across <strong>Morgantown, Cheat Lake, Westover, Star City, Brookhaven, and Granville</strong>.
              </p>
              <ul className="space-y-3 text-sm text-marble/80">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-gold shrink-0 mt-0.5" />
                  <span><strong>Weekly Build Workshops:</strong> High-density technical training in CAD, Java/Kotlin, and CNC machining.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-gold shrink-0 mt-0.5" />
                  <span><strong>Public Library STEM Demos:</strong> Hands-on robotics exhibits at Morgantown Public Library and community centers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-gold shrink-0 mt-0.5" />
                  <span><strong>School Robotics Mentoring:</strong> Mentoring local middle school FLL (FIRST LEGO League) teams and science fair participants.</span>
                </li>
              </ul>
            </div>

            {/* Harrison County Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-ares-cyan/40 transition-all">
              <div className="inline-flex items-center gap-2 bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                <MapPin className="w-3.5 h-3.5" /> Harrison County Outreach
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">
                Harrison County STEM Footprint
              </h3>
              <p className="text-sm text-marble/80 leading-relaxed mb-6">
                Collaborating with schools and youth groups across <strong>Clarksburg, Bridgeport, Shinnston, Salem, and Stonewood</strong>.
              </p>
              <ul className="space-y-3 text-sm text-marble/80">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-cyan shrink-0 mt-0.5" />
                  <span><strong>Inter-County Scrimmages:</strong> Hosting practice tournaments and robot testing sessions for Harrison County teams.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-cyan shrink-0 mt-0.5" />
                  <span><strong>Regional Kickoff Clinics:</strong> Sharing game strategy, drivetrain CAD archives, and telemetry software tutorials.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-ares-cyan shrink-0 mt-0.5" />
                  <span><strong>Cross-County Commuter Support:</strong> Flexible weekend scheduling and carpool coordination for Harrison County students.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Surrounding Counties Note */}
          <div className="mt-8 bg-black/40 border border-white/10 rounded-xl p-6 text-center">
            <p className="text-sm text-marble/80 max-w-3xl mx-auto">
              <strong className="text-white">Also welcoming commuters:</strong> Students from Marion, Preston, and Taylor counties as well as southwestern Pennsylvania regularly commute to our Morgantown facilities.
            </p>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-20 bg-obsidian border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center font-heading uppercase">
            Robotics Programs in <span className="text-ares-gold">Morgantown</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white/5 p-8 border border-white/10 hover:border-ares-red/50 transition-all rounded-xl">
              <div className="w-14 h-14 bg-ares-red rounded-lg flex items-center justify-center mb-6 text-white">
                <Trophy aria-hidden="true" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3"><em>FIRST</em>® Tech Challenge</h3>
              <p className="text-marble/70 leading-relaxed text-sm">
                Compete in the world\x27s premier middle and high school robotics competition. Design, build, and program robots to compete in tournaments throughout West Virginia and beyond.
              </p>
            </div>
            <div className="bg-white/5 p-8 border border-white/10 hover:border-ares-gold/50 transition-all rounded-xl">
              <div className="w-14 h-14 bg-ares-gold/20 rounded-lg flex items-center justify-center mb-6">
                <GraduationCap className="w-7 h-7 text-ares-gold" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">STEM Education</h3>
              <p className="text-marble/70 leading-relaxed text-sm">
                Learn real-world engineering skills including CAD design, 3D printing, programming, electronics, and project management. No prior experience needed.
              </p>
            </div>
            <div className="bg-white/5 p-8 border border-white/10 hover:border-ares-cyan/50 transition-all rounded-xl">
              <div className="w-14 h-14 bg-ares-cyan/20 rounded-lg flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-ares-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Community Outreach</h3>
              <p className="text-marble/70 leading-relaxed text-sm">
                Share your passion for robotics with the Morgantown community. Demonstrate robots at local events, mentor younger students, and inspire the next generation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Can Join Section */}
      <section className="py-20 bg-black/30 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center font-heading uppercase">
            Who Can <span className="bg-ares-red px-2 text-white">Join?</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/5 p-8 border-l-4 border-ares-red rounded-r-xl">
              <h3 className="text-2xl font-bold text-white mb-4">Students (Grades 7–12)</h3>
              <ul className="space-y-3 text-marble/80 text-sm">
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>No prior robotics or coding experience required</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Learn programming (Java/Kotlin), mechanical CAD, and electronics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Compete in regional, statewide, and championship tournaments</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>100% free participation funded through community sponsorships</span>
                </li>
              </ul>
            </div>
            <div className="bg-white/5 p-8 border-l-4 border-ares-gold rounded-r-xl">
              <h3 className="text-2xl font-bold text-white mb-4">Mentors &amp; Volunteers</h3>
              <ul className="space-y-3 text-marble/80 text-sm">
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Share your engineering, coding, or business expertise</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Flexible time commitment (weekend and evening workshop slots)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Software, mechanical, electrical, strategy, and media roles</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-0.5">✓</span>
                  <span>Make a direct impact on West Virginia youth STEM education</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Direct Contact & Visit Channels */}
      <section className="py-20 bg-obsidian border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white font-heading uppercase">
              Get in Touch with Our <span className="text-ares-gold">Morgantown Team</span>
            </h2>
            <p className="text-marble/80 text-base max-w-2xl mx-auto mt-3">
              Have questions about laboratory visits, student enrollment, sponsorship, or demo requests?
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-ares-gold/40 transition-all">
              <Mail className="w-8 h-8 text-ares-gold mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white font-heading uppercase mb-2">Direct Email</h3>
              <p className="text-xs text-marble/70 mb-4">Contact our coaches, mentors, and student leaders directly.</p>
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-ares-gold text-sm font-bold underline underline-offset-4 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {siteConfig.contact.email}
              </a>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-ares-red/40 transition-all">
              <Users className="w-8 h-8 text-ares-red mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white font-heading uppercase mb-2">Join Application</h3>
              <p className="text-xs text-marble/70 mb-4">Ready to join our student roster or mentor team?</p>
              <Link
                to="/join"
                className="text-ares-red text-sm font-bold underline underline-offset-4 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Complete Join Form →
              </Link>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center hover:border-ares-cyan/40 transition-all">
              <Calendar className="w-8 h-8 text-ares-cyan mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white font-heading uppercase mb-2">Team Calendar</h3>
              <p className="text-xs text-marble/70 mb-4">View our upcoming workshop hours and tournament schedule.</p>
              <Link
                to="/calendar"
                className="text-ares-cyan text-sm font-bold underline underline-offset-4 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                View Calendar →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
            Ready to Start Your <span className="bg-ares-red px-2 text-white">Robotics Journey?</span>
          </h2>
          <p className="text-marble/80 text-lg mb-10 max-w-2xl mx-auto">
            Join ARES 23247 in Morgantown to build championship robots, learn modern engineering, and shape the future of West Virginia STEM.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/join"
              className="inline-block bg-ares-red hover:bg-ares-bronze text-white px-10 py-5 font-bold uppercase tracking-widest text-lg transition-all shadow-lg shadow-ares-red/20 ares-cut-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Apply to Join ARES
            </Link>
            <Link
              to="/outreach"
              className="inline-block bg-white/5 hover:bg-white/10 text-white px-8 py-5 font-bold uppercase tracking-widest text-lg transition-all border border-white/20 ares-cut-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Request STEM Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
