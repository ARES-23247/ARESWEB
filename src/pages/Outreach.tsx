export default function Outreach() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="py-24 bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-4">
            We're passionate about <br/>STEAM in our local <span className="text-ares-gold">Community</span>.
          </h1>
          <p className="text-white/60 text-xl mt-4">
            If you have a volunteer need or idea for our team to be a part of, <a href="/contact" className="text-ares-gold underline hover:text-white transition-colors">get in touch</a>.
          </p>
        </div>
      </section>

      {/* Spark! */}
      <section className="py-20 bg-white text-ares-gray">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-black text-ares-red mb-4">Learn more about Spark!</h2>
          <p className="text-lg leading-relaxed mb-6">
            Spark! Imagination and Science Center is a non-profit children's museum in Morgantown, West Virginia. Spark! works to inspire people of all ages to explore art and science through various hands-on activities and programs that may spark a lifelong love for learning.
          </p>
          <p className="text-lg leading-relaxed">
            ARES is partnering with <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="text-ares-red underline font-semibold">Spark!</a> Imagination and Science Center to expand its capacity and develop new exhibits. We're conducting an informal needs assessment to help Spark! with strategic planning. Then, onto using the Engineering Design Process to develop a rotating exhibit structure to highlight STEM stories unique to West Virginia. Our first exhibit is planned to be a WV Bridge Exhibit.
          </p>
        </div>
      </section>

      {/* Support & Mentoring */}
      <section className="py-20 bg-ares-red">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-black text-ares-gold mb-8">Support Our Team</h2>
          <p className="text-ares-gold/80 text-xl mb-8">
            Our success as a team relies on support from the STEAM community. You can mentor, donate financially, or help teach us about robotics by giving us a tour of your facilities.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-background/30 rounded-2xl p-6 border border-white/10">
              <h3 className="text-white text-xl font-bold mb-3">Become a Mentor</h3>
              <p className="text-white/70 text-base leading-relaxed">
                Mentors with FIRST are building more than robots. Engineering, animation, design, communications &amp; business planning — we need mentors of all kinds.
              </p>
            </div>
            <div className="bg-background/30 rounded-2xl p-6 border border-white/10">
              <h3 className="text-white text-xl font-bold mb-3">Sponsor Us</h3>
              <p className="text-white/70 text-base leading-relaxed">
                Robot parts, equipment, competitions, travel, and training cost money. We rely on sponsors. Please get in touch if you'd like to collaborate.
              </p>
            </div>
            <div className="bg-background/30 rounded-2xl p-6 border border-white/10">
              <h3 className="text-white text-xl font-bold mb-3">Give Us a Tour</h3>
              <p className="text-white/70 text-base leading-relaxed">
                Help us experience robotics in the workforce. We would love to see how key aspects like sensors or coding influence your robots!
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
