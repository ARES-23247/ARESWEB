import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-obsidian/85 backdrop-blur-xl shadow-2xl px-6 py-4 transition-all duration-500 overflow-hidden meander-border rounded-bl-xl rounded-br-[2.5rem]">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/")} 
          className="text-2xl font-bold tracking-tighter text-white flex items-center gap-2 font-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-1"
          aria-label="ARES 23247 Home"
        >
          ARES <span className="text-ares-red font-bold">23247</span>
        </button>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest">
          <Link to="/" className="text-marble hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Home</Link>
          <Link to="/about" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">About</Link>
          <Link to="/seasons" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Seasons</Link>
          <Link to="/outreach" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Outreach</Link>
          <Link to="/events" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Events</Link>
          <Link to="/tech-stack" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Tech Stack</Link>
          <Link to="/blog" className="text-marble/70 hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded px-2 py-1">Blog</Link>
        </div>

        <div className="hidden md:block">
          <Link to="/contact" className="clipped-button-sm bg-ares-red text-white hover:scale-105 hover:bg-ares-red transition-all shadow-[0_0_15px_rgba(192,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Support Us
          </Link>
        </div>

        <button 
          onClick={() => setOpen(!open)} 
          className="md:hidden text-white w-8 h-8 flex flex-col justify-center items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
        >
          <span className={`w-6 h-0.5 bg-current block transition-transform duration-300 ${open ? "rotate-45 translate-y-2" : ""}`}></span>
          <span className={`w-6 h-0.5 bg-current block transition-opacity duration-300 ${open ? "opacity-0" : ""}`}></span>
          <span className={`w-6 h-0.5 bg-current block transition-transform duration-300 ${open ? "-rotate-45 -translate-y-2" : ""}`}></span>
        </button>
      </div>

      {open && (
        <div className="md:hidden mt-4 flex flex-col gap-4 text-sm font-bold uppercase tracking-widest px-2 pb-4 border-t border-white/10 pt-4">
          <Link to="/" onClick={() => setOpen(false)} className="text-marble hover:text-ares-gold">Home</Link>
          <Link to="/about" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">About</Link>
          <Link to="/seasons" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Seasons</Link>
          <Link to="/outreach" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Outreach</Link>
          <Link to="/events" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Events</Link>
          <Link to="/tech-stack" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Tech Stack</Link>
          <Link to="/blog" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Blog</Link>
          <Link to="/contact" onClick={() => setOpen(false)} className="text-marble/70 hover:text-ares-gold">Contact</Link>
        </div>
      )}
    </nav>
  );
}
