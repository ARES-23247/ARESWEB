import React, { useMemo, useState } from "react";

const WEEKDAYS: Array<{ code: string; label: string; title: string }> = [
  { code: "MO", label: "M", title: "Monday" },
  { code: "TU", label: "T", title: "Tuesday" },
  { code: "WE", label: "W", title: "Wednesday" },
  { code: "TH", label: "T", title: "Thursday" },
  { code: "FR", label: "F", title: "Friday" },
  { code: "SA", label: "S", title: "Saturday" },
  { code: "SU", label: "S", title: "Sunday" },
];

const INTERVAL_LABELS: Record<number, string> = {
  1: "Every week",
  2: "Every 2 weeks",
  3: "Every 3 weeks",
  4: "Every 4 weeks",
  5: "Every 5 weeks",
  6: "Every 6 weeks",
  7: "Every 7 weeks",
  8: "Every 8 weeks",
};

function weekdayOf(dateStart: string): string | null {
  const date = new Date(dateStart);
  if (Number.isNaN(date.getTime())) return null;
  return WEEKDAYS[(date.getUTCDay() + 6) % 7].code;
}

interface EventRecurrenceSectionProps {
  canEdit: boolean;
  formDateStart: string;
  formRepeats: "none" | "weekly";
  setFormRepeats: (value: "none" | "weekly") => void;
  formInterval: number;
  setFormInterval: (value: number) => void;
  formByDay: string[];
  setFormByDay: (value: string[]) => void;
  formUntil: string;
  setFormUntil: (value: string) => void;
  isEditingExistingRecurring: boolean;
  occurrenceExceptions: Array<{ date: string; isCancelled: boolean }>;
  onCancelOccurrence: (date: string) => Promise<void>;
  onRestoreOccurrence: (date: string) => Promise<void>;
}

export default function EventRecurrenceSection({
  canEdit,
  formDateStart,
  formRepeats,
  setFormRepeats,
  formInterval,
  setFormInterval,
  formByDay,
  setFormByDay,
  formUntil,
  setFormUntil,
  isEditingExistingRecurring,
  occurrenceExceptions,
  onCancelOccurrence,
  onRestoreOccurrence,
}: EventRecurrenceSectionProps) {
  const [skipDate, setSkipDate] = useState("");
  const [skipBusy, setSkipBusy] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  const cancelledDates = useMemo(
    () => occurrenceExceptions.filter((exception) => exception.isCancelled),
    [occurrenceExceptions],
  );

  const toggleWeekday = (code: string) => {
    if (!canEdit) return;
    setFormByDay(
      formByDay.includes(code)
        ? formByDay.filter((entry) => entry !== code)
        : [...formByDay, code],
    );
  };

  const handleRepeatsChange = (value: "none" | "weekly") => {
    if (!canEdit) return;
    setFormRepeats(value);
    if (value === "weekly" && formByDay.length === 0) {
      const seeded = weekdayOf(formDateStart);
      if (seeded) setFormByDay([seeded]);
    }
  };

  const handleSkipDate = async () => {
    setSkipError(null);
    if (!skipDate) {
      setSkipError("Choose a date to skip.");
      return;
    }
    setSkipBusy(true);
    try {
      await onCancelOccurrence(skipDate);
      setSkipDate("");
    } catch (err) {
      setSkipError(err instanceof Error ? err.message : String(err));
    } finally {
      setSkipBusy(false);
    }
  };

  return (
    <fieldset className="border border-white/10 rounded-lg p-4 space-y-4" disabled={!canEdit}>
      <legend className="px-2 text-[10px] font-bold uppercase tracking-wider text-marble/60">
        Repeats
      </legend>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="event-repeats" className="sr-only">Repeat pattern</label>
        <select
          id="event-repeats"
          value={formRepeats}
          onChange={(event) => handleRepeatsChange(event.target.value as "none" | "weekly")}
          className="bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan font-bold cursor-pointer"
        >
          <option value="none" className="bg-obsidian text-white font-bold">Does not repeat</option>
          <option value="weekly" className="bg-obsidian text-white font-bold">Weekly</option>
        </select>

        {formRepeats === "weekly" && (
          <>
            <label htmlFor="event-repeats-interval" className="sr-only">Repeat interval</label>
            <select
              id="event-repeats-interval"
              value={formInterval}
              onChange={(event) => setFormInterval(Number(event.target.value))}
              className="bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan font-bold cursor-pointer"
            >
              {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value} className="bg-obsidian text-white font-bold">
                  {INTERVAL_LABELS[value]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {formRepeats === "weekly" && (
        <>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">
              Session days (first session is the date above)
            </span>
            <div className="flex gap-1.5" role="group" aria-label="Session weekdays">
              {WEEKDAYS.map((day) => {
                const active = formByDay.includes(day.code);
                return (
                  <button
                    key={day.code}
                    type="button"
                    title={day.title}
                    aria-pressed={active}
                    aria-label={`${day.title} ${active ? "has a session" : "has no session"}`}
                    onClick={() => toggleWeekday(day.code)}
                    className={`w-9 h-9 rounded text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                      active
                        ? "bg-ares-red text-white"
                        : "bg-white/5 text-marble/50 hover:bg-white/10"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {formByDay.length === 0 && (
              <p className="mt-2 text-[10px] text-ares-gold">Pick at least one session day before saving.</p>
            )}
          </div>

          <div className="max-w-[220px]">
            <label
              htmlFor="event-repeats-until"
              className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
            >
              Last session (optional)
            </label>
            <input
              id="event-repeats-until"
              type="date"
              value={formUntil}
              min={formDateStart.slice(0, 10)}
              onChange={(event) => setFormUntil(event.target.value)}
              className="w-full bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
            />
          </div>
        </>
      )}

      {isEditingExistingRecurring && (
        <div className="border-t border-white/5 pt-3 space-y-2">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-marble/60">
            Skipped dates
          </span>
          {cancelledDates.length === 0 ? (
            <p className="text-[10px] text-marble/50">No sessions are skipped.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {cancelledDates.map((exception) => (
                <li
                  key={exception.date}
                  className="inline-flex items-center gap-2 bg-white/5 rounded px-2 py-1 text-[10px] text-white"
                >
                  {exception.date}
                  <button
                    type="button"
                    onClick={() => void onRestoreOccurrence(exception.date)}
                    className="text-ares-cyan underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="event-skip-date" className="sr-only">Date to skip</label>
            <input
              id="event-skip-date"
              type="date"
              value={skipDate}
              onChange={(event) => setSkipDate(event.target.value)}
              className="bg-black/60 border border-white/10 text-xs text-white rounded px-3 py-2 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
            />
            <button
              type="button"
              onClick={() => void handleSkipDate()}
              disabled={skipBusy || !canEdit}
              className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              {skipBusy ? "Skipping…" : "Skip this date"}
            </button>
            {skipError && <p className="text-[10px] text-ares-red w-full">{skipError}</p>}
          </div>
        </div>
      )}
    </fieldset>
  );
}
