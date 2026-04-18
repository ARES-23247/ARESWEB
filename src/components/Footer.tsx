import { Link, useNavigate } from "react-router-dom";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-obsidian text-marble border-t border-ares-bronze/20 pt-16 pb-8 overflow-hidden relative">
      {/* Meander accent for footer bottom */}
      <div className="absolute bottom-0 left-0 w-full h-1 meander-border opacity-30"></div>

      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
        {/* Brand & Mission */}
        <div className="md:col-span-2">
          <button onClick={() => navigate("/")} className="block text-left mb-6 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1">
            <h3 className="text-4xl font-bold text-white font-heading tracking-tight group-hover:text-ares-red transition-colors">ARES</h3>
            <p className="text-ares-bronze text-sm font-bold uppercase tracking-widest mt-1">Appalachian Robotics & Engineering Society</p>
            <p className="text-marble/70 text-xs font-medium uppercase tracking-[0.2em]">FIRST Tech Challenge Team #23247</p>
          </button>
          <p className="text-marble/70 text-base leading-relaxed max-w-md border-l-2 border-ares-bronze/30 pl-6">
            We are the official <span className="text-white font-bold italic">sibling team</span> to <strong>MARS 2614</strong>. 
            Based in Morgantown, WV, we are engineering the next generation of Mountaineer innovators through the mission of <em>FIRST</em>.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold uppercase text-xs tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 inline-block">The Vault</h4>
          <ul className="flex flex-col gap-3 text-sm font-bold uppercase tracking-widest text-marble/60">
            <li><Link to="/" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Home</Link></li>
            <li><Link to="/about" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Who We Are</Link></li>
            <li><Link to="/seasons" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Seasons</Link></li>
            <li><Link to="/outreach" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Outreach</Link></li>
            <li><Link to="/blog" className="hover:text-ares-red transition-colors flex items-center gap-2"><span>{"//"}</span> Team Blog</Link></li>
          </ul>
        </div>

        {/* Intelligence / Contact */}
        <div>
          <h4 className="text-white font-bold uppercase text-xs tracking-[0.3em] mb-6 font-heading border-b border-ares-bronze/20 pb-2 inline-block">Intelligence</h4>
          <div className="flex flex-wrap gap-4 mb-8">
            <a href="https://instagram.com/ares23247" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-red transition-colors text-white" aria-label="Instagram">
              <i className="fab fa-instagram"></i>
            </a>
            <a href="https://www.youtube.com/@ARESFTC" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-red transition-colors text-white" aria-label="YouTube">
              <i className="fab fa-youtube"></i>
            </a>
            <a href="mailto:ares23247wv@gmail.com" tabIndex={-1} aria-hidden="true" className="w-10 h-10 bg-marble/10 rounded flex items-center justify-center hover:bg-ares-bronze transition-colors text-white">
              <i className="fas fa-envelope"></i>
            </a>
          </div>
          <p className="text-marble/70 text-xs font-bold uppercase tracking-widest">Ares HQ</p>
          <a href="mailto:ares23247wv@gmail.com" className="text-marble/80 hover:text-ares-red text-sm font-bold transition-colors">
            ares23247wv@gmail.com
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-marble/10 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-marble/60 text-xs font-bold uppercase tracking-[0.3em]">
          © {new Date().getFullYear()} ARES 23247. A member of the MARS 2614 Family.
        </p>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-[0.3em] text-marble/60">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Privacy</Link>
          <Link to="/sponsors" className="hover:text-white transition-colors">Support Us</Link>
        </div>
      </div>
    </footer>
  );
}
