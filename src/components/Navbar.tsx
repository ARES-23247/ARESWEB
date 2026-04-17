import { Link } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed w-full z-50 bg-ares-red/95 backdrop-blur-md border-b border-ares-red-bright/30 p-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-2xl font-black tracking-tighter text-ares-gold flex items-center gap-2">
          ARES <span className="text-white text-lg font-bold">23247</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-wider">
          <Link to="/" className="text-ares-gold hover:text-white transition-colors">Home</Link>
          <Link to="/about" className="text-white/80 hover:text-ares-gold transition-colors">About</Link>
          <Link to="/seasons" className="text-white/80 hover:text-ares-gold transition-colors">Seasons</Link>
          <Link to="/outreach" className="text-white/80 hover:text-ares-gold transition-colors">Outreach</Link>
          <Link to="/blog" className="text-white/80 hover:text-ares-gold transition-colors">Blog</Link>
          <Link to="/contact" className="text-white/80 hover:text-ares-gold transition-colors">Contact</Link>
        </div>

        <div className="hidden md:block">
          <Link to="/contact" className="px-5 py-2.5 bg-ares-gold text-ares-red text-sm font-bold rounded-lg hover:bg-white transition-colors shadow-lg">
            Support Us
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-ares-gold w-8 h-8 flex flex-col justify-center items-center gap-1.5 focus:outline-none">
          <span className={`w-6 h-0.5 bg-current block transition-transform duration-300 ${open ? "rotate-45 translate-y-2" : ""}`}></span>
          <span className={`w-6 h-0.5 bg-current block transition-opacity duration-300 ${open ? "opacity-0" : ""}`}></span>
          <span className={`w-6 h-0.5 bg-current block transition-transform duration-300 ${open ? "-rotate-45 -translate-y-2" : ""}`}></span>
        </button>
      </div>

      {open && (
        <div className="md:hidden mt-4 flex flex-col gap-4 text-sm font-semibold uppercase tracking-wider px-2 pb-4 border-t border-white/10 pt-4">
          <Link to="/" onClick={() => setOpen(false)} className="text-ares-gold">Home</Link>
          <Link to="/about" onClick={() => setOpen(false)} className="text-white/80">About</Link>
          <Link to="/seasons" onClick={() => setOpen(false)} className="text-white/80">Seasons</Link>
          <Link to="/outreach" onClick={() => setOpen(false)} className="text-white/80">Outreach</Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="text-white/80">Blog</Link>
          <Link to="/contact" onClick={() => setOpen(false)} className="text-white/80">Contact</Link>
        </div>
      )}
    </nav>
  );
}
