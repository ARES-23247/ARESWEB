import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { GreekMeander } from "./GreekMeander";
import { siteConfig } from "../site.config";
import { Mail, Users, Calendar, BookOpen, ShoppingBag, Globe, ShieldCheck, Heart } from "lucide-react";

export default function Footer() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <footer role="contentinfo" aria-label="Site Footer" className="w-full bg-obsidian text-marble border-t border-ares-bronze/20 pt-16 pb-8 overflow-hidden relative">
      {/* Meander accent for footer bottom */}
      <GreekMeander variant="thin" opacity="opacity-40" className="absolute bottom-0 left-0" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative z-10">
        {/* Brand & Mission */}
        <div className="lg:col-span-1">
          <div className="mb-6">
            <Link to="/" className="block text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1 w-fit">
              <h3 className="text-4xl font-bold text-white font-heading tracking-tight group-hover:text-ares-red transition-colors">ARES</h3>
              <p className="text-ares-bronze text-sm font-bold uppercase tracking-widest mt-1">Appalachian Robotics & Engineering Society</p>
            </Link>
            <p className="text-marble text-[10px] font-medium uppercase tracking-[0.2em] mt-2 px-1">
              <a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4">
                <em>FIRST</em>® Tech Challenge
              </a> 
              {" "}Team #23247
            </p>
          </div>
          <p className="text-marble/90 text-sm leading-relaxed max-w-sm border-l-2 border-ares-bronze/30 pl-6 mb-8 italic">
            Based in Morgantown, WV, we are engineering the next generation of Mountaineer innovators through the mission of <a href="https://www.firstinspires.org/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4 font-bold"><em>FIRST</em>®</a>.
          </p>
          
          <Link to="/bug-report" className="bg-white/5 hover:bg-ares-red text-marble hover:text-white px-4 py-2 ares-cut-sm transition-all font-bold uppercase tracking-widest text-[9px] inline-flex items-center gap-2 border border-white/10 group">
            <svg className="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Report Technical Issue
          </Link>
        </div>

        {/* Team & Calendar */}
        <div>
          <h4 className="text-white font-bold uppercase text-[10px] tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 flex items-center gap-2">
            <Users size={12} className="text-ares-cyan" /> Organization
          </h4>
          <ul className="flex flex-col gap-3 text-[11px] font-bold uppercase tracking-widest text-marble/80">
            <li><Link to="/about" className="hover:text-ares-gold transition-colors flex items-center gap-2">About Us</Link></li>
            <li><Link to="/seasons" className="hover:text-ares-gold transition-colors flex items-center gap-2">Competition History</Link></li>
            <li><Link to="/outreach" className="hover:text-ares-gold transition-colors flex items-center gap-2">Outreach & Impact</Link></li>
            <li><Link to="/events" className="hover:text-ares-red transition-colors flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
              <Calendar size={12} className="text-ares-red" /> Team Calendar
            </Link></li>
            <li><Link to="/join" className="hover:text-ares-cyan transition-colors flex items-center gap-2">Join the Team</Link></li>
          </ul>
        </div>

        {/* Resources & Content */}
        <div>
          <h4 className="text-white font-bold uppercase text-[10px] tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 flex items-center gap-2">
            <BookOpen size={12} className="text-ares-gold" /> Resources
          </h4>
          <ul className="flex flex-col gap-3 text-[11px] font-bold uppercase tracking-widest text-marble/80">
            <li><Link to="/blog" className="hover:text-ares-gold transition-colors flex items-center gap-2">Team Blog</Link></li>
            <li><Link to="/academy" className="hover:text-ares-gold transition-colors flex items-center gap-2">ARES Academy</Link></li>
            <li><Link to="/docs" className="hover:opacity-80 transition-colors flex items-center gap-2 group">
              <span className="flex items-center shadow-lg ares-cut-sm overflow-hidden border border-white/10">
                <span className="bg-ares-red px-2 py-0.5 text-[9px] font-heading font-black uppercase text-white tracking-wider">ARES</span>
                <span className="bg-white/10 text-white font-heading font-bold px-2 py-0.5 text-[9px] uppercase tracking-widest group-hover:bg-white/20 transition-colors">Lib</span>
              </span>
            </Link></li>
            <li><a href="https://www.printables.com/@ARESFTC_3784306" target="_blank" rel="noopener noreferrer" className="hover:text-ares-gold transition-colors flex items-center gap-2">3D Models Archive</a></li>
            <li><a href={siteConfig.urls.onshape} target="_blank" rel="noopener noreferrer" className="hover:text-ares-gold transition-colors flex items-center gap-2">CAD Workspace</a></li>
            <li><Link to="/store" className="hover:text-ares-gold transition-colors flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
              <ShoppingBag size={12} className="text-ares-gold" /> Official Store
            </Link></li>
          </ul>
        </div>

        {/* Social Media / Contact */}
        <div>
          <h4 className="text-white font-bold uppercase text-[10px] tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 flex items-center gap-2">
            <Globe size={12} className="text-ares-cyan" /> Social Media
          </h4>
          <div className="grid grid-cols-5 gap-2 mb-8">
            <a href="https://instagram.com/ares23247" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-ares-red transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl font-bold" aria-label="Instagram">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://www.youtube.com/@ARESFTC" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-ares-red transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl font-bold" aria-label="YouTube">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.498 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.5 12 20.5 12 20.5s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
            <a href="https://www.facebook.com/ARES23247" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-social-facebook transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="Facebook">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href={`https://tiktok.com/@${siteConfig.urls.tiktok}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-social-tiktok transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="TikTok">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61.15 3.91.02 0 1.5.46 2.93 1.04 4.19.62 1.27 1.55 2.39 2.73 3.16v3.55c-1.73-.04-3.4-.6-4.82-1.54v6.83a6.76 6.76 0 0 1-2.04 4.83 6.98 6.98 0 0 1-4.93 2 6.76 6.76 0 0 1-4.79-1.97A6.6 6.6 0 0 1 1.61 17a6.83 6.83 0 0 1 4.62-6.4v3.56a3.42 3.42 0 0 0-1.37 2.72 3.39 3.39 0 0 0 1.02 2.44 3.5 3.5 0 0 0 2.48 1 3.49 3.49 0 0 0 2.44-1.05c.64-.66 1-1.55.98-2.47V.02h2.73z"/></svg>
            </a>
            <a href={`https://github.com/${siteConfig.urls.githubOrg}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-social-github transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="GitHub Organization">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a href={`https://twitter.com/${siteConfig.urls.twitter}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-black transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="X (Twitter)">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.79L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-10.378L1.326 1.153h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
            </a>
            <a href={`https://www.linkedin.com/${siteConfig.urls.linkedin}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-social-linkedin transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="LinkedIn">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .773 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .773 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://aresfirst.zulipchat.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-ares-cyan transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="Zulip Team Chat">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M22.767 3.589c0 1.209-.543 2.283-1.37 2.934l-8.034 7.174c-.149.128-.343-.078-.235-.25l2.946-5.9c.083-.165-.024-.368-.194-.368H4.452c-1.77 0-3.219-1.615-3.219-3.59C1.233 1.616 2.682 0 4.452 0h15.096c1.77-.001 3.219 1.614 3.219 3.589zM4.452 24h15.096c1.77 0 3.219-1.616 3.219-3.59 0-1.974-1.449-3.59-3.219-3.59H8.12c-.17 0-.277-.202-.194-.367l2.946-5.9c.108-.172-.086-.378-.235-.25l-8.033 7.173c-.828.65-1.37 1.725-1.37 2.934 0 1.974 1.448 3.59 3.218 3.59z"/></svg>
            </a>
            <a href={`https://bsky.app/profile/${siteConfig.urls.bluesky}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-social-bluesky transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="Bluesky">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 600 530"><path d="m135.72 44.03c66.496 0 120.38 53.888 120.38 120.38 0 33.661-13.873 64.091-36.199 85.867l156.37 225.96H175.55l-54.757-95.419c-35.395 34.012-83.334 54.905-136.07 54.905v-76.919c64.042 0 116.07-52.03 116.07-116.07 0-64.042-52.03-116.07-116.07-116.07V44.03h135.72zM464.28 485.96c-66.496 0-120.38-53.888-120.38-120.38 0-33.661 13.873-64.091 36.199-85.867L223.73 53.748h200.72l54.757 95.419c35.395-34.012 83.334-54.905 136.07-54.905v76.919c-64.042 0-116.07 52.03-116.07 116.07 0 64.042 52.03 116.07 116.07 116.07v76.636H464.28z"/></svg>
            </a>
            <a href={`mailto:${siteConfig.contact.email}`} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-ares-gold transition-all hover:-translate-y-1 text-white border border-white/5 shadow-xl" aria-label="Email Us">
              <Mail className="w-5 h-5" />
            </a>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-white font-bold text-[10px] uppercase tracking-widest mb-1">Direct Contact</p>
              <a href={`mailto:${siteConfig.contact.email}`} className="text-marble/60 hover:text-ares-red text-xs transition-colors block tracking-wider">
                {siteConfig.contact.email}
              </a>
            </div>
            <div>
              <p className="text-white font-bold text-[10px] uppercase tracking-widest mb-1">Location</p>
              <p className="text-marble/60 text-xs tracking-wider">
                Morgantown, West Virginia 26501
              </p>
              <p className="text-marble/40 text-[9px] mt-1">
                Serving North Central West Virginia
              </p>
            </div>
            <div className="pt-4 flex items-center gap-3">
              <ShieldCheck size={24} className="text-ares-cyan opacity-40" />
              <p className="text-[9px] text-marble/50 leading-tight uppercase font-medium">
                Official ARES Portal. All student data is protected under FIRST YPP.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-white/10 flex flex-col xl:flex-row justify-between items-center gap-10">
        <div className="flex flex-col items-center xl:items-start gap-2">
          <p className="text-marble text-[10px] font-bold uppercase tracking-[0.25em]">
            <span className="opacity-80">© {mounted ? new Date().getFullYear() : "2026"} </span>
            <span className="bg-ares-red text-white px-1.5 py-0.5 rounded-sm font-black mx-1 inline-block shadow-sm">ARES</span> 
            <span className="opacity-80">23247. All Rights Reserved.</span>
          </p>
          <p className="text-marble/60 text-[8px] uppercase tracking-widest">
            Made with <span className="text-white">♥</span> in Morgantown, West Virginia
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[9px] font-bold uppercase tracking-[0.2em] text-marble">
          <Link to="/accessibility" className="hover:text-ares-red transition-colors flex items-center gap-2 group">
            <div className="w-5 h-5 rounded-full border border-ares-red/30 flex items-center justify-center group-hover:border-ares-red transition-colors bg-white/5">
              <svg className="w-2.5 h-2.5 text-ares-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            Accessibility
          </Link>

          <Link to="/privacy" className="hover:text-ares-red transition-colors flex items-center gap-2">
            <ShieldCheck size={12} className="text-ares-cyan" /> Privacy
          </Link>
          
          <div className="h-4 w-px bg-white/10 hidden md:block"></div>

          <Link to="/tech-stack" className="hover:text-ares-gold transition-colors mr-2">Tech Stack</Link>
          <Link 
            to="/sponsors" 
            className="bg-ares-red hover:bg-red-700 text-white px-4 py-2 font-black tracking-widest transition-all shadow-lg shadow-ares-red/20 flex items-center gap-2 ares-cut-sm hover:-translate-y-0.5 mx-2"
          >
            <Heart size={12} className="fill-current" />
            SUPPORT ARES
          </Link>
          
          <div className="flex gap-4 items-center px-2">
            <a href="https://wave.webaim.org/" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 transition-opacity" title="Validated by WAVE">
              <img src="https://wave.webaim.org/img/wavelogo.svg" alt="WAVE" className="h-3 grayscale hover:grayscale-0 transition-all" />
            </a>
            <span className="text-[7px] border border-white/30 text-marble/80 px-1 rounded">PA11Y CI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

