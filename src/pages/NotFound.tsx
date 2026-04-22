import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center">
        <div className="relative mb-8">
          <h1 className="text-[8rem] sm:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-ares-red to-ares-red/20 leading-none select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-ares-red/5 border border-ares-red/20 animate-pulse" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          Page Not Found
        </h2>
        <p className="text-marble/60 mb-8 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          <br />
          Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-3 bg-ares-red text-white font-bold uppercase text-xs tracking-widest ares-cut-sm hover:bg-ares-bronze transition-all"
          >
            Go Home
          </Link>
          <Link
            to="/blog"
            className="px-6 py-3 bg-white/5 text-white/70 font-bold uppercase text-xs tracking-widest ares-cut-sm hover:bg-white/10 border border-white/20 transition-all"
          >
            Read Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
