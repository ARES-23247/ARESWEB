import { useEntityFetch } from "../hooks/useEntityFetch";

interface Season {
  id: string;
  challenge_name: string;
}

interface SeasonPickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function SeasonPicker({ value, onChange, label = "Linked Season" }: SeasonPickerProps) {
  const { data } = useEntityFetch<{ seasons: Season[] }>("/api/seasons");
  const seasons = data?.seasons || [];

  return (
    <div className="w-full">
      <label className="block text-xs font-bold text-marble/40 uppercase tracking-wider mb-2">
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/30 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner"
      >
        <option value="">-- No Season Link --</option>
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id} - {s.challenge_name}
          </option>
        ))}
      </select>
    </div>
  );
}
