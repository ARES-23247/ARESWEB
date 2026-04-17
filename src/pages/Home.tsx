export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* 1. HERO SECTION */}
      <section className="relative w-full min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/hero_bg.png" alt="ARES Futuristic Robotics Lab" className="w-full h-full object-cover object-center transform scale-105 duration-1000 ease-out" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20">
          <div className="max-w-3xl">
            <h2 className="text-ares-cyan font-bold tracking-widest text-sm uppercase mb-4 animate-pulse">Engineering The Future</h2>
            <h1 className="text-6xl md:text-8xl font-black text-white leading-tight mb-6 tracking-tighter drop-shadow-2xl">
              ARES <span className="text-ares-red">23247</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-10 text-balance font-light">
              We build precision robotics. By inspiring the next generation of engineers, we turn imagination into reality.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#support" className="px-8 py-4 bg-ares-red hover:bg-red-500 text-white font-bold rounded-lg transition-all duration-300 shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:-translate-y-1 text-center">
                Support Local Robotics
              </a>
              <a href="#about" className="px-8 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-lg transition-all duration-300 hover:border-white/40 text-center">
                Discover Our Team
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RECENT NEWS GRID */}
      <section id="blog" className="py-24 relative z-10 bg-background max-w-7xl mx-auto px-6 w-full">
        <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h3 className="text-ares-cyan font-bold uppercase tracking-widest text-sm mb-2">Updates</h3>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">Recent News</h2>
          </div>
          <a href="/blog" className="hidden md:block text-white/60 hover:text-white hover:underline transition-all">View all articles →</a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { img: "/news_1.png", alt: "Mechanics", date: "March 12, 2026", title: "Optimizing Odometry Paths", snippet: "We have fully rewritten the MARSLib swerve telemetry to prevent thread lock contention on standard loops.", hoverColor: "hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)] hover:border-ares-cyan/30", titleHover: "group-hover:text-ares-cyan" },
            { img: "/news_2.png", alt: "Engineering", date: "March 05, 2026", title: "Lab Upgrades Complete", snippet: "Our engineers finally integrated the new glowing high-tech robotic arms into our test environment.", hoverColor: "hover:shadow-[0_10px_30px_rgba(220,38,38,0.15)] hover:border-ares-red/30", titleHover: "group-hover:text-ares-red" },
            { img: "/news_3.png", alt: "Arena", date: "February 28, 2026", title: "Einstein Championship Setup", snippet: "A first look into the massive cyber environments waiting for us at the finals next month.", hoverColor: "hover:shadow-[0_10px_30px_rgba(255,255,255,0.1)] hover:border-white/30", titleHover: "group-hover:text-white" },
          ].map((card, i) => (
            <div key={i} className={`glass-card rounded-2xl overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-2 ${card.hoverColor} flex flex-col h-full`}>
              <div className="relative h-56 w-full overflow-hidden">
                <img src={card.img} alt={card.alt} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <p className="text-xs text-white/50 mb-2">{card.date}</p>
                <h4 className={`text-xl font-bold text-white mb-3 ${card.titleHover} transition-colors`}>{card.title}</h4>
                <p className="text-sm text-white/60 line-clamp-3">{card.snippet}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. NEXT UPCOMING EVENT BANNER */}
      <section id="events" className="py-12 relative z-10 max-w-7xl mx-auto px-6 w-full mb-12">
        <div className="relative w-full rounded-3xl p-[1px] bg-gradient-to-r from-ares-red via-purple-500 to-ares-cyan overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.2)]">
          <div className="bg-background/90 backdrop-blur-xl rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 w-full h-full">
            <div className="max-w-xl">
              <div className="inline-block px-3 py-1 bg-ares-red/20 border border-ares-red border-opacity-30 rounded-full text-ares-red text-xs font-bold mb-4 animate-pulse">UPCOMING EVENT</div>
              <h3 className="text-3xl md:text-4xl font-black text-white mb-2">PNW District Championship</h3>
              <p className="text-white/60 flex items-center gap-2">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                Veterans Memorial Coliseum, Portland, OR
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end w-full md:w-auto">
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50 tracking-tighter mb-1">APR 03 - 05</p>
              <a href="#" className="mt-4 px-6 py-2 border border-white/20 rounded-lg text-white hover:bg-white hover:text-black transition-colors font-bold w-full md:w-auto text-center">
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
