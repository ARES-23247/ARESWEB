import type { ReactNode } from "react";

export function AcademyLabShell({
  titleId,
  title,
  description,
  eyebrow,
  onReset,
  resetLabel = "Reset",
  children,
}: {
  titleId: string;
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  onReset?: () => void;
  resetLabel?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className="my-8 rounded-xl border border-ares-cyan/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-widest text-ares-cyan">
              {eyebrow}
            </p>
          ) : null}
          <h3 id={titleId} className={eyebrow ? "mt-1 text-xl font-black text-white" : "text-xl font-black text-white"}>
            {title}
          </h3>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-marble/80">
              {description}
            </p>
          ) : null}
        </div>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 py-2 text-sm font-bold text-white hover:border-ares-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {resetLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function AcademyModelLimit({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="mt-5 border-l-4 border-ares-gold/60 bg-ares-gold/10 p-3 text-sm leading-relaxed text-white"
    >
      <strong>Model limit:</strong> {children}
    </p>
  );
}

export type AcademyChecklistItem<Key extends string> = {
  key: Key;
  label: string;
};

export function AcademyCheckboxControl({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded border border-white/10 p-3 text-sm leading-relaxed text-white focus-within:ring-2 focus-within:ring-ares-cyan">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-0.5 size-5 shrink-0 accent-ares-red"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

export function AcademyChecklistPanel<Key extends string>({
  checks,
  values,
  onChange,
  legend,
  resultHeading,
  result,
  summary,
}: {
  checks: Array<AcademyChecklistItem<Key>>;
  values: Record<Key, boolean>;
  onChange: (key: Key, checked: boolean) => void;
  legend: string;
  resultHeading: string;
  result: { ready: boolean; title: string; nextAction: string };
  summary?: ReactNode;
}) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.8fr)]">
      <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <legend className="px-2 text-sm font-bold text-ares-gold">{legend}</legend>
        {checks.map((check) => (
          <AcademyCheckboxControl
            key={check.key}
            label={check.label}
            checked={values[check.key]}
            onChange={(checked) => onChange(check.key, checked)}
          />
        ))}
      </fieldset>

      <div className="rounded-lg border border-white/10 bg-obsidian p-4">
        <h4 className="text-sm font-bold uppercase tracking-wider text-ares-gold">{resultHeading}</h4>
        {summary}
        <div aria-live="polite" aria-atomic="true">
          <p className={`mt-4 border-l-4 p-3 text-sm font-bold ${result.ready ? "border-emerald-400 bg-emerald-400/10 text-emerald-100" : "border-ares-red bg-ares-red/10 text-white"}`}>{result.title}</p>
          <p className="mt-4 text-sm leading-relaxed text-marble/80">{result.nextAction}</p>
        </div>
      </div>
    </div>
  );
}

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
