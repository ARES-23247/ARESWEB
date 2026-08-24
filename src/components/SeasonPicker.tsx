import React, { useState, useEffect, useId } from "react";
import { fetchPublicSeasons, type PublicSeason } from "@/lib/publicContentApi";

type Season = Pick<PublicSeason, "startYear" | "endYear" | "challengeName">;

interface SeasonPickerProps {
  value?: string | number;
  onChange: (value: string) => void;
  label?: string;
}

export default function SeasonPicker({ value, onChange, label = "Linked Season" }: SeasonPickerProps) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectId = useId();

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const list = await fetchPublicSeasons();
        list.sort((a, b) => b.startYear - a.startYear);
        setSeasons(list);
        setLoadError(null);
      } catch {
        setSeasons([]);
        setLoadError("Season choices could not be loaded. Try again after reconnecting.");
      }
    };
    fetchSeasons();
  }, []);

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">
        {label}
      </label>
      <select
        id={selectId}
        title={label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan transition-all shadow-inner"
      >
        <option value="">-- No Season Link --</option>
        {seasons.map((s) => (
          <option key={s.startYear} value={s.startYear.toString()}>
            {s.challengeName} {s.startYear}-{s.endYear}
          </option>
        ))}
      </select>
      {loadError && (
        <p role="alert" className="mt-2 text-xs font-medium text-ares-red-light">
          {loadError}
        </p>
      )}
    </div>
  );
}
