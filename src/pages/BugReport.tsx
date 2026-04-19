import { useState } from "react";
import { Link } from "react-router-dom";

export default function BugReport() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoStr, setRepoStr] = useState("ARES-23247/ARESWEB"); // Default repo

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
              System <span className="text-ares-red">Diagnostics</span>
            </h1>
            <p className="text-marble/80 text-lg md:text-xl max-w-2xl border-l-4 border-ares-red pl-4">
              Thank you for reporting an issue! We use GitHub Issues to track and squash bugs across the ARES 23247 web infrastructure. 
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Form Column */}
            <div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-red to-ares-bronze"></div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="issue-title" className="block text-xs font-bold text-ares-bronze uppercase tracking-widest mb-2">Short Summary *</label>
                    <input 
                      id="issue-title"
                      type="text" 
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all font-mono"
                      placeholder="e.g. Gallery images fail to load on mobile"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="issue-desc" className="block text-xs font-bold text-ares-bronze uppercase tracking-widest mb-2">Details (Optional)</label>
                    <textarea 
                      id="issue-desc"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all font-mono resize-none text-sm"
                      placeholder="Walk us through the steps to reproduce the error..."
                    />
                    <p className="text-xs text-zinc-500 mt-2 italic">You can always add screenshots or more info on GitHub directly.</p>
                  </div>

                  <div>
                    <label htmlFor="repo-select" className="block text-xs font-bold text-ares-bronze uppercase tracking-widest mb-2">Target Repository</label>
                    <select 
                      id="repo-select"
                      value={repoStr}
                      onChange={(e) => setRepoStr(e.target.value)}
                      className="w-full bg-black/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all font-mono appearance-none"
                    >
                      <option value="ARES-23247/ARESWEB">ARESWEB (Web Portal)</option>
                      <option value="ARES-23247/IntoTheDeep">IntoTheDeep (Robot Code)</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-ares-red hover:bg-white hover:text-ares-red text-white font-bold tracking-widest uppercase text-sm py-4 rounded-xl transition-all shadow-lg shadow-ares-red/20 active:translate-y-1"
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
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center shrink-0 border border-zinc-700 text-zinc-400 text-xl">
                  <i className="fab fa-github"></i>
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
                  <i className="fas fa-envelope"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide uppercase">No Account? No Problem</h3>
                  <p className="text-marble/70 text-sm leading-relaxed mb-3">
                    If you don&apos;t have a GitHub account, you can email us your bug report securely.
                  </p>
                  <a href="mailto:ares@aresfirst.org?subject=ARES%20Bug%20Report" className="text-ares-cyan hover:text-white font-bold text-sm tracking-wider uppercase inline-flex items-center gap-2 transition-colors">
                    Report via Email <span className="text-lg">→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center pb-8">
            <Link to="/" className="text-marble/50 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors inline-block border-b border-transparent hover:border-white">
              Return to Base
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
