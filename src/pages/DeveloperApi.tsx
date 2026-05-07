import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Key, ShieldAlert } from "lucide-react";
import SEO from "../components/SEO";

export default function DeveloperApi() {
  return (
    <div className="min-h-screen bg-ares-black text-ares-white">
      <SEO
        title="Developer API - ARES 23247"
        description="Interactive API documentation for the ARESWEB backend."
      />
      
      {/* Header */}
      <div className="pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-b border-ares-darker">
        <Link to="/dashboard" className="text-ares-gold hover:text-ares-gold/80 flex items-center gap-2 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-ares-gold to-yellow-600 mb-4">
          Developer API
        </h1>
        <p className="text-lg text-ares-light max-w-3xl">
          Welcome to the ARES 23247 developer portal. Explore our REST API, test endpoints interactively, and integrate our data into your own applications.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Instructions */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-ares-dark rounded-xl border border-ares-darker p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Key className="w-24 h-24 text-ares-gold" />
            </div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Key className="text-ares-gold w-6 h-6" /> Authentication
            </h2>
            <p className="text-ares-light mb-4">
              Most endpoints require a valid Bearer token. To authenticate your requests:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-ares-light/80 font-mono text-sm">
              <li>Log in to your ARESWEB account.</li>
              <li>Navigate to your Profile settings.</li>
              <li>Generate a new Personal Access Token.</li>
              <li>Include the token in your request headers.</li>
            </ol>
            <div className="mt-4 bg-ares-black p-3 rounded font-mono text-xs text-ares-gold/90 border border-ares-darker overflow-x-auto">
              Authorization: Bearer {'<your_token>'}
            </div>
          </div>

          <div className="bg-ares-dark rounded-xl border border-ares-darker p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <ShieldAlert className="text-red-500 w-6 h-6" /> Rate Limiting
            </h2>
            <p className="text-ares-light">
              To ensure stability during competitions, the API enforces strict rate limits.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-ares-light/80">
              <li className="flex justify-between border-b border-ares-darker pb-2">
                <span>Public Routes</span>
                <span className="font-mono text-ares-gold">100 / min</span>
              </li>
              <li className="flex justify-between border-b border-ares-darker pb-2">
                <span>TBA Proxy</span>
                <span className="font-mono text-ares-gold">30 / min</span>
              </li>
              <li className="flex justify-between pt-2">
                <span>Authentication</span>
                <span className="font-mono text-ares-gold">5 / min</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-ares-dark rounded-xl border border-ares-darker p-6 shadow-xl text-center">
            <BookOpen className="w-12 h-12 text-ares-gold mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Need Help?</h3>
            <p className="text-sm text-ares-light mb-4">
              Join the #engineering stream on Zulip to ask questions about API usage or request new endpoints.
            </p>
            <a 
              href="https://ares23247.zulipchat.com" 
              target="_blank" 
              rel="noreferrer"
              className="inline-block w-full py-2 bg-ares-gold text-ares-black font-bold uppercase rounded hover:bg-yellow-500 transition-colors"
            >
              Open Zulip
            </a>
          </div>
        </div>

        {/* Right Column: Interactive Explorer */}
        <div className="lg:col-span-2">
          <div className="bg-ares-dark rounded-xl border border-ares-darker overflow-hidden shadow-2xl h-[800px] flex flex-col">
            <div className="bg-black/40 border-b border-ares-darker p-4 flex items-center justify-between">
              <h2 className="font-bold font-mono text-ares-gold flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                Interactive API Explorer
              </h2>
              <a 
                href="/api/reference" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs font-mono text-ares-light hover:text-ares-white transition-colors"
              >
                Open Fullscreen ↗
              </a>
            </div>
            <iframe 
              src="/api/reference" 
              title="ARES API Reference"
              className="w-full flex-1 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
