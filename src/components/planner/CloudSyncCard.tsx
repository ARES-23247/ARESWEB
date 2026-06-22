import React from "react";
import { FolderOpen, Save } from "lucide-react";
import { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "../../types/planner";

interface CloudSyncCardProps {
  pathName: string;
  season: string;
  waypoints: Waypoint[];
  markers: EventMarker[];
  constraintZones: ConstraintZone[];
  rotationTargets: RotationTarget[];
  maxVelocity: number;
  maxAcceleration: number;
  maxAngularVelocity: number;
  maxAngularAcceleration: number;
  startVelocity: number;
  startHeading: number;
  endVelocity: number;
  endHeading: number;
  cloudPaths: Array<{
    id: string;
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
    maxVelocity?: number;
    maxAcceleration?: number;
    maxAngularVelocity?: number;
    maxAngularAcceleration?: number;
    startVelocity?: number;
    startHeading?: number;
    endVelocity?: number;
    endHeading?: number;
    updatedAt: any;
  }>;
  onSaveToCloud?: (
    name: string,
    season: string,
    waypoints: Waypoint[],
    markers: EventMarker[],
    constraintZones?: ConstraintZone[],
    rotationTargets?: RotationTarget[],
    maxVelocity?: number,
    maxAcceleration?: number,
    maxAngularVelocity?: number,
    maxAngularAcceleration?: number,
    startVelocity?: number,
    startHeading?: number,
    endVelocity?: number,
    endHeading?: number
  ) => Promise<void>;
  onLoadPath?: (pathId: string) => void;
  isSavingCloud: boolean;
}

export function CloudSyncCard({
  pathName,
  season,
  waypoints,
  markers,
  constraintZones,
  rotationTargets,
  maxVelocity,
  maxAcceleration,
  maxAngularVelocity,
  maxAngularAcceleration,
  startVelocity,
  startHeading,
  endVelocity,
  endHeading,
  cloudPaths,
  onSaveToCloud,
  onLoadPath,
  isSavingCloud,
}: CloudSyncCardProps) {
  if (!onSaveToCloud) return null;

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
        <FolderOpen size={14} /> Cloud Workspace
      </h3>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onSaveToCloud(
              pathName,
              season,
              waypoints,
              markers,
              constraintZones,
              rotationTargets,
              maxVelocity,
              maxAcceleration,
              maxAngularVelocity,
              maxAngularAcceleration,
              startVelocity,
              startHeading,
              endVelocity,
              endHeading
            )
          }
          disabled={isSavingCloud}
          className="flex-grow py-2 bg-ares-red hover:bg-ares-red/90 text-white rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
        >
          <Save size={12} /> {isSavingCloud ? "Saving..." : "Save Path to Cloud"}
        </button>
      </div>

      {cloudPaths.length > 0 && onLoadPath && (
        <div>
          <label htmlFor="load-cloud-path-select" className="text-[9px] font-mono uppercase text-marble/50 block mb-1">
            Load Cloud Path
          </label>
          <select
            id="load-cloud-path-select"
            onChange={(e) => {
              if (e.target.value) onLoadPath(e.target.value);
            }}
            defaultValue=""
            className="w-full bg-obsidian border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="" disabled>
              -- Select Saved Path --
            </option>
            {cloudPaths.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.season.toUpperCase().replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
export default CloudSyncCard;
