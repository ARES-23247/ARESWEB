"use client";

import React, { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { useScopeStore, TelemetryData } from "../store/scopeStore";

interface TelemetryLogParserProps {
  onFileDropped: (file: File) => void;
}

export function useTelemetryParser(
  setLoading: (loading: boolean) => void,
  handleDisconnectLive: () => void
) {
  const {
    setTelemetryData,
    setComparisonTelemetryData,
    setConsoleLogs,
    setPlannedPath
  } = useScopeStore();

  const generatePlannedPathFromWaypoints = (wps: any[]) => {
    const parsedWaypoints = wps.map((wp: any) => {
      const anchor = {
        x: (wp.anchor.y * 0.0254) - 1.8288,
        y: 1.8288 - (wp.anchor.x * 0.0254)
      };
      
      const prevControl = wp.prevControl 
        ? { x: (wp.prevControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.prevControl.x * 0.0254) }
        : anchor;
        
      const nextControl = wp.nextControl
        ? { x: (wp.nextControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.nextControl.x * 0.0254) }
        : anchor;
        
      return { anchor, prevControl, nextControl };
    });

    if (parsedWaypoints.length === 0) return [];

    const densePoints: { x: number; y: number; heading: number }[] = [];
    
    let initialHeading = 0;
    if (parsedWaypoints.length > 1) {
      const wp1 = parsedWaypoints[0];
      const wp2 = parsedWaypoints[1];
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const dx = 3 * (p1.x - p0.x);
      const dy = 3 * (p1.y - p0.y);
      initialHeading = Math.atan2(dy, dx);
    }
    
    densePoints.push({
      x: parsedWaypoints[0].anchor.x,
      y: parsedWaypoints[0].anchor.y,
      heading: initialHeading
    });

    const numSamples = 20;
    for (let i = 0; i < parsedWaypoints.length - 1; i++) {
      const wp1 = parsedWaypoints[i];
      const wp2 = parsedWaypoints[i + 1];
      
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const p2 = wp2.prevControl;
      const p3 = wp2.anchor;

      for (let step = 1; step <= numSamples; step++) {
        const t = step / numSamples;
        const omt = 1 - t;
        const omt2 = omt * omt;
        const omt3 = omt2 * omt;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
        const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

        const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
        const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
        const heading = Math.atan2(dy, dx);

        densePoints.push({ x, y, heading });
      }
    }
    return densePoints;
  };

  const parseCSVText = (text: string, fileName: string) => {
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) throw new Error("Invalid CSV format.");

    const headers = lines[0].split(",").map((h) => h.trim());
    const timestamps: number[] = [];
    const coords: { x: number; y: number; heading: number }[] = [];
    const channels: Record<string, number[]> = {};
    
    headers.forEach((h) => {
      channels[h] = [];
    });

    const findColIndex = (names: string[]) => {
      return headers.findIndex((h) => 
        names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
      );
    };

    const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
    const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
    const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
    const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < headers.length) continue;

      const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

      const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
      timestamps.push(t);
      
      let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
      let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
      let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

      if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
        const tempX = x;
        x = (y - 72) / 39.3701;
        y = -(tempX - 72) / 39.3701;
        heading = heading - Math.PI / 2;
      }

      coords.push({ x, y, heading });

      headers.forEach((h, idx) => {
        channels[h].push(colsNum[idx]);
      });
    }

    const customTelemetry: TelemetryData = {
      runId: fileName.substring(0, 15),
      opModeName: "ARESImportedCloudLog",
      timestamps: timestamps,
      coords: coords,
      channels: channels,
      maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
    };

    setTelemetryData(customTelemetry);
    console.log(`[CSV Parser] Parsed and loaded file: ${fileName}`);
  };

  const parseLocalLogFile = (file: File) => {
    handleDisconnectLive();
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");
        parseCSVText(text, file.name);
      } catch (err: any) {
        alert("Failed to parse log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const parseConsoleLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        const parsedEntries: any[] = [];

        lines.forEach((line, idx) => {
          let timestamp = idx * 100;
          let level: "INFO" | "WARN" | "ERROR" = "INFO";
          let message = line;

          if (line.includes("[WARN]") || line.toLowerCase().includes("warn")) {
            level = "WARN";
          } else if (line.includes("[ERROR]") || line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")) {
            level = "ERROR";
          }

          const bracketMatch = line.match(/\[(\d+(?:\.\d+)?)(s|ms)?\]/);
          const colonMatch = line.match(/^(\d+(?:\.\d+)?)(s|ms)?:/);
          
          if (bracketMatch) {
            const val = parseFloat(bracketMatch[1]);
            const unit = bracketMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(bracketMatch[0], "").trim();
          } else if (colonMatch) {
            const val = parseFloat(colonMatch[1]);
            const unit = colonMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(colonMatch[0], "").trim();
          }

          message = message.replace(/\[(INFO|WARN|ERROR)\]/i, "").replace(/\s+/g, " ").trim();

          parsedEntries.push({ timestamp, level, message });
        });

        parsedEntries.sort((a, b) => a.timestamp - b.timestamp);
        setConsoleLogs(parsedEntries);
        console.log(`[Console Log Parser] Loaded ${parsedEntries.length} entries: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse console log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const parseComparisonLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length < 2) throw new Error("Invalid CSV format.");

        const headers = lines[0].split(",").map((h) => h.trim());
        const timestamps: number[] = [];
        const coords: { x: number; y: number; heading: number }[] = [];
        const channels: Record<string, number[]> = {};
        
        headers.forEach((h) => {
          channels[h] = [];
        });

        const findColIndex = (names: string[]) => {
          return headers.findIndex((h) => 
            names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
          );
        };

        const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
        const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
        const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
        const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < headers.length) continue;

          const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

          const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
          timestamps.push(t);
          
          let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
          let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
          let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

          if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
            const tempX = x;
            x = (y - 72) / 39.3701;
            y = -(tempX - 72) / 39.3701;
            heading = heading - Math.PI / 2;
          }

          coords.push({ x, y, heading });

          headers.forEach((h, idx) => {
            channels[h].push(colsNum[idx]);
          });
        }

        const customTelemetry: TelemetryData = {
          runId: file.name.substring(0, 15),
          opModeName: "ARESComparisonLog",
          timestamps: timestamps,
          coords: coords,
          channels: channels,
          maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
        };

        setComparisonTelemetryData(customTelemetry);
        console.log(`[Comparison Parser] Parsed and loaded comparison: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse comparison log: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const parseLocalPathFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const root = JSON.parse(text);
        if (!root.waypoints || !Array.isArray(root.waypoints)) {
          throw new Error("Invalid PathPlanner file: missing waypoints array.");
        }

        const parsedWaypoints = root.waypoints.map((wp: any) => {
          const anchor = {
            x: (wp.anchor?.y ?? 0) - 1.8288,
            y: 1.8288 - (wp.anchor?.x ?? 0)
          };
          
          const prevControl = wp.prevControl 
            ? { x: wp.prevControl.y - 1.8288, y: 1.8288 - wp.prevControl.x }
            : anchor;
            
          const nextControl = wp.nextControl
            ? { x: wp.nextControl.y - 1.8288, y: 1.8288 - wp.nextControl.x }
            : anchor;
            
          return { anchor, prevControl, nextControl };
        });

        if (parsedWaypoints.length === 0) {
          throw new Error("No waypoints found in path.");
        }

        const densePoints: { x: number; y: number; heading: number }[] = [];
        
        let initialHeading = 0;
        if (parsedWaypoints.length > 1) {
          const wp1 = parsedWaypoints[0];
          const wp2 = parsedWaypoints[1];
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const dx = 3 * (p1.x - p0.x);
          const dy = 3 * (p1.y - p0.y);
          initialHeading = Math.atan2(dy, dx);
        }
        
        densePoints.push({
          x: parsedWaypoints[0].anchor.x,
          y: parsedWaypoints[0].anchor.y,
          heading: initialHeading
        });

        const numSamples = 20;
        for (let i = 0; i < parsedWaypoints.length - 1; i++) {
          const wp1 = parsedWaypoints[i];
          const wp2 = parsedWaypoints[i + 1];
          
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const p2 = wp2.prevControl;
          const p3 = wp2.anchor;

          for (let step = 1; step <= numSamples; step++) {
            const t = step / numSamples;
            const omt = 1 - t;
            const omt2 = omt * omt;
            const omt3 = omt2 * omt;
            const t2 = t * t;
            const t3 = t2 * t;

            const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
            const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

            const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
            const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
            const heading = Math.atan2(dy, dx);

            densePoints.push({ x, y, heading });
          }
        }

        setPlannedPath(densePoints);
        console.log(`[Path Parser] Parsed and loaded planned path: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse PathPlanner file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return {
    parseCSVText,
    parseLocalLogFile,
    parseConsoleLogFile,
    parseComparisonLogFile,
    parseLocalPathFile,
    generatePlannedPathFromWaypoints
  };
}

export default function TelemetryLogParser({ onFileDropped }: TelemetryLogParserProps) {
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes("Files")) {
        setDragActive(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
    };
  }, []);

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set drag active to false if we leave the main window / target area
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileDropped(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={handleDrop}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 transition-all duration-300 ${
        dragActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="glass-card border border-ares-gold/30 bg-ares-gold/5 p-10 max-w-md rounded-3xl text-center flex flex-col items-center gap-4 animate-pulse">
        <FolderOpen size={48} className="text-ares-gold" />
        <h3 className="font-extrabold text-white text-lg tracking-tight uppercase font-heading">
          Drop Telemetry Log Here
        </h3>
        <p className="text-marble/65 text-xs font-medium leading-relaxed">
          Release your robot CSV or TXT log file to instantly parse channels and start playback replay!
        </p>
      </div>
    </div>
  );
}
