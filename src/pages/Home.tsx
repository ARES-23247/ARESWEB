import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* ─── HERO ─── */}
      <section className="relative w-full min-h-[90vh] flex items-center overflow-hidden bg-ares-red">
        <div className="absolute inset-0 bg-gradient-to-b from-ares-red via-ares-red to-background"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20 pb-16 flex flex-col items-center text-center">
          <p className="text-white font-bold uppercase tracking-[0.3em] text-sm mb-6">
            Appalachian Robotics &amp; Engineering Society
          </p>

          <h1 className="text-[8rem] md:text-[14rem] font-black text-ares-gold leading-none tracking-[0.05em] uppercase drop-shadow-2xl mb-2">
            ARES
          </h1>

          <p className="text-white text-2xl md:text-4xl italic font-light mb-2">
            <span className="not-italic font-bold">FIRST</span> Tech Challenge Team #23247
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center">
            <span className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white text-sm font-semibold uppercase tracking-wider">
              2025/26 — Our Rookie Season
            </span>
            <a href="https://www.marsfirst.org" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white text-sm font-semibold uppercase tracking-wider hover:bg-white/20 transition-colors underline">
              Member of the MARS Family
            </a>
          </div>
        </div>
      </section>

      {/* ─── WHO WE ARE ─── */}
      <section className="py-24 bg-white text-ares-gray">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-ares-gray uppercase tracking-widest text-sm font-bold mb-2">Who We Are</p>
            <h2 className="text-4xl md:text-5xl font-black text-ares-red leading-tight mb-6">
              Appalachian Robotics and Engineering Society
            </h2>
          </div>
          <div className="space-y-6 text-lg leading-relaxed">
            <p>
              We are a community-based <em>FIRST</em> Tech Challenge (FTC) team that represents <em>FIRST</em>'s impact in our state and how West Virginia's students can work across educational backgrounds to achieve something great.
            </p>
            <p>
              ARES is the most recent chapter in North Central West Virginia's strong legacy in <em>FIRST</em> robotics. As part of the Mountaineer Area RoboticS (<em>MARS</em>) #2614 family, ARES is building on MARS's Hall of Fame legacy as West Virginia's flagship FIRST Robotics Competition program.
            </p>
            <p>
              2025 is <em>ARES</em>'s rookie year, but we are backed by a history that represents the summit of what teams can achieve in <em>FIRST</em>.
            </p>
          </div>
        </div>
      </section>

      {/* ─── OUTREACH CARDS ─── */}
      <section className="py-24 bg-ares-gold">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black text-ares-red text-center mb-4">Outreach</h2>
          <p className="text-center text-ares-gray mb-16 max-w-2xl mx-auto">
            Learn more about our team and how you can get involved.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Future Team Members",
                body: "Learn more about our team and what to expect as a team member in FIRST Tech Challenge and then if it looks like a fit, reach out. We can't wait to meet you.",
                link: "/about",
                linkText: "Learn More →",
              },
              {
                title: "Local Community",
                body: "We're looking for opportunities to connect in north-central West Virginia. If you have a volunteer need or idea for our team, get in touch.",
                link: "/contact",
                linkText: "Contact Us →",
              },
              {
                title: "STEAM Community",
                body: "We need your help! You can join our team as a mentor, or give tours of your labs and show us robotics in use. You can also sponsor us through tax-deductible donations.",
                link: "/contact",
                linkText: "Support Us →",
              },
            ].map((card) => (
              <div key={card.title} className="bg-ares-red rounded-2xl p-8 flex flex-col h-full shadow-xl hover:shadow-2xl transition-shadow duration-300 group">
                <h3 className="text-ares-gold text-xl font-bold mb-4 group-hover:underline">{card.title}</h3>
                <p className="text-white/90 text-base leading-relaxed flex-grow">{card.body}</p>
                <Link to={card.link} className="mt-6 inline-block text-ares-gold font-bold text-sm hover:text-white transition-colors">
                  {card.linkText}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STRONG FIRST CULTURE ─── */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-8">
            Strong <em className="text-ares-gold not-italic">FIRST</em> Culture
          </h2>
          <div className="space-y-6 text-lg leading-relaxed text-white/80">
            <p>
              In Morgantown and the general North-Central West Virginia area, there is possibly the strongest <em>FIRST</em> culture out of any place in the state.
            </p>
            <p>
              Morgantown is home to Mountaineer Area RoboticS (MARS), the flagship <em>FIRST</em> Robotics Competition (FRC) program of the state. MARS is a great, internationally-recognized, FRC team who has won multiple awards and accolades. On top of that, MARS outreach involves hosting the <em>FIRST</em> LEGO League (FLL) competitions in the area, and even parenting some in-house teams.
            </p>
            <p>
              Alongside that, <em>FIRST</em> programs in the area are possibly the best way to cultivate certain technical skills, from more robotics-related things such as programming, design, and outreach, to other great skills, like content creation and digital art!
            </p>
            <p className="text-white/50 text-sm italic">
              Photo: All members of the RoboCookies 2025 FLL team are sisters of MARS/ARES team members.
            </p>
          </div>
        </div>
      </section>

      {/* ─── OUTREACH CALENDAR BANNER ─── */}
      <section className="py-16 bg-ares-red">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-ares-gold text-3xl font-bold mb-4">Outreach Calendar</h3>
          <p className="text-white/90 max-w-xl mx-auto mb-6">
            Follow our outreach calendar to see upcoming demos, community events, and workshops.
          </p>
          <a
            href="https://calendar.google.com/calendar/u/0/embed?src=af2d297c3425adaeafc13ddd48a582056404cbf16a6156d3925bb8f3b4affaa0@group.calendar.google.com&ctz=America/New_York"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-ares-gold text-ares-red font-bold rounded-lg hover:bg-white transition-colors"
          >
            View Calendar
          </a>
        </div>
      </section>
    </div>
  );
}
