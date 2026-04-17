export default function Footer() {
  return (
    <footer className="w-full bg-black/80 border-t border-white/10 mt-20 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">

        <div className="col-span-1 md:col-span-2">
          <h3 className="text-2xl font-black text-white mb-4">ARES <span className="text-ares-red">23247</span></h3>
          <p className="text-white/50 text-sm max-w-sm">
            Pushing the boundaries of competitive robotics. Our mission is to inspire, innovate, and lead the future of engineering.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold mb-4">Navigation</h4>
          <ul className="flex flex-col gap-2 text-sm text-white/50">
            <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
            <li><a href="/blog" className="hover:text-white transition-colors">Team Blog</a></li>
            <li><a href="/gallery" className="hover:text-white transition-colors">Gallery</a></li>
            <li><a href="/events" className="hover:text-white transition-colors">Upcoming Events</a></li>
          </ul>
        </div>

        <div className="col-span-1 md:col-span-4 lg:col-span-1 mt-6 lg:mt-0">
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram Feed
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-white/5 rounded backdrop-blur-sm border border-white/10 flex items-center justify-center animate-pulse">
                <span className="text-white/20 text-xs">img</span>
              </div>
            ))}
          </div>
          <a href="#" className="mt-4 block text-xs text-ares-cyan hover:underline transition-all">Follow @ARES23247</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-16 text-center text-white/30 text-xs text-balance">
        © {new Date().getFullYear()} ARES 23247 Robotics. All rights reserved.
      </div>
    </footer>
  );
}
