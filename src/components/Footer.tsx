import { Link, useNavigate } from "react-router-dom";
import { GreekMeander } from "./GreekMeander";
import { siteConfig } from "../site.config";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer role="contentinfo" aria-label="Site Footer" className="w-full bg-obsidian text-marble border-t border-ares-bronze/20 pt-16 pb-8 overflow-hidden relative">
      {/* Meander accent for footer bottom */}
      <GreekMeander variant="thin" opacity="opacity-40" className="absolute bottom-0 left-0" />

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
        {/* Brand & Mission */}
        <div className="md:col-span-2">
          <button onClick={() => navigate("/")} className="block text-left mb-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <h3 className="text-4xl font-bold text-white font-heading tracking-tight group-hover:text-ares-red transition-colors">ARES</h3>
            <p className="text-ares-bronze text-sm font-bold uppercase tracking-widest mt-1">Appalachian Robotics & Engineering Society</p>
            <p className="text-marble/70 text-xs font-medium uppercase tracking-[0.2em]"><a href="https://www.firstinspires.org/robotics/ftc" target="_blank" rel="noopener noreferrer" className="hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4"><em>FIRST</em>® Tech Challenge</a> Team #23247</p>
          </button>
          <p className="text-marble/70 text-base leading-relaxed max-w-md border-l-2 border-ares-bronze/30 pl-6">
            We are proud members of the <a href="https://MARSFIRST.org" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:text-ares-red transition-colors italic">MARS Family</a>. 
            Based in Morgantown, WV, we are engineering the next generation of Mountaineer innovators through the mission of <a href="https://www.firstinspires.org/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-colors underline decoration-ares-red/30 underline-offset-4 font-bold"><em>FIRST</em>®</a>.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold uppercase text-xs tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 inline-block">Navigation</h4>
          <ul className="flex flex-col gap-3 text-sm font-bold uppercase tracking-widest text-marble/80">
            <li><Link to="/" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Home</Link></li>
            <li><Link to="/about" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Who We Are</Link></li>
            <li><Link to="/seasons" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Seasons</Link></li>
            <li><Link to="/outreach" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Outreach</Link></li>
            <li><Link to="/blog" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Team Blog</Link></li>
            <li><Link to="/docs" className="hover:opacity-80 transition-colors flex items-center gap-2 group"><span>{"//"}</span> <span className="flex items-center shadow-lg ares-cut-sm overflow-hidden"><span className="bg-ares-red px-2.5 py-0.5 text-[10px] font-heading font-bold uppercase text-white tracking-wider border-r border-white/10">ARES</span><span className="bg-white/10 text-white font-heading font-medium px-2.5 py-0.5 text-[10px] uppercase tracking-widest group-hover:bg-white/20 transition-colors">Lib</span></span></Link></li>
            <li><Link to="/join" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Join Us</Link></li>
            <li><Link to="/tech-stack" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Tech Stack</Link></li>
          </ul>
        </div>

        {/* Intelligence / Contact */}
        <div>
          <h4 className="text-white font-bold uppercase text-xs tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 inline-block">Connect</h4>
          <div className="flex flex-wrap gap-4 mb-8">
            <a href="https://instagram.com/ares23247" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-red transition-colors text-white" aria-label="Instagram">
              <i className="fab fa-instagram"></i>
            </a>
            <a href="https://bsky.app/profile/ares23247.bsky.social" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-[#0085ff] transition-colors text-white" aria-label="Bluesky">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 512 512"><path d="M111.8 62.2C170.2 105.9 233 194.7 256 242.4c23-47.6 85.8-136.4 144.2-180.2c42.1-31.6 110.3-56 110.3 21.8c0 15.5-8.9 130.5-14.1 149.2C478.2 298.9 416 314.3 353.1 304.9c47.2 32.2 53.6 81.9 5.4 108.8C315.6 437.4 256 376 256 376s-59.6 61.4-102.5 37.7c-48.2-26.9-41.8-76.6 5.4-108.8c-62.9 9.4-125.1-6-143.3-71.7C10.5 214.6 1.6 99.5 1.6 84C1.6 6.2 69.9 30.6 111.8 62.2z"/></svg>
            </a>
            <a href="https://www.youtube.com/@ARESFTC" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-red transition-colors text-white" aria-label="YouTube">
              <i className="fab fa-youtube"></i>
            </a>
            <a href={`mailto:${siteConfig.contact.email}`} aria-label={`Email ${siteConfig.team.fullName}`} className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-bronze transition-colors text-white">
              <i className="fas fa-envelope" aria-hidden="true"></i>
            </a>
          </div>
          <p className="text-marble/70 text-xs font-bold uppercase tracking-widest">ARES HQ</p>
          <a href={`mailto:${siteConfig.contact.email}`} className="text-marble/80 hover:text-ares-red text-sm font-bold transition-colors block mb-4">
            {siteConfig.contact.email}
          </a>
          <Link to="/bug-report" className="bg-ares-red text-white hover:bg-white hover:text-ares-red px-4 py-2 ares-cut-sm transition-all font-bold uppercase tracking-widest text-xs inline-flex items-center gap-2 shadow-lg shadow-ares-red/20 w-fit mt-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Report Bug
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-marble/10 flex flex-col lg:flex-row justify-between items-center gap-8">
        <p className="text-marble/80 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap">
          © {new Date().getFullYear()} <span className="bg-ares-red text-white px-1 rounded-sm">ARES</span> 23247. Proudly part of the <a href="https://MARSFIRST.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors underline decoration-ares-red/30">MARS Family</a>.
        </p>
        
        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-x-8 gap-y-4 text-[10px] font-bold uppercase tracking-[0.2em] text-marble/80">
          <Link to="/accessibility" className="hover:text-white transition-colors flex items-center gap-2 group whitespace-nowrap">
            <svg className="w-3.5 h-3.5 text-ares-red group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Accessibility
          </Link>
          
          <div className="flex gap-4 items-center border-l border-marble/10 pl-8 h-4">
            <a href="https://wave.webaim.org/" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 transition-opacity" title="Validated by WAVE Web Accessibility Evaluation Tool">
              <img src="https://wave.webaim.org/img/wavelogo.svg" alt="WAVE Logo" className="h-3.5" />
            </a>
            <a href="https://pa11y.org/" target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity flex items-center font-bold text-[9px] gap-1 text-white" title="pa11y CI Integrated">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/>
              </svg>
              <span>PA11Y</span>
            </a>
          </div>

          <div className="flex gap-8 items-center border-l border-marble/10 pl-8 h-4">
            <Link to="/privacy" className="hover:text-white transition-colors whitespace-nowrap">Privacy</Link>
            <Link to="/docs" className="hover:opacity-80 transition-colors flex items-center whitespace-nowrap shadow-sm ares-cut-sm overflow-hidden group">
              <span className="bg-ares-red px-2 py-0.5 text-[9px] font-heading font-bold uppercase text-white tracking-wider border-r border-white/10">ARES</span>
              <span className="bg-white/10 text-white font-heading font-medium px-2 py-0.5 text-[9px] uppercase tracking-widest group-hover:bg-white/20 transition-colors">Lib</span>
            </Link>
            <Link to="/sponsors" className="hover:text-white transition-colors whitespace-nowrap">Support Us</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
