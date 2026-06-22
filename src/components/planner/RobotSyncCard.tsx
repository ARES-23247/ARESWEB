import React from "react";
import { Wifi, Check, Copy } from "lucide-react";

interface RobotSyncCardProps {
  robotIp: string;
  setRobotIp: (val: string) => void;
  syncStatus: "idle" | "uploading" | "success" | "error";
  syncLog: string;
  copiedCmd: boolean;
  handleSyncToRobot: () => void;
  adbPushCmd: string;
  copyAdbCmd: () => void;
}

export function RobotSyncCard({
  robotIp,
  setRobotIp,
  syncStatus,
  syncLog,
  copiedCmd,
  handleSyncToRobot,
  adbPushCmd,
  copyAdbCmd,
}: RobotSyncCardProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red flex items-center gap-1.5">
        <Wifi size={14} /> Connected Robot Sync
      </h3>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-grow">
            <label htmlFor="robot-ip-input" className="text-[9px] font-mono uppercase text-marble/50 block mb-1">
              Robot IP Address
            </label>
            <input
              id="robot-ip-input"
              type="text"
              value={robotIp}
              onChange={(e) => setRobotIp(e.target.value)}
              placeholder="192.168.43.1"
              className="w-full bg-obsidian border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-ares-red"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSyncToRobot}
              disabled={syncStatus === "uploading"}
              className="px-4 py-2.5 bg-ares-red hover:bg-ares-red-dark text-white rounded text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Sync JSON
            </button>
          </div>
        </div>

        {/* Sync Log output terminal */}
        {syncStatus !== "idle" && (
          <div className="bg-black/80 p-2.5 rounded border border-white/5 font-mono text-[9px] leading-relaxed text-marble/80 max-h-[110px] overflow-y-auto whitespace-pre-wrap select-text">
            {syncLog}
          </div>
        )}

        {/* Copyable ADB instruction command line */}
        <div className="bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-1 mt-1">
          <span className="text-[9px] font-mono uppercase text-marble/40">
            ADB Wireless Push Command:
          </span>
          <div className="flex items-center justify-between gap-2 bg-obsidian/75 p-1 px-2 rounded font-mono text-[9px] text-ares-gold overflow-x-auto select-all whitespace-nowrap">
            <span>{adbPushCmd}</span>
            <button
              onClick={copyAdbCmd}
              className="p-1 text-marble/50 hover:text-white shrink-0 cursor-pointer"
              title="Copy ADB command"
            >
              {copiedCmd ? <Check size={10} className="text-ares-cyan" /> : <Copy size={10} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default RobotSyncCard;
