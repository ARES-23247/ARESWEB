export function AcademyDatum({
  label,
  value,
  wide = false,
  accented = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
  accented?: boolean;
}) {
  return (
    <div className={`rounded border border-white/10 p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className={`text-xs uppercase tracking-wide ${accented ? "font-bold text-ares-cyan" : "text-marble/70"}`}>
        {label}
      </dt>
      <dd className={`mt-1 leading-relaxed text-white ${accented ? "text-sm" : "font-semibold"}`}>
        {value}
      </dd>
    </div>
  );
}

export function AcademyRangeControl({
  label,
  unit = "",
  value,
  min,
  max,
  step,
  decimals = 2,
  onChange,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="flex items-center justify-between gap-3 text-sm font-semibold text-white"
      >
        <span>{label}</span>
        <output htmlFor={id} className="font-mono text-ares-cyan">
          {value.toFixed(decimals)}{unit ? ` ${unit}` : ""}
        </output>
      </label>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="min-h-11 w-full cursor-pointer accent-ares-red"
      />
    </div>
  );
}

export function AcademyMetric({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded border border-white/10 p-3">
      <dt className="text-xs uppercase tracking-wide text-marble/70">{label}</dt>
      <dd className={`mt-1 font-mono text-lg font-bold text-white ${capitalize ? "capitalize" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export function AcademySelectControl({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-11 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ").toLowerCase()}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AcademyNumberControl({
  id,
  label,
  unit,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="grid gap-2 text-sm font-bold text-white">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
          className="min-h-11 min-w-0 flex-1 rounded border border-white/20 bg-black px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        />
        {unit && <span aria-hidden="true" className="text-xs text-marble/70">{unit}</span>}
      </span>
    </label>
  );
}
