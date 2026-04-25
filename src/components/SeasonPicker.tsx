import { api } from "../api/client";

interface Season {
  start_year: number;
  end_year: number;
  challenge_name: string;
}

interface SeasonPickerProps {
  value?: string | number;
  onChange: (value: string) => void;
  label?: string;
}

export default function SeasonPicker({ value, onChange, label = "Linked Season" }: SeasonPickerProps) {
  const { data: seasonsRes } = api.seasons.list.useQuery(["seasons-list"], {});
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasons = (seasonsRes?.status === 200 ? (Array.isArray(seasonsRes.body) ? seasonsRes.body : (seasonsRes.body as any)?.seasons) : []) as Season[];

  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-marble/40 uppercase tracking-wider mb-2">
        {label}
      </label>
      <select
        title={label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner"
      >
        <option value="">-- No Season Link --</option>
        {seasons?.map((s) => (
          <option key={s.start_year} value={s.start_year.toString()}>
            {s.start_year} | {s.challenge_name}
          </option>
        ))}
      </select>
    </div>
  );
}
