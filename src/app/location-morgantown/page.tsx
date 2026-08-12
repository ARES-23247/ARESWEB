"use client";

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Users, Calendar, Trophy, GraduationCap } from "lucide-react";

import SEO from "@/components/SEO";
import FAQSchema, { LOCAL_ROBOTICS_FAQS } from "@/components/FAQSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Morgantown, West Virginia", path: "/location-morgantown" }
];

export default function LocationMorgantownPage() {
  return (
    <div className="flex flex-col w-full bg-obsidian">
      <SEO
        title="Robotics in Morgantown, West Virginia | ARES 23247"
        description="Meet ARES 23247, a FIRST® Tech Challenge robotics team based in Morgantown, West Virginia. Learn about the team, events, and ways to join."
      />
      <FAQSchema faqs={LOCAL_ROBOTICS_FAQS} />
      <BreadcrumbSchema breadcrumbs={breadcrumbs} />

      {/* Hero Section */}
      <section className="relative py-24 bg-obsidian text-marble overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-ares-red/5" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-ares-red px-4 py-2 rounded-full mb-6 text-white">
            <MapPin aria-hidden="true" className="w-4 h-4" />
            <span className="font-bold text-sm uppercase tracking-wider">Morgantown, West Virginia</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-heading uppercase tracking-tighter">
            Robotics in <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-lg text-white font-bold inline-block mt-2">Morgantown</span>
          </h1>
          <p className="text-marble text-xl max-w-3xl mx-auto leading-relaxed">
            ARES 23247 helps students build robotics skills through teamwork, practice, and competition.
            We welcome curious learners and supportive mentors.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <Link
              to="/join"
              className="bg-ares-red hover:bg-ares-bronze text-white px-8 py-4 font-bold uppercase tracking-widest transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 ares-cut-sm hover:-translate-y-0.5"
            >
              Join Our Team <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/calendar"
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 font-bold uppercase tracking-widest transition-all border border-white/20 flex items-center gap-2 ares-cut-sm"
            >
              View Events <Calendar className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center font-heading uppercase">
            Robotics Programs in <span className="text-ares-gold">Morgantown</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-red/50 transition-all">
              <div className="w-14 h-14 bg-ares-red rounded-lg flex items-center justify-center mb-6 text-white">
                <Trophy aria-hidden="true" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3"><em>FIRST</em>® Tech Challenge</h3>
              <p className="text-marble/70 leading-relaxed">
                Compete in the world&apos;s premier middle and high school robotics competition. Design, build, and program robots to compete in tournaments throughout West Virginia and beyond.
              </p>
            </div>
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-gold/50 transition-all">
              <div className="w-14 h-14 bg-ares-gold/20 rounded-lg flex items-center justify-center mb-6">
                <GraduationCap className="w-7 h-7 text-ares-gold" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">STEM Education</h3>
              <p className="text-marble/70 leading-relaxed">
                Learn real-world engineering skills including CAD design, 3D printing, programming, electronics, and project management. No prior experience needed.
              </p>
            </div>
            <div className="bg-obsidian p-8 border border-white/10 hover:border-ares-cyan/50 transition-all">
              <div className="w-14 h-14 bg-ares-cyan/20 rounded-lg flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-ares-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Community Outreach</h3>
              <p className="text-marble/70 leading-relaxed">
                Share your passion for robotics with the Morgantown community. Demonstrate robots at local events, mentor younger students, and inspire the next generation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who Can Join Section */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center font-heading uppercase">
            Who Can <span className="bg-ares-red px-2 text-white">Join?</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/5 p-8 border-l-4 border-ares-red">
              <h3 className="text-2xl font-bold text-white mb-4">Students (Grades 7-12)</h3>
              <ul className="space-y-3 text-marble/80">
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>No prior robotics experience required</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Learn programming, mechanical design, and electronics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Compete in regional and statewide tournaments</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Build skills for college and future careers</span>
                </li>
              </ul>
            </div>
            <div className="bg-white/5 p-8 border-l-4 border-ares-gold">
              <h3 className="text-2xl font-bold text-white mb-4">Mentors & Volunteers</h3>
              <ul className="space-y-3 text-marble/80">
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Share your expertise with the next generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Flexible time commitment (evenings, weekends)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Engineering, programming, business, and marketing roles</span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="text-ares-gold mt-1">✓</span>
                  <span>Make a lasting impact in Morgantown&apos;s community</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-20 bg-obsidian">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-8 text-center font-heading uppercase">
            Serving <span className="text-ares-gold">North Central West Virginia</span>
          </h2>
          <p className="text-marble/80 text-lg text-center max-w-3xl mx-auto mb-12">
            ARES 23247 is based in Morgantown. Students and mentors from nearby communities may also apply.
            Contact the team to learn whether travel and meeting times will work for you.
          </p>
          <div className="mx-auto max-w-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="font-bold text-white">Not sure if you can take part?</p>
            <Link to="/join" className="mt-3 inline-block text-ares-gold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              Read the current join details and contact the team.
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-obsidian border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
            Ready to Start Your <span className="bg-ares-red px-2 text-white">Robotics Journey?</span>
          </h2>
          <p className="text-marble/80 text-lg mb-10 max-w-2xl mx-auto">
            Learn with ARES 23247 and help the team solve real engineering problems.
            Bring your curiosity, determination, and respect for others.
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
