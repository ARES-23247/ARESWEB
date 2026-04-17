import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full bg-ares-gold border-t border-ares-gold/30 mt-0 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Brand */}
        <div>
          <Link to="/" className="block mb-4">
            <h3 className="text-3xl font-black text-ares-red tracking-tight">ARES</h3>
            <p className="text-ares-red/70 text-sm font-semibold">Appalachian Robotics &amp; Engineering Society</p>
            <p className="text-ares-red/60 text-sm">FTC Team #23247</p>
          </Link>
          <p className="text-ares-gray text-sm leading-relaxed">
            We are a community-based FIRST Tech Challenge team located in Morgantown, WV. Our team competes in the FIRST Chesapeake Region and is for 6th to 12th graders.
          </p>
        </div>

        {/* About ARES */}
        <div>
          <h4 className="text-ares-red font-bold uppercase text-sm tracking-wider mb-4">About ARES</h4>
          <ul className="flex flex-col gap-2 text-sm text-ares-gray">
            <li><Link to="/" className="hover:text-ares-red transition-colors">Home</Link></li>
            <li><Link to="/about" className="hover:text-ares-red transition-colors">Who We Are</Link></li>
            <li><Link to="/seasons" className="hover:text-ares-red transition-colors">Seasons</Link></li>
            <li><Link to="/outreach" className="hover:text-ares-red transition-colors">Outreach</Link></li>
            <li><Link to="/blog" className="hover:text-ares-red transition-colors">Team Blog</Link></li>
          </ul>
        </div>

        {/* Follow + Contact */}
        <div>
          <h4 className="text-ares-red font-bold uppercase text-sm tracking-wider mb-4">Follow Us</h4>
          <ul className="flex flex-col gap-2 text-sm">
            <li><a href="https://www.youtube.com/@ARESFTC" target="_blank" rel="noopener noreferrer" className="text-ares-gray hover:text-ares-red transition-colors underline">YouTube</a></li>
            <li><a href="https://www.printables.com/@ARESFTC_3784306" target="_blank" rel="noopener noreferrer" className="text-ares-gray hover:text-ares-red transition-colors underline">Printables</a></li>
            <li><a href="https://www.facebook.com/profile.php?id=61582749275287" target="_blank" rel="noopener noreferrer" className="text-ares-gray hover:text-ares-red transition-colors underline">Facebook</a></li>
            <li><a href="https://tiktok.com/@ares234247" target="_blank" rel="noopener noreferrer" className="text-ares-gray hover:text-ares-red transition-colors underline">TikTok</a></li>
            <li><a href="https://instagram.com/ares23247" target="_blank" rel="noopener noreferrer" className="text-ares-gray hover:text-ares-red transition-colors underline">Instagram</a></li>
          </ul>

          <h4 className="text-ares-red font-bold uppercase text-sm tracking-wider mt-6 mb-2">Get in Touch</h4>
          <a href="mailto:ares23247wv@gmail.com" className="text-ares-gray hover:text-ares-red text-sm underline transition-colors">
            ares23247wv@gmail.com
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-12 text-center text-ares-gray text-xs">
        © {new Date().getFullYear()} ARES 23247 — Appalachian Robotics &amp; Engineering Society. All rights reserved.
      </div>
    </footer>
  );
}
