import { CalendarPlus } from "lucide-react";

export const CalendarSubscriptionBanner = () => {
  return (
    <div className="bg-obsidian border border-ares-gold/30 hero-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">Stay Synced with ARES</h3>
        <p className="text-marble/80">
          Subscribe to our Google Calendar feeds to get competition dates and practices directly on your phone.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <a
          href="https://calendar.google.com/calendar/r"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-ares-red hover:bg-ares-red/90 text-white font-bold uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap"
        >
          <CalendarPlus size={18} />
          Subscribe
        </a>
      </div>
    </div>
  );
};
