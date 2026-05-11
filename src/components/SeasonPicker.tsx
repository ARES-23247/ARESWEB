import { useGetSeasons } from "../api/seasons";

interface SeasonPickerProps {
  value?: string | number;
  onChange: (value: string) => void;
  label?: string;
}

export default function SeasonPicker({ value, onChange, label = "Linked Season" }: SeasonPickerProps) {
  const { data: rawSeasons } = useGetSeasons();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasons = (rawSeasons?.seasons && Array.isArray(rawSeasons.seasons) ? rawSeasons.seasons : []) as any[];

  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-2">
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
          <option key={s.startYear} value={s.startYear.toString()}>
            {s.challengeName} {s.startYear}-{s.endYear}
          </option>
        ))}
      </select>
    </div>
  );
}
