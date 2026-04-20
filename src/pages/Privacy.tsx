import { motion } from "framer-motion";
import { Shield, EyeOff, Server, Lock } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-obsidian text-white pt-24 pb-16"
    >
      <Helmet>
        <title>Privacy Policy | ARES 23247</title>
        <meta name="description" content="ARES 23247 Privacy Policy. Read our commitment to COPPA, GDPR, and cookie-free analytics." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <h1 className="text-4xl lg:text-5xl font-bold font-heading mb-6 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xl text-marble/80 border-l-2 border-ares-cyan/30 pl-6">
            ARES 23247 is committed to engineering privacy. We employ <strong>Cookie-Free Analytics</strong> to protect our students and global visitors.
          </p>
        </div>

        <div className="space-y-12">
          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan">
                <EyeOff size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">1. Cookie-Free Web Analytics</h2>
            </div>
            <p className="text-marble/70 leading-relaxed mb-4">
              We do not use invasive tracking pipelines like Google Analytics or Meta Pixels. Instead, we use <strong>Cloudflare Web Analytics</strong>.
            </p>
            <ul className="list-disc pl-6 text-marble/70 space-y-2">
              <li>No unique user IP addresses are stored or fingerprinted.</li>
              <li>No cookies or client-side persistent storage mechanisms are used to track you.</li>
              <li>We only measure aggregate traffic metrics (e.g., total hits, country of origin, and loading performance) to ensure our Edge network remains functional.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold">
                <Shield size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">2. COPPA & Student Privacy</h2>
            </div>
            <p className="text-marble/70 leading-relaxed mb-4">
              As a <em>FIRST</em>® Tech Challenge team, we operate in an environment inclusive of minors. We strictly adhere to the <strong>Children&apos;s Online Privacy Protection Act (COPPA)</strong>.
            </p>
            <ul className="list-disc pl-6 text-marble/70 space-y-2">
              <li>We <strong>never</strong> collect Personally Identifiable Information (PII) from general web portal visitors.</li>
              <li>Robotics team member names, photographs, and media are only published with explicit written consent and release forms signed by legal guardians.</li>
            </ul>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center bg-purple-500/10 text-purple-500">
                <Server size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">3. Edge AI Processing</h2>
            </div>
            <p className="text-marble/70 leading-relaxed">
              When ARES leadership uploads media via our Publisher Dashboard, we utilize Cloudflare Workers AI (LLaMa 3.1, LLava 1.5) to automatically generate Accessibility (ARIA) tags. This processing happens ephemerally entirely on Cloudflare&apos;s Edge network. The raw data is never sold, shared, or utilized to train external foundation models.
            </p>
          </section>

          <section className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-ares-red/5 rounded-bl-full -z-10"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red">
                <Lock size={24} />
              </div>
              <h2 className="text-2xl font-bold font-heading">4. Secure Administration</h2>
            </div>
            <p className="text-marble/70 leading-relaxed">
              Our internal content management system and API bounds are strictly locked behind role-based authentication. Access requires direct verification through authorized FIRST Robotics team identity providers.
            </p>
          </section>
        </div>

        <div className="mt-16 text-center text-marble/50 text-sm">
          <p>This privacy policy is actively maintained by ARES 23247.</p>
          <p>For inquiries, contact us at <a href="mailto:ares@aresfirst.org" className="text-marble/80 hover:text-ares-red transition-colors font-bold tracking-widest uppercase">ares@aresfirst.org</a></p>
        </div>
      </div>
    </motion.div>
  );
}
