import { Info, Terminal } from "lucide-react";

export default function CodePlayground() {
  const exampleCode = `public class Robot extends ARESRobot {
  @Override
  public void robotInit() {
    ARESData.setTeam(23247);
  }
}`;

  return (
    <figure className="my-6 overflow-hidden border border-white/10 bg-obsidian shadow-xl ares-cut-sm">
      <figcaption className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-2">
        <span className="font-mono text-sm font-bold text-white">Robot.java example</span>
        <span className="flex items-center gap-1.5 text-xs text-marble/65">
          <Info aria-hidden="true" size={14} /> Read-only example
        </span>
      </figcaption>
      <pre className="min-h-[160px] overflow-x-auto whitespace-pre-wrap bg-obsidian p-4 font-mono text-sm text-ares-cyan">
        <code>{exampleCode}</code>
      </pre>
      <div
        role="note" className="flex items-start gap-2 border-t border-white/10 bg-black p-3 text-xs text-marble/75"><Terminal aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
        This page does not compile or deploy code. Use the documented local
        Gradle workflow to validate a robot project.</div>
      </figure>
  );
}
