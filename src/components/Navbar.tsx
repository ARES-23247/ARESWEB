import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="fixed w-full z-50 glass border-b border-white/10 p-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
          ARES <span className="text-ares-red">23247</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link to="/" className="text-white hover:text-ares-cyan transition-colors">Home</Link>
          <Link to="/blog" className="text-white/70 hover:text-white transition-colors">Blog</Link>
          <Link to="/gallery" className="text-white/70 hover:text-white transition-colors">Gallery</Link>
          <Link to="/events" className="text-white/70 hover:text-white transition-colors">Events</Link>
        </div>

        <div className="hidden md:block">
          <a href="#support" className="px-5 py-2.5 bg-ares-red text-white text-sm font-bold rounded-lg hover:bg-red-500 transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            Support Us
          </a>
        </div>

        <button className="md:hidden text-white w-8 h-8 flex flex-col justify-center items-center gap-1.5 focus:outline-none">
          <span className="w-6 h-0.5 bg-white block"></span>
          <span className="w-6 h-0.5 bg-white block"></span>
          <span className="w-6 h-0.5 bg-white block"></span>
        </button>
      </div>
    </nav>
  );
}
