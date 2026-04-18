import { motion } from "framer-motion";
import SEO from "../components/SEO";

export default function Accessibility() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-ares-gold selection:text-zinc-950 pt-24 pb-20">
      <SEO 
        title="Accessibility & Web Standards" 
        description="ARES 23247's commitment to web accessibility, Zero-Trust standards, and AI-powered ARIA compliance."
      />
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mb-16"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-1 bg-ares-red"></span>
            <span className="text-zinc-400 font-mono text-sm tracking-widest uppercase">Digital Manifesto</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Championship-Grade <span className="text-ares-red">Accessibility</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl leading-relaxed">
            As part of our commitment to the FIRST® Robotics core values, ARES 23247 architects our digital infrastructure to exceed inclusive design standards, ensuring our engineering resources are available to everyone.
          </p>
        </motion.div>

        {/* Grid of standards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl"
          >
            <div className="bg-ares-red/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-ares-red">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">AI-Powered ARIA</h3>
            <p className="text-zinc-400 leading-relaxed">
              We leverage Cloudflare Workers AI and LLava vision models directly at the edge. When authors upload media, AI autonomously evaluates the image and injects deeply descriptive screen-reader tags (ALT) before it ever hits the live database.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl"
          >
            <div className="bg-ares-gold/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-ares-gold">
              <span className="font-bold font-mono">10.0</span>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">WAVE AA Compliance</h3>
            <p className="text-zinc-400 leading-relaxed">
              Our DOM tree maintains a perfect 10.0 AIM score and 0 technical errors across WAVE and pa11y enterprise scanners. We enforce strict WCAG 2.1 AA contrast constraints natively in our Tailwind theme configurations.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl"
          >
            <div className="bg-blue-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-blue-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">8th-Grade Readability</h3>
            <p className="text-zinc-400 leading-relaxed">
              We enforce Flesch-Kincaid 8th Grade Reading constraints across our technical blog and Outreach portals. We believe FTC mechanisms shouldn&apos;t be gated behind excessive jargon.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl"
          >
            <div className="bg-green-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-green-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">Zero Trust Architecture</h3>
            <p className="text-zinc-400 leading-relaxed">
              Security is an absolute requirement. Administrative vectors evaluate incoming tokens on the Cloudflare Edge network to block automated bot scans and guarantee system integrity without proxy domains.
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center p-8 rounded-2xl border border-dashed border-zinc-800"
        >
          <div className="flex gap-6 justify-center items-center mb-6 border-b border-zinc-800/50 pb-4 max-w-sm mx-auto">
            <span className="font-mono text-sm tracking-widest text-zinc-500 mr-2">SCANNED BY</span>
            <a href="https://pa11y.org/" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex items-center font-bold text-sm gap-1.5" title="pa11y CI Integrated">
              <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/>
              </svg>
              <span className="text-zinc-300">pa11y</span>
            </a>
            <a href="https://wave.webaim.org/" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity" title="Validated by WAVE Web Accessibility Evaluation Tool">
              <img src="https://wave.webaim.org/img/wavelogo.svg" alt="WAVE Logo" className="h-4" />
            </a>
          </div>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto">
            If you encounter an accessibility hurdle on the ARES Web Portal, please contact us immediately on GitHub or via our Mentors. We treat accessibility defect patches with identical severity to hard system crashes.
          </p>
        </motion.div>

      </div>
    </main>
  );
}
