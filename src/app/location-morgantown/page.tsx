"use client";

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Users, Calendar, Trophy, GraduationCap } from "lucide-react";

import SEO from "@/components/SEO";
import FAQSchema, { LOCAL_ROBOTICS_FAQS } from "@/components/FAQSchema";
import ReviewSchema, { ARES_REVIEWS } from "@/components/ReviewSchema";
import EducationalCredentialSchema, { ARES_CREDENTIALS } from "@/components/EducationalCredentialSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Locations", path: "/locations" },
  { name: "Morgantown, West Virginia", path: "/locations/morgantown" }
];

export default function LocationMorgantownPage() {
  return (
    <div className="flex flex-col w-full bg-obsidian">
      <SEO
        title="Robotics in Morgantown, West Virginia | ARES 23247"
        description="Join ARES 23247, Morgantown's premier FIRST® Tech Challenge robotics team. We offer youth robotics programs, STEM education, and competition opportunities for students in Morgantown and throughout West Virginia."
      />
      <FAQSchema faqs={LOCAL_ROBOTICS_FAQS} />
      <ReviewSchema reviews={ARES_REVIEWS} />
      <EducationalCredentialSchema credentials={ARES_CREDENTIALS} />
      <BreadcrumbSchema breadcrumbs={breadcrumbs} />

      {/* Hero Section */}
      <section className="relative py-24 bg-obsidian text-marble overflow-hidden">
        <div className="absolute inset-0 bg-ares-red/5 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.15)_0,rgba(0,0,0,0)_70%)]" />
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-ares-red/20 border border-ares-red/30 px-4 py-2 rounded-full mb-6">
            <MapPin className="w-4 h-4 text-ares-red" />
            <span className="text-ares-red font-bold text-sm uppercase tracking-wider">Morgantown, West Virginia</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 font-heading uppercase tracking-tighter">
            Robotics in <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">Morgantown</span>
          </h1>
          <p className="text-marble text-xl max-w-3xl mx-auto leading-relaxed">
            ARES 23247 brings world-class robotics education and competition to North Central West Virginia.
            Join our team of innovators, engineers, and future leaders.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <Link
              to="/join"
              className="bg-ares-red hover:bg-red-700 text-white px-8 py-4 font-bold uppercase tracking-widest transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 ares-cut-sm hover:-translate-y-0.5"
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
              <div className="w-14 h-14 bg-ares-red/20 rounded-lg flex items-center justify-center mb-6">
                <Trophy className="w-7 h-7 text-ares-red" />
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
            Who Can <span className="text-ares-red">Join?</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/5 p-8 border-l-4 border-ares-red">
              <h3 className="text-2xl font-bold text-white mb-4">Students (Grades 7-12)</h3>
              <ul className="space-y-3 text-marble/80">
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>No prior robotics experience required</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Learn programming, mechanical design, and electronics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Compete in regional and statewide tournaments</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Build skills for college and future careers</span>
                </li>
              </ul>
            </div>
            <div className="bg-white/5 p-8 border-l-4 border-ares-gold">
              <h3 className="text-2xl font-bold text-white mb-4">Mentors & Volunteers</h3>
              <ul className="space-y-3 text-marble/80">
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Share your expertise with the next generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Flexible time commitment (evenings, weekends)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
                  <span>Engineering, programming, business, and marketing roles</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-ares-gold mt-1">✓</span>
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
            While based in Morgantown, ARES 23247 welcomes students from throughout the region.
            Our team currently includes members from:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              "Morgantown",
              "Westover",
              "Star City",
              "Fairmont",
              "Cheat Lake",
              "Granville",
              "Brookhaven",
              "Sabraton"
            ].map((city) => (
              <div key={city} className="bg-white/5 py-4 px-6 border border-white/10">
                <span className="text-white font-semibold">{city}</span>
              </div>
            ))}
          </div>
          <p className="text-marble/60 text-center mt-8">
            Don&apos;t see your area listed? Contact us — we&apos;re always looking to expand our reach!
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-obsidian border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 font-heading uppercase">
            Ready to Start Your <span className="text-ares-red">Robotics Journey?</span>
          </h2>
          <p className="text-marble/80 text-lg mb-10 max-w-2xl mx-auto">
            Join ARES 23247 and become part of Morgantown&apos;s most exciting robotics team.
            No experience necessary — just bring your curiosity and determination.
          </p>
          <Link
            to="/join"
            className="inline-block bg-ares-red hover:bg-red-700 text-white px-10 py-5 font-bold uppercase tracking-widest text-lg transition-all shadow-lg shadow-ares-red/20 ares-cut-sm hover:-translate-y-0.5"
          >
            Apply to Join ARES
          </Link>
        </div>
      </section>
    </div>
  );
}
