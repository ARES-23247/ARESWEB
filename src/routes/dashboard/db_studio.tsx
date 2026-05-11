import { createFileRoute } from '@tanstack/react-router'
import { useDashboardSession } from '../../hooks/useDashboardSession'
import { Database } from 'lucide-react'

export const Route = createFileRoute('/dashboard/db_studio')({
  component: DbStudio,
})

function DbStudio() {
  const { permissions } = useDashboardSession()
  
  if (!permissions.isAdmin) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <div className="text-center">
          <Database size={48} className="mx-auto text-marble/20 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-marble/60">Database Studio requires admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-obsidian">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="text-ares-cyan" size={24} />
          <div>
            <h2 className="text-xl font-bold text-white tracking-tighter">Database Studio</h2>
            <p className="text-marble/60 text-sm">Powered by Drizzle — Run <code className="px-1.5 py-0.5 bg-white/5 rounded text-xs font-mono text-ares-gold">npm run db:studio</code> in a terminal</p>
          </div>
        </div>
        <a
          href="http://localhost:4983"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-ares-cyan/20 hover:bg-ares-cyan/30 text-ares-cyan border border-ares-cyan/30 ares-cut-sm text-sm font-bold transition-all flex items-center gap-2"
        >
          Open in New Tab
        </a>
      </div>
      
      <div className="flex-1 min-h-0 relative">
        <iframe
          src="http://localhost:4983"
          className="w-full h-full border-0"
          title="Drizzle Studio"
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-obsidian/80 z-10" id="studio-overlay">
          <div className="text-center max-w-md p-6 border border-white/10 ares-cut-sm bg-obsidian">
            <Database size={48} className="mx-auto text-ares-gold/50 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Drizzle Studio Not Running</h3>
            <p className="text-marble/60 text-sm mb-4">
              Start Drizzle Studio to browse and edit your D1 database visually.
            </p>
            <div className="bg-black/30 rounded p-3 text-left font-mono text-xs text-ares-gold mb-4">
              <div className="text-marble/60 mb-2"># Run this in a terminal:</div>
              <div>npm run db:studio</div>
            </div>
            <p className="text-marble/40 text-xs">
              Keep this terminal open while using Database Studio.
            </p>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `
            const iframe = document.querySelector('iframe');
            const overlay = document.getElementById('studio-overlay');
            iframe.onload = function() {
              try {
                const iframeDoc = iframe.contentWindow?.document;
                if (iframeDoc && iframeDoc.body) {
                  overlay.style.display = 'none';
                }
              } catch (e) {
                // Cross-origin error - Studio is running
                overlay.style.display = 'none';
              }
            };
            iframe.onerror = function() {
              overlay.style.display = 'flex';
            };
            // Check if already loaded
            setTimeout(() => {
              try {
                if (iframe.contentWindow?.document?.body) {
                  overlay.style.display = 'none';
                }
              } catch (e) {
                // Can't access, but likely running
              }
            }, 1000);
          `
        }} />
      </div>
    </div>
  )
}
