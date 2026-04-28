import { CalendarPlus, Smartphone } from "lucide-react";
import { api } from "../../api/client";

export const CalendarSubscriptionBanner = () => {
  const { data } = api.events.getCalendarSettings.useQuery(["calendar-settings"]);
  const settings = data?.status === 200 ? data.body : null;

  // We use the Internal calendar for team members (which this portal is for)
  const calendarId = settings?.calendarIdInternal || "c_e1bd19ab921a209fae48dcc25fdb5ec634d0b1d033f7ccb4249a5b6c3da985a7@group.calendar.google.com";

  const googleCalLink = `https://calendar.google.com/calendar/render?cid=${calendarId}`;
  const appleCalLink = `webcal://calendar.google.com/calendar/ical/${calendarId}/public/basic.ics`;

  return (
    <div className="bg-obsidian border border-ares-gold/30 hero-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">Stay Synced with ARES</h3>
        <p className="text-marble/80">
          Subscribe to our calendar feeds to get competition dates and practices directly on your phone.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <a
          href={appleCalLink}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap border border-white/10"
        >
          <Smartphone size={18} />
          Apple / iOS
        </a>
        <a
          href={googleCalLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-ares-red hover:bg-ares-red/90 text-white font-bold uppercase tracking-widest ares-cut-sm transition-all whitespace-nowrap"
        >
          <CalendarPlus size={18} />
          Google Cal
        </a>
      </div>
    </div>
  );
};

