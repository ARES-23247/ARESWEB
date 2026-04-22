import { useState } from "react";
import { Play, Terminal } from "lucide-react";

export default function CodePlayground() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);

  const defaultCode = `public class Robot extends ARESRobot {
  @Override
  public void robotInit() {
    System.out.println("Initializing ARESLib Modules...");
    ARESData.setTeam(23247);
  }
}`;

  const handleRun = () => {
    setRunning(true);
    setOutput([]);
    setTimeout(() => setOutput(["[ARES] Compiling...", "[ARES] BUILD SUCCESSFUL in 1s"]), 500);
    setTimeout(() => setOutput(prev => [...prev, "[ARES] Deploying to simulator..."]), 1000);
    setTimeout(() => setOutput(prev => [...prev, "[ROBOT] Initializing ARESLib Modules...", "[ROBOT] Team set to 23247."]), 1800);
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div className="my-6 border border-white/10 ares-cut-sm overflow-hidden bg-obsidian shadow-xl font-mono text-sm flex flex-col">
      <div className="bg-obsidian px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-white font-bold opacity-80">Robot.java</span>
        <button onClick={handleRun} disabled={running} className="flex items-center gap-2 bg-ares-cyan/20 hover:bg-ares-cyan/40 text-ares-cyan px-3 py-1 rounded transition-colors disabled:opacity-50">
          <Play size={14} className={running ? "animate-pulse" : ""} /> {running ? "RUNNING" : "RUN"}
        </button>
      </div>
      <div className="p-4 bg-obsidian text-marble/80 whitespace-pre-wrap overflow-x-auto min-h-[160px]">
        <div className="text-ares-cyan">{defaultCode}</div>
      </div>
      <div className="border-t border-white/10 bg-black min-h-[120px] max-h-[120px] p-3 text-xs overflow-y-auto">
        <div className="flex items-center gap-2 text-white/40 mb-2 font-bold"><Terminal size={12} /> Terminal Output</div>
        {output.map((line, i) => (
          <div key={i} className={line.includes("ROBOT") ? "text-ares-gold" : "text-marble/40"}>{line}</div>
        ))}
      </div>
    </div>
  );
}
