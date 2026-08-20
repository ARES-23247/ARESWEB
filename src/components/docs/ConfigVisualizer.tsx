import { Info, Settings } from "lucide-react";

export default function ConfigVisualizer() {

  return (
    <figure className="my-6 overflow-hidden border border-white/10 bg-obsidian shadow-xl ares-cut-sm">
      <figcaption className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-sm font-bold text-white">
          <Settings aria-hidden="true" size={18} className="text-ares-gold" />
          Example ARESLib tuning file
        </span>
          <span className="text-xs font-bold uppercase text-marble/60">
          Read only</span>
        </figcaption>
        <pre className="min-h-[160px] overflow-x-auto p-4 font-mono text-sm text-marble"> <code>{`drive:
  max_velocity: 4.5       # m/s
  max_acceleration: 3.0   # m/s²
  track_width: 0.55`}
        </code>
      </pre>

      <div
        role="note" className="flex items-start gap-2 border-t border-white/10 bg-black/30 p-3 text-xs text-marble/75">
        <Info aria-hidden="true" size=
        {14} className="mt-0.5 shrink-0" />
        This is a formatting example, not a live robot connection. Copy reviewed
        values into the appropriate project configuration and test them safely.
      </div>
    </figure>);}