import { Cloud, Zap, Database, GlobeLock, DollarSign, HardDrive, LayoutDashboard, MessageSquare, Workflow, CheckCircle, Eye, ShieldCheck, Activity, Rocket, Paintbrush, Users } from "lucide-react";
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

        {/* 3D Hardware Visualization */}
        <section className="mb-24">
           <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1 bg-white/5" />
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-ares-gold text-center">Interactive Hardware Architecture</h2>
              <div className="h-px flex-1 bg-white/5" />
           </div>
           {/* <RobotViewer /> */}
           <p className="text-[10px] text-marble/70 text-center uppercase tracking-widest font-mono mt-4">
              ARES-R3F Engine v1.0 // Real-time Hardware Twin
           </p>
        </section>

        {/* Header Section */}
        <div className="text-center max-w-4xl mx-auto mb-24 px-4">
          <div className="bg-ares-red/10 text-ares-red px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-10 border border-ares-red/20 inline-block">
            Digital Infrastructure // Sustainability
          </div>
          <h1 className="text-5xl md:text-8xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">Built for the <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20 italic">Future.</span></h1>
          <p className="text-xl md:text-2xl text-marble leading-relaxed font-medium">
            ARES 23247&apos;s digital portal isn&apos;t just a website; it&apos;s a statement on <strong>Sustainability</strong>. 
            By leveraging entirely free, serverless Edge architecture, we&apos;ve brought our operating costs down to <strong>$0.00</strong>.
          </p>
          <div className="mt-12 p-8 bg-black/40 border border-white/5 ares-cut-lg text-sm text-marble/60 italic leading-loose backdrop-blur-sm max-w-2xl mx-auto">
            <span className="text-ares-gold font-black uppercase tracking-widest mr-2 underline">Note:</span> We host our site on a global network of servers that only run when needed. This keeps the site online forever without any monthly bills.
          </div>
        </div>

        {/* Highlight Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl group transition-all duration-700 hover:-translate-y-2 hover:border-ares-cyan/30 hover:shadow-[0_20px_50px_rgba(0,183,235,0.1)] flex flex-col">
            <div className="w-14 h-14 ares-cut-sm border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <Cloud size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Cloudflare Pages</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              Our frontend is globally distributed across Cloudflare&apos;s Edge network. Because it&apos;s deployed as static assets with Edge functions, we get infinite scaling and ultra-fast load times globally without paying for traditional virtual private servers.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold bg-ares-gold/10 px-4 py-2 ares-cut-sm border border-ares-gold/20 w-fit">Cost: $0.00 Tier</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-gold/30 hover:shadow-[0_20px_50px_rgba(207,181,59,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <Zap size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Edge AI Vision</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              We natively bind <strong>Llama</strong> 3.1 & <strong>LLaVA</strong> 1.5 models directly into our Cloudflare router. Whenever an image is uploaded, AI runs structural analysis to auto-generate ARIA labels for visually impaired screen-readers with 0 server costs.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold bg-ares-gold/10 px-4 py-2 ares-cut-sm border border-ares-gold/20 w-fit">Cost: $0.00 Tier</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-gold/30 hover:shadow-[0_20px_50px_rgba(207,181,59,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <Database size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Cloudflare D1 SQL</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              We ditched expensive MongoDB and AWS RDS databases. Our entire blog, events, and asset metadata are stored in Cloudflare D1—a serverless SQLite database native to the Edge.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold bg-ares-gold/10 px-4 py-2 ares-cut-sm border border-ares-gold/20 w-fit">Cost: $0.00 Tier</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-bronze/30 hover:shadow-[0_20px_50px_rgba(205,127,50,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-bronze/30 flex items-center justify-center bg-ares-bronze/10 text-ares-bronze mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <HardDrive size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Cloudflare R2 Storage</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              We host all of our high-resolution imagery securely in Cloudflare R2 Object Storage. This acts identically to Amazon S3, powering our WebP conversion pipeline without the crippling egress bandwidth fees.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold bg-ares-gold/10 px-4 py-2 ares-cut-sm border border-ares-gold/20 w-fit">Cost: $0.00 Tier</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-red/30 hover:shadow-[0_20px_50px_rgba(237,28,36,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <Zap size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Vite + React</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              Our UI is built with React 18 and Vite. Using pure React without heavy SSR frameworks keeps our codebase incredibly lean, teachable to new students, and statically compilable.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-red bg-ares-red/10 px-4 py-2 ares-cut-sm border border-ares-red/20 w-fit">Cost: Open Source</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-red/30 hover:shadow-[0_20px_50px_rgba(237,28,36,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <LayoutDashboard size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Headless CMS</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              The portal features a fully bespoke, role-based Content Management System. It inherently supports abstract syntax trees, intelligent cross-posting (Discord, Bluesky), and a tiered review pipeline allowing students to submit articles for mentor approval.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-red bg-ares-red/10 px-4 py-2 ares-cut-sm border border-ares-red/20 w-fit">Cost: Custom Built</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-gold/30 hover:shadow-[0_20px_50px_rgba(207,181,59,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <Users size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Liveblocks Sync</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              Multiple users can edit task boards and blog posts simultaneously like Google Docs. We use <strong>Liveblocks</strong> and Y.js Conflict-free Replicated Data Types (CRDTs) to seamlessly merge real-time typing across clients.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold bg-ares-gold/10 px-4 py-2 ares-cut-sm border border-ares-gold/20 w-fit">Cost: $0.00 Tier</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-cyan/30 hover:shadow-[0_20px_50px_rgba(0,183,235,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <GlobeLock size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Progressive App Mode</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              To support robotics pits entirely devoid of WiFi, we employ native PWA Service Workers routing `NetworkFirst`. The site silently caches React ASTs & D1 Payloads—launching perfectly offline anywhere in the world.
            </p>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-cyan bg-ares-cyan/10 px-4 py-2 ares-cut-sm border border-ares-cyan/20 w-fit">Cost: Open Source</div>
          </div>

          <div className="bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-700 hover:-translate-y-2 hover:border-ares-cyan/30 hover:shadow-[0_20px_50px_rgba(0,183,235,0.1)]">
            <div className="w-14 h-14 ares-cut-sm border border-ares-cyan/30 flex items-center justify-center bg-ares-cyan/10 text-ares-cyan mb-8 transition-all duration-700 group-hover:scale-110 group-hover:rotate-6">
              <MessageSquare size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">Zulip Cloud</h3>
            <p className="text-marble/50 leading-relaxed mb-8 flex-1 font-medium">
              For our team communications, we proudly use <strong>Zulip</strong>. Their generous donation of Zulip Cloud Standard provides our students and mentors with an organized, thread-based workspace that keeps our engineering and outreach discussions seamlessly coordinated.
            </p>
            <p className="text-marble leading-relaxed mb-4 flex-1">
              Our API is powered by <strong>Hono</strong> and <strong>Zod</strong>. By replacing legacy unified contracts with OpenAPI schemas natively on the Edge, we achieve complete end-to-end type safety, zero cold starts, and automatic interactive documentation generation via Scalar.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-500 hover:-translate-y-2 hover:border-ares-gold/50 hover:shadow-[0_0_30px_rgba(207,181,59,0.15)]">
            <div className="w-12 h-12 rounded-full border border-ares-gold/30 flex items-center justify-center bg-ares-gold/10 text-ares-gold mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Kysely Type-Safe SQL</h3>
            <p className="text-marble leading-relaxed mb-4 flex-1">
              Our Cloudflare D1 interactions are protected by <strong>Kysely</strong>. This query builder enforces strict end-to-end type safety, preventing SQL injection vulnerabilities and catching schema errors at compilation time.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble mt-auto">Cost: Open Source</div>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 hero-card backdrop-blur-sm shadow-xl flex flex-col group transition-all duration-500 hover:-translate-y-2 hover:border-ares-red/50 hover:shadow-[0_0_30px_rgba(237,28,36,0.15)]">
            <div className="w-12 h-12 rounded-full border border-ares-red/30 flex items-center justify-center bg-ares-red/10 text-ares-red mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
              <Paintbrush size={24} />
            </div>
            <h3 className="text-2xl font-bold font-heading mb-4">Tailwind & Framer Motion</h3>
            <p className="text-marble leading-relaxed mb-4 flex-1">
              Our bespoke UI is sculpted with <strong>Tailwind CSS</strong> utilizing a custom &quot;ares-cut&quot; design system, while <strong>Framer Motion</strong> powers the dynamic, physics-based micro-interactions that make the site feel alive.
            </p>
            <div className="text-xs font-bold uppercase tracking-widest text-marble mt-auto">Cost: Open Source</div>
          </div>
        </div>

        {/* Engineering Standards Deep Dive */}
        <div className="max-w-5xl mx-auto space-y-16 mb-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-8 text-ares-cyan">Championship-Grade Standards</h2>
            <p className="text-marble/40 text-xl leading-relaxed font-medium max-w-3xl mx-auto">
              We hold our software to the same rigorous standards as our competition robots. Our entire development lifecycle is governed by automated systems.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-10 group/standard">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-red/30 flex items-center justify-center text-ares-red shadow-lg transition-all duration-500 group-hover/standard:border-ares-red group-hover/standard:scale-110">
              <Workflow size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 text-white">Continuous Deployment</h3>
              <p className="text-marble/50 text-lg leading-relaxed mb-4 font-medium">
                Our pipeline uses automated <strong>Cloudflare Pages CI</strong> on every push to the master branch. The system enforces zero ESLint warnings and flawless TypeScript compilation. If a single strict type check fails, the deployment is autonomously rejected, mathematically guaranteeing our production dashboard never breaks.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-10 group/standard">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-cyan/30 flex items-center justify-center text-ares-cyan shadow-lg transition-all duration-500 group-hover/standard:border-ares-cyan group-hover/standard:scale-110">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 text-white">100% Test Enforcement</h3>
              <p className="text-marble/50 text-lg leading-relaxed mb-4 font-medium">
                We employ a test-driven architecture utilizing <strong>Vitest</strong> and <strong>Playwright</strong>. All backend routes and critical utilities must pass an 85% line and 100% functional coverage threshold. For major DOM flows and user interactions, end-to-end Playwright tests simulate actual user behavior with mocked authentication boundaries to prevent regressions.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-10 group/standard">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-gold/30 flex items-center justify-center text-ares-gold shadow-lg transition-all duration-500 group-hover/standard:border-ares-gold group-hover/standard:scale-110">
              <Eye size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 text-white">WCAG 2.1 AA Accessibility</h3>
              <p className="text-marble/50 text-lg leading-relaxed mb-4 font-medium">
                We believe in inclusion. Our frontend strictly adheres to <strong>WCAG 2.1 AA</strong> standards, verified by Axe and pa11y CI. We ensure flawless screen-reader context using semantic HTML, enforce minimum 4.5:1 color contrast ratios utilizing our &quot;Red Badge Pattern,&quot; and dynamically generate ARIA labels for mission-critical visual elements.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-10 group/standard">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-red/30 flex items-center justify-center text-ares-red shadow-lg transition-all duration-500 group-hover/standard:border-ares-red group-hover/standard:scale-110">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 text-white">Youth Data Protection</h3>
              <p className="text-marble/50 text-lg leading-relaxed mb-4 font-medium">
                We strictly enforce COPPA and <strong>FIRST Youth Protection Program (YPP)</strong> guidelines across our backend architecture. Student Personally Identifiable Information (PII) like email addresses, phone numbers, and precise locations are mathematically scrubbed on the Cloudflare Edge before ever reaching public APIs, guaranteeing total digital safety for our minors.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-10 group/standard">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-cyan/30 flex items-center justify-center text-ares-cyan shadow-lg transition-all duration-500 group-hover/standard:border-ares-cyan group-hover/standard:scale-110">
              <Activity size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 text-white">Granular Failure Exposure</h3>
              <p className="text-marble/50 text-lg leading-relaxed mb-4 font-medium">
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
        <div className="max-w-5xl mx-auto space-y-20 mb-32">
          
          <div className="flex flex-col md:flex-row items-start gap-12 group/sust">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-gold/30 flex items-center justify-center text-ares-gold shadow-lg transition-all duration-500 group-hover/sust:border-ares-gold group-hover/sust:scale-110">
              <DollarSign size={32} />
            </div>
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-6 text-white">Financial Sustainability</h2>
              <p className="text-marble/50 text-lg leading-relaxed mb-6 font-medium">
                Many robotics teams struggle to maintain websites over the years because web hosting costs money. A standard WordPress or AWS environment might cost a team $200+ per year. By strategically selecting <strong>Serverless Edge Infrastructure</strong>, we&apos;ve entirely eliminated recurring hosting fees.
              </p>
              <p className="text-marble/40 leading-relaxed font-medium">
                As long as our code is in GitHub, Cloudflare automatically builds and deploys our site for free. This means that even if our sponsorship funding fluctuates, the ARES 23247 portal will never go offline due to an unpaid hosting bill.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start gap-12 group/sust">
            <div className="w-20 h-20 shrink-0 ares-cut-sm bg-black/40 border border-ares-red/30 flex items-center justify-center text-ares-red shadow-lg transition-all duration-500 group-hover/sust:border-ares-red group-hover/sust:scale-110">
              <GlobeLock size={32} />
            </div>
            <div>
              <h2 className="text-4xl font-black uppercase tracking-tighter mb-6 text-white">Edge Authentication</h2>
              <p className="text-marble/50 text-lg leading-relaxed mb-6 font-medium">
                We didn&apos;t just build it free; we built it secure. Our custom Content Management System (CMS) is protected by <strong>Better-Auth</strong> session management and strict role-based access controls.
              </p>
              <div className="mb-8 p-6 bg-ares-red/10 border border-ares-red/20 ares-cut-sm text-sm text-ares-red font-black uppercase tracking-widest">
                <span className="underline mr-2">Protocol:</span> We implement verified session boundaries. Only authorized, verified team members can interact with sensitive robotics data.
              </div>
              <p className="text-marble/40 leading-relaxed font-medium">
                Rather than relying on legacy access models, our portal features a full permission system with tiered approval workflows, ensuring that student submissions are securely vetted by mentors before publication.
              </p>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-12 ares-cut-lg backdrop-blur-sm shadow-2xl mt-24 relative overflow-hidden group/ethos">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover/ethos:opacity-10 transition-opacity">
              <Award size={120} className="text-ares-gold rotate-12" />
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-6 flex items-center gap-4 text-white">
                The Sustain Award <span className="text-ares-gold italic">Ethos</span>
              </h3>
              <p className="text-marble/60 text-2xl leading-relaxed italic font-medium mb-8">
                &quot;We expand our skillset and create reliable infrastructure so that our team and outreach efforts are sustained for generations.&quot;
              </p>
              <p className="text-marble/40 text-lg font-medium leading-relaxed max-w-3xl">
                Our website infrastructure is a direct reflection of our dedication to the core values of <em>FIRST</em>® Robotics. We don&apos;t just build robots; we engineer lasting digital legacies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
