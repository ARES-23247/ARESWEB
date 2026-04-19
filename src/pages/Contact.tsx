export default function Contact() {
  return (
    <div className="flex flex-col w-full">
      <section className="py-24 bg-ares-gold">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-ares-red uppercase tracking-widest text-sm font-bold mb-2">Get In Touch</p>
          <h1 className="text-4xl md:text-5xl font-bold text-ares-red mb-6">Contact ARES 23247</h1>
          <p className="text-obsidian text-lg mb-8 opacity-90">
            Have a question, want to join the team, or interested in sponsoring? Reach out and we&apos;ll get back to you.
          </p>

          <div className="bg-white rounded-2xl p-8 shadow-lg mb-8">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name-input" className="block text-sm font-bold text-ares-red uppercase tracking-wider mb-2">Name</label>
                  <input id="name-input" type="text" className="w-full border border-ares-gray/30 rounded-lg px-4 py-3 text-ares-gray focus:outline-none focus:border-ares-red transition-colors" placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="email-input" className="block text-sm font-bold text-ares-red uppercase tracking-wider mb-2">Email</label>
                  <input id="email-input" type="email" className="w-full border border-ares-gray/30 rounded-lg px-4 py-3 text-ares-gray focus:outline-none focus:border-ares-red transition-colors" placeholder="you@example.com" />
                </div>
              </div>
              <div>
                <label htmlFor="subject-select" className="block text-sm font-bold text-ares-red uppercase tracking-wider mb-2">Subject</label>
                <select id="subject-select" className="w-full border border-ares-gray/30 rounded-lg px-4 py-3 text-ares-gray focus:outline-none focus:border-ares-red transition-colors bg-white">
                  <option>Joining the Team</option>
                  <option>Sponsorship</option>
                  <option>Mentoring</option>
                  <option>Community Outreach</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label htmlFor="message-textarea" className="block text-sm font-bold text-ares-red uppercase tracking-wider mb-2">Message</label>
                <textarea id="message-textarea" rows={5} className="w-full border border-ares-gray/30 rounded-lg px-4 py-3 text-ares-gray focus:outline-none focus:border-ares-red transition-colors resize-none" placeholder="Tell us about yourself..."></textarea>
              </div>
              <button type="submit" className="px-8 py-3 bg-ares-red text-ares-gold font-bold rounded-lg hover:bg-ares-red hover:scale-105 transition-all shadow-lg w-full md:w-auto">
                Send Message
              </button>
            </form>
          </div>

          <div className="text-center text-ares-gray">
            <p className="font-bold">Or email us directly:</p>
            <a href="mailto:ares@aresfirst.org" className="text-ares-red text-lg font-bold underline hover:text-ares-gold transition-colors">
              ares@aresfirst.org
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
