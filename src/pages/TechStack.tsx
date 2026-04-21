import { Cloud, Zap, Database, GlobeLock, DollarSign, HardDrive, LayoutDashboard, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import GitHubHeatmap from "../components/GitHubHeatmap";

export default function TechStack() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-obsidian text-white pt-24 pb-16"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 overflow-x-hidden">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 px-4">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold font-heading mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-ares-gold to-ares-red leading-tight">
            Built for the Future.
          </h1>
          <p className="text-lg md:text-xl text-marble/80 leading-relaxed">
            ARES 23247&apos;s digital portal isn&apos;t just a website; it&apos;s a statement on <strong>Sustainability</strong>. 
            By leveraging entirely free, serverless Edge architecture, we&apos;ve brought our operating costs down to <strong>$0.00</strong>.
          </p>
          <div className="mt-4 p-4 bg-white/5 border-l-2 border-ares-gold text-sm text-marble/60 italic">
            <strong>What this means:</strong> We host our site on a global network of servers that only run when needed. This keeps the site online forever without any monthly bills.
          </div>
        </div>

        {/* Highlight Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl">
            <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-6">
              <Cloud size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Cloudflare Pages</h3>
            <p className="text-marble/70 leading-relaxed mb-4">
              Our frontend is globally distributed across Cloudflare&apos;s Edge network. Because it&apos;s deployed as static assets with Edge functions, we get infinite scaling and ultra-fast load times globally without paying for traditional virtual private servers.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-ares-cyan">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center bg-purple-500/10 text-purple-500 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Edge AI Vision</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We natively bind <strong>Llama</strong> 3.1 & <strong>LLaVA</strong> 1.5 models directly into our Cloudflare router. Whenever an image is uploaded, AI runs structural analysis to auto-generate ARIA labels for visually impaired screen-readers with 0 server costs.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-purple-500 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-6">
              <Database size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Cloudflare D1 SQL</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We ditched expensive MongoDB and AWS RDS databases. Our entire blog, events, and asset metadata are stored in Cloudflare D1—a serverless SQLite database native to the Edge.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-ares-gold mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-orange-500/30 flex items-center justify-center bg-orange-500/10 text-orange-500 mb-6">
              <HardDrive size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Cloudflare R2 Storage</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We host all of our high-resolution imagery securely in Cloudflare R2 Object Storage. This acts identically to Amazon S3, powering our WebP conversion pipeline without the crippling egress bandwidth fees.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-orange-500 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Vite + React</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              Our UI is built with React 18 and Vite. Using pure React without heavy SSR frameworks keeps our codebase incredibly lean, teachable to new students, and statically compilable.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-ares-red mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/10 text-blue-500 mb-6">
              <LayoutDashboard size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Headless CMS</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              The portal features a fully bespoke, role-based Content Management System. It inherently supports abstract syntax trees, intelligent cross-posting (Discord, Bluesky), and a tiered review pipeline allowing students to submit articles for mentor approval.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-blue-500 mt-auto">Cost: Custom Built</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-green-500/30 flex items-center justify-center bg-green-500/10 text-green-500 mb-6">
              <GlobeLock size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Progressive App Mode</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              To support robotics pits entirely devoid of WiFi, we employ native PWA Service Workers routing `NetworkFirst`. The site silently caches React ASTs & D1 Payloads—launching perfectly offline anywhere in the world.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-green-500 mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-teal-500/30 flex items-center justify-center bg-teal-500/10 text-teal-500 mb-6">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Zulip Cloud</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              For our team communications, we proudly use <strong>Zulip</strong>. Their generous donation of Zulip Cloud Standard provides our students and mentors with an organized, thread-based workspace that keeps our engineering and outreach discussions seamlessly coordinated.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-teal-500 mt-auto">Cost: Sponsored</div>
          </div>
        </div>

        {/* GitHub Activity Heatmap */}
        <div className="mb-24">
          <GitHubHeatmap />
        </div>

        {/* Sustainability Deep Dive */}
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-green-500 to-green-900 flex items-center justify-center text-white shadow-lg">
              <DollarSign size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-heading mb-4">Financial Sustainability</h2>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                Many robotics teams struggle to maintain websites over the years because web hosting costs money. A standard WordPress or AWS environment might cost a team $200+ per year. By strategically selecting <strong>Serverless Edge Infrastructure</strong>, we&apos;ve entirely eliminated recurring hosting fees.
              </p>
              <p className="text-marble/70 leading-relaxed">
                As long as our code is in GitHub, Cloudflare automatically builds and deploys our site for free. This means that even if our sponsorship funding fluctuates, the ARES 23247 portal will never go offline due to an unpaid hosting bill.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-indigo-500 to-purple-900 flex items-center justify-center text-white shadow-lg">
              <GlobeLock size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-heading mb-4">Next-Gen Authentication</h2>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                We didn&apos;t just build it free; we built it secure. Our custom Content Management System (CMS) is protected by <strong>Better-Auth</strong> session management and strict role-based access controls.
              </p>
              <div className="mb-6 p-4 bg-white/5 border-l-2 border-purple-500 text-sm text-marble/60 italic">
                <strong>What this means:</strong> We implement verified session boundaries. Only authorized, verified team members can interact with sensitive robotics data, RSVP for events, or publish content.
              </div>
              <p className="text-marble/70 leading-relaxed">
                Rather than relying on legacy access models, our portal features a full permission system with tiered approval workflows, ensuring that student submissions are securely vetted by mentors before publication.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border-l-4 border-ares-gold p-8 hero-card mt-16 shadow-2xl">
            <h3 className="text-2xl font-bold font-heading mb-3 flex items-center gap-3">
              The Sustain Award Ethos
            </h3>
            <p className="text-marble/80 text-lg leading-relaxed italic">
              &quot;We expand our skillset and create reliable infrastructure so that our team and outreach efforts are sustained for generations.&quot;
            </p>
            <p className="mt-4 text-marble/60">
              Our website infrastructure is a direct reflection of our dedication to the core values of <em>FIRST</em>® Robotics. We don&apos;t just build robots; we engineer lasting digital legacies.
            </p>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
