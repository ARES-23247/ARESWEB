export default function About() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="py-24 bg-gradient-to-b from-ares-red to-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-ares-gold uppercase tracking-widest text-sm font-bold mb-4">Future Team Members</p>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-8">About ARES</h1>
          <p className="text-white/80 text-xl max-w-2xl mx-auto">
            We&apos;re more than just robotics; FTC provides students with ways to be active in all elements of STEAM (Science, Technology, Engineering, Art, and Mathematics).
          </p>
        </div>
      </section>

      {/* What is FTC */}
      <section className="py-20 bg-white text-ares-gray">
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          <h2 className="text-4xl font-black text-ares-red mb-4">Who might want to join our <em>FIRST</em> Tech Challenge Team?</h2>
          <p className="text-lg leading-relaxed">
            Students 6th–12th grade who love engineering, robotics AND/OR just being part of a team.
          </p>
          <p className="text-lg leading-relaxed">
            At our competitions, we compete for numerous awards that recognize excellence in Machine, Creativity, Innovation (MCI), Team Attributes, Portfolio, Community Engagement, Digital Animation, and more.
          </p>
          <p className="text-lg leading-relaxed">
            This means there is a place on our team for students who want to learn but are not restricted to:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-lg list-disc list-inside">
            {["Technical writing", "Brainstorming", "Game Play Strategy", "Graphic design", "Project management", "Community outreach", "Goal setting", "Recruitment", "Fundraising", "Marketing and Social Media", "Mechanical Engineering and Efficiency", "Electrical Engineering", "Programming and Coding", "Engineering Design", "3D Printing", "Video Production"].map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-ares-gold">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-black text-ares-red mb-12">FAQs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {[
              { q: "What is the purpose of our team?", a: "We are on a mission to bridge the untapped talent within West Virginia with the opportunity residing throughout the world." },
              { q: "Do I need FIRST or robotics experience?", a: "Many of our current team roster participated in FLL in prior years, although some are completely new to FIRST. Others are dual-rostering and are competing as part of the MARS FRC team, too." },
              { q: "What school do I need to attend?", a: "We have students from public schools (from two counties: Monongalia and Harrison), homeschooling, and HOPE scholarship recipients." },
              { q: "Does it cost money to join the team?", a: "No. Currently, the team fees are fully covered by generous donors/sponsors." },
              { q: "When is the team&apos;s season?", a: "Each year&apos;s competition and rules drop at the beginning of September. Competitions start in December and January and, if you make it past the first few rounds, can go until May." },
              { q: "What is the time commitment?", a: "Our team has one weekly weekend practice, plus a few weekly open lab options. We don&apos;t have practices on holidays or any other impractical days." },
              { q: "What if I don't know how to code or use CAD?", a: "It&apos;s totally fine if you aren&apos;t familiar with the software that we use. One of our goals is to teach team members how to code and use CAD." },
              { q: "Where do you meet?", a: "Our team meets in the MARS building at Mountaineer Middle School." },
              { q: "Will I have fun?", a: "Yes! One of the goals for our team is to have fun." },
            ].map((faq) => (
              <div key={faq.q} className="mb-2">
                <h3 className="text-ares-red font-bold text-lg mb-1">{faq.q}</h3>
                <p className="text-ares-gray text-base leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coaches */}
      <section className="py-20 bg-white text-ares-gray">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-black text-ares-red mb-8 text-center">Meet The Coaches</h2>
          <div className="border-t border-ares-red/20 pt-8">
            <h3 className="text-3xl font-bold text-ares-red mb-4">Dave Huss &amp; Kelley Burd-Huss</h3>
            <p className="text-lg leading-relaxed mb-4">
              In 2022, The Huss family was introduced to <em>FIRST</em> Lego League, and the rest is history. Robotics keeps them sane.
            </p>
            <p className="text-lg leading-relaxed mb-4">
              Their oldest son&apos;s passion for robotics has changed the trajectory of how their family spends their time and impacts their community.
            </p>
            <p className="text-lg leading-relaxed">
              Active in <em>FIRST</em> LEGO league and <em>FIRST</em> Robotics challenge, Dave and Kelley are the founding coaches of ARES.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
