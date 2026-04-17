export default function Seasons() {
  return (
    <div className="flex flex-col w-full">
      <section className="py-24 bg-ares-red">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-ares-gold mb-4">Seasons</h1>
        </div>
      </section>

      {/* 2025/26 */}
      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-baseline gap-4 mb-4">
            <h2 className="text-4xl md:text-5xl font-black text-ares-gold">2025/26</h2>
            <span className="text-ares-gold text-sm font-bold uppercase tracking-wider">Our Rookie Season</span>
          </div>
          <p className="text-white/80 text-lg leading-relaxed mb-12">
            This was our first season learning about and experiencing <em>FIRST</em> Tech Challenge (FTC) as a team. This is the year that our team has been building a strong foundation for the future of ARES FTC.
          </p>

          {/* FTC Decode */}
          <div className="bg-black/40 rounded-2xl border border-white/10 p-8 mb-12">
            <h3 className="text-3xl font-black text-ares-green mb-4">FTC Decode 2025–2026 Season</h3>
            <p className="text-white/80 text-lg leading-relaxed mb-6">
              FTC DECODE is the 2025-2026 <em>FIRST</em> Tech Challenge season theme. It is focused on archaeology where we use STEAM to investigate artifacts, unlock mysteries, and build robots to collect and score colored balls (artifacts) in goals, create patterns, and manage endgame tasks like fitting robots in small spaces. The game requires advanced designs, coding, and collaboration with alliances.
            </p>

            <h4 className="text-2xl font-bold text-ares-orange mb-3">Our Competitions</h4>
            <ul className="text-white/70 text-lg space-y-2">
              <li>
                <a href="https://ftc-events.firstinspires.org/2025/team/23247" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">
                  Moorefield, WV Qualifier I: Saturday, January 10, 2026
                </a>
              </li>
              <li>
                <a href="https://ftc-events.firstinspires.org/2025/team/23247" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">
                  Moorefield, WV Qualifier II: Sunday, January 11, 2026
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
