import { useState } from "react";
import { siteConfig } from "../site.config";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export default function BugReport() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoStr, setRepoStr] = useState(`${siteConfig.urls.githubOrg}/ARESWEB`); // Default repo

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title) return;

    // Construct the GitHub issue URL
    const baseUrl = `https://github.com/${repoStr}/issues/new`;
    
    const params = new URLSearchParams();
    params.append('title', `[Bug]: ${title}`);
    params.append('labels', 'bug');
    params.append('body', description || "**Describe the bug**\nA clear and concise description of what the bug is.\n\n**To Reproduce**\nSteps to reproduce the behavior...\n\n**Expected behavior**\nA clear and concise description of what you expected to happen.\n\n**Diagnostic Data**\n(If you saw a red error box, copy and paste the error code and message here)");

    const finalUrl = `${baseUrl}?${params.toString()}`;
    
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col w-full">
      <section className="py-24 bg-obsidian text-marble min-h-[85vh]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tight mb-4 uppercase">
              System <span aria-hidden="true" className="text-ares-gold before:content-['Diagnostics']"></span>
              <span className="sr-only">Diagnostics</span>
            </h1>
            <p className="text-marble/80 text-lg md:text-xl max-w-2xl border-l-4 border-ares-red pl-4">
              Thank you for reporting an issue! We use GitHub Issues to track and squash bugs across the ARES 23247 web infrastructure. 
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Form Column */}
            <div>
              <div className="bg-white/5 border border-white/10 ares-cut-sm p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-red to-ares-gold"></div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="issue-title" className="block text-xs font-bold text-ares-gold uppercase tracking-widest mb-2">Short Summary *</label>
                    <input 
                      id="issue-title"
                      type="text" 
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-ares-gold focus:border-ares-gold transition-all font-mono"
                      placeholder="e.g. Gallery images fail to load on mobile"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="issue-desc" className="block text-xs font-bold text-ares-gold uppercase tracking-widest mb-2">Details (Optional)</label>
                    <textarea 
                      id="issue-desc"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-1 focus:ring-ares-gold focus:border-ares-gold transition-all font-mono resize-none text-sm"
                      placeholder="Walk us through the steps to reproduce the error..."
                    />
                    <p className="text-xs text-white/60 mt-2 italic">You can always add screenshots or more info on GitHub directly.</p>
                  </div>

                  <div>
                    <label htmlFor="repo-select" className="block text-xs font-bold text-ares-gold uppercase tracking-widest mb-2">Target Repository</label>
                    <select 
                      id="repo-select"
                      value={repoStr}
                      onChange={(e) => setRepoStr(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-ares-gold focus:border-ares-gold transition-all font-mono appearance-none"
                    >
                      <option value={`${siteConfig.urls.githubOrg}/ARESWEB`}>ARESWEB (Web Portal)</option>
                      <option value={`${siteConfig.urls.githubOrg}/IntoTheDeep`}>IntoTheDeep (Robot Code)</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-ares-red hover:bg-white hover:text-ares-red text-white font-bold tracking-widest uppercase text-sm py-4 ares-cut-sm transition-all shadow-lg shadow-ares-red/20 active:translate-y-1"
                  >
                    Draft GitHub Issue
                  </button>
                </form>
              </div>
            </div>

            {/* Information Column */}
            <div className="flex flex-col justify-center space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-ares-red/10 rounded-full flex items-center justify-center shrink-0 border border-ares-red/20 text-ares-red text-xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">No Silent Failures</h3>
                  <p className="text-marble/70 text-sm leading-relaxed">
                    If you saw a red error box popup, please <strong>copy and paste the exact technical status code</strong> in your report. It helps our developers trace the error instantly!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-black/40 rounded-full flex items-center justify-center shrink-0 border border-white/10 text-white/60 text-xl">
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">GitHub Account Required</h3>
                  <p className="text-marble/70 text-sm leading-relaxed">
                    This button will forward your draft to our public GitHub issue tracker. You will need to click &quot;Submit New Issue&quot; on the final page.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-ares-cyan/10 rounded-full flex items-center justify-center shrink-0 border border-ares-cyan/20 text-ares-cyan text-xl">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">No Account? No Problem</h3>
                  <p className="text-marble/70 text-sm leading-relaxed mb-3">
                    If you don&apos;t have a GitHub account, you can email us your bug report securely.
                  </p>
                  <a href={`mailto:${siteConfig.contact.email}?subject=${siteConfig.team.name}%20Bug%20Report`} className="text-ares-cyan hover:text-white font-bold text-sm tracking-wider uppercase inline-flex items-center gap-2 transition-colors">
                    Report via Email <span aria-hidden="true" className="text-lg before:content-['→']"></span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center pb-8">
            <Link to="/" className="text-marble/70 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors inline-block border-b border-transparent hover:border-white">
              Return to Base
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
