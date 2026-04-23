import { Cloud, Zap, Database, GlobeLock, DollarSign, HardDrive, LayoutDashboard, MessageSquare, Workflow, CheckCircle, Eye, ShieldCheck, Activity } from "lucide-react";
import { motion } from "framer-motion";
import GitHubHeatmap from "../components/GitHubHeatmap";
import SEO from "../components/SEO";

export default function TechStack() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-obsidian text-white pt-24 pb-16"
    >
      <SEO title="Tech Stack" description="Explore the zero-cost, serverless architecture powering ARES 23247." />
      <div className="max-w-7xl mx-auto px-6 lg:px-8 overflow-x-hidden">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 px-4">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold font-heading mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-ares-gold to-ares-red leading-tight before:content-['Built_for_the_Future.']" aria-hidden="true"></h1>
          <h1 className="sr-only">Built for the Future.</h1>
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
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Edge AI Vision</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We natively bind <strong>Llama</strong> 3.1 & <strong>LLaVA</strong> 1.5 models directly into our Cloudflare router. Whenever an image is uploaded, AI runs structural analysis to auto-generate ARIA labels for visually impaired screen-readers with 0 server costs.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-6">
              <Database size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Cloudflare D1 SQL</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We ditched expensive MongoDB and AWS RDS databases. Our entire blog, events, and asset metadata are stored in Cloudflare D1—a serverless SQLite database native to the Edge.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-bronze/30 flex items-center justify-center bg-ares-bronze/10 text-ares-bronze mb-6">
              <HardDrive size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Cloudflare R2 Storage</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              We host all of our high-resolution imagery securely in Cloudflare R2 Object Storage. This acts identically to Amazon S3, powering our WebP conversion pipeline without the crippling egress bandwidth fees.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Free Tier</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Vite + React</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              Our UI is built with React 18 and Vite. Using pure React without heavy SSR frameworks keeps our codebase incredibly lean, teachable to new students, and statically compilable.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-6">
              <LayoutDashboard size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Headless CMS</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              The portal features a fully bespoke, role-based Content Management System. It inherently supports abstract syntax trees, intelligent cross-posting (Discord, Bluesky), and a tiered review pipeline allowing students to submit articles for mentor approval.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Custom Built</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-6">
              <GlobeLock size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Progressive App Mode</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              To support robotics pits entirely devoid of WiFi, we employ native PWA Service Workers routing `NetworkFirst`. The site silently caches React ASTs & D1 Payloads—launching perfectly offline anywhere in the world.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col">
            <div className="w-12 h-12 rounded-full border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-6">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Zulip Cloud</h3>
            <p className="text-marble/70 leading-relaxed mb-4 flex-1">
              For our team communications, we proudly use <strong>Zulip</strong>. Their generous donation of Zulip Cloud Standard provides our students and mentors with an organized, thread-based workspace that keeps our engineering and outreach discussions seamlessly coordinated.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble/60 mt-auto">Cost: Sponsored</div>
          </div>
        </div>

        {/* Engineering Standards Deep Dive */}
        <div className="max-w-4xl mx-auto space-y-12 mb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold font-heading mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-ares-cyan">Championship-Grade Engineering Standards</h2>
            <p className="text-marble/80 text-lg leading-relaxed">
              We hold our software to the same rigorous standards as our competition robots. Our entire development lifecycle is governed by automated systems that ensure absolute reliability, flawless accessibility, and zero downtime.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-red to-ares-bronze flex items-center justify-center text-white shadow-lg">
              <Workflow size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading mb-4">Continuous Integration & Deployment</h3>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                Our pipeline uses automated <strong>Cloudflare Pages CI</strong> on every push to the master branch. The system enforces zero ESLint warnings and flawless TypeScript compilation. If a single strict type check fails, the deployment is autonomously rejected, mathematically guaranteeing our production dashboard never breaks.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-cyan to-ares-bronze flex items-center justify-center text-white shadow-lg">
              <CheckCircle size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading mb-4">100% Test Coverage Enforcement</h3>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                We employ a test-driven architecture utilizing <strong>Vitest</strong> and <strong>Playwright</strong>. All backend routes and critical utilities must pass an 85% line and 100% functional coverage threshold. For major DOM flows and user interactions, end-to-end Playwright tests simulate actual user behavior with mocked authentication boundaries to prevent regressions.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-gold to-ares-red flex items-center justify-center text-white shadow-lg">
              <Eye size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading mb-4">WCAG 2.1 AA Web Accessibility</h3>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                We believe in inclusion. Our frontend strictly adheres to <strong>WCAG 2.1 AA</strong> standards, verified by Axe and pa11y CI. We ensure flawless screen-reader context using semantic HTML, enforce minimum 4.5:1 color contrast ratios utilizing our &quot;Red Badge Pattern,&quot; and dynamically generate ARIA labels for mission-critical visual elements.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-red to-ares-gold flex items-center justify-center text-white shadow-lg">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading mb-4">FIRST Youth Data Protection</h3>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                We strictly enforce COPPA and <strong>FIRST Youth Protection Program (YPP)</strong> guidelines across our backend architecture. Student Personally Identifiable Information (PII) like email addresses, phone numbers, and precise locations are mathematically scrubbed on the Cloudflare Edge before ever reaching public APIs, guaranteeing total digital safety for our minors.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-cyan to-ares-bronze flex items-center justify-center text-white shadow-lg">
              <Activity size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-bold font-heading mb-4">Granular Failure Exposure</h3>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                To maintain our zero-downtime philosophy, we ban &quot;silent failures.&quot; Network rejections, Cloudflare execution faults, and database constraints are intentionally bubbled up to the UI with exact HTTP status codes and structured telemetry, enabling lightning-fast administrative remediation in the Command Center.
              </p>
            </div>
          </div>
        </div>

        {/* GitHub Activity Heatmap */}
        <div className="mb-24">
          <GitHubHeatmap />
        </div>

        {/* Sustainability Deep Dive */}
        <div className="max-w-4xl mx-auto space-y-12">
          
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-gold to-ares-bronze flex items-center justify-center text-white shadow-lg">
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
            <div className="w-16 h-16 shrink-0 ares-cut bg-gradient-to-br from-ares-red to-ares-bronze flex items-center justify-center text-white shadow-lg">
              <GlobeLock size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-bold font-heading mb-4">Next-Gen Authentication</h2>
              <p className="text-marble/70 text-lg leading-relaxed mb-4">
                We didn&apos;t just build it free; we built it secure. Our custom Content Management System (CMS) is protected by <strong>Better-Auth</strong> session management and strict role-based access controls.
              </p>
              <div className="mb-6 p-4 bg-white/5 border-l-2 border-ares-red text-sm text-marble/60 italic">
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
