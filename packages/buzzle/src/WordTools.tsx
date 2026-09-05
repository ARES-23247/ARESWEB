import { useEffect, useState } from "react";
import { BuzzleWordHelp } from "./BuzzleWordHelp";
import { loadBuzzleDictionary } from "./dictionary";
import "./buzzle.css";

export default function BuzzleWordToolsPage() {
  const [words, setWords] = useState<ReadonlySet<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadBuzzleDictionary().then(
      (dictionary) => { if (active) { setWords(dictionary.words); setLoading(false); } },
      () => { if (active) setLoading(false); },
    );
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    // The word-tools route, its complete import graph, and the versioned word
    // list are installed atomically in the production worker's precache.
    void navigator.serviceWorker.ready.then(async (registration) => {
      // An older active worker can satisfy `ready` while this release is
      // waiting. Check for that update before advertising offline readiness.
      if (navigator.onLine) {
        try { await registration.update(); } catch { return; }
      }
      if (active && !registration.installing && !registration.waiting) setOfflineReady(true);
    });
    return () => { active = false; };
  }, []);

  return <main className="buzzle-shell min-h-screen px-4 pb-16 pt-24 text-marble sm:px-6 sm:pt-32">
    
    <div className="mx-auto max-w-3xl">
      <header className="buzzle-hero mb-4 rounded-2xl p-4 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-ares-gold">BUZZLE™ · Physical play companion</p>
        <h1 className="mt-3 font-heading text-4xl font-black text-white sm:text-5xl">Word Tools</h1>
        <p className="mt-3 text-sm leading-relaxed text-marble/80">Playing at the table? Check a word, explore two-letter words, or find a meaning. No digital game or sign-in needed.</p>
        <a href="/buzzle" className="buzzle-secondary-action mt-4">Play BUZZLE online</a>
      </header>
      <p role="status" className="mb-4 rounded-lg border border-white/20 p-3 text-sm text-marble/80">
        {offlineReady && words
          ? "Ready for offline use on this device: word checker and two-letter list. New definitions need internet."
          : "Keep this page open online until offline setup finishes. If an update is offered, reload and update first. The checker and two-letter list can then reopen without internet; new definitions need internet."}
      </p>
      <BuzzleWordHelp standalone request={{ tab: "check" }} words={words} loading={loading} onRetry={() => { setLoading(true); setAttempt((value) => value + 1); }} />
    </div>
  </main>;
}
