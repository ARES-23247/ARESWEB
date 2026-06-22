import { useState } from "react";
import { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "../../types/planner";

interface UseRobotSyncProps {
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
}

export function useRobotSync({
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
}: UseRobotSyncProps) {
  const [robotIp, setRobotIp] = useState("192.168.43.1");
  const [syncStatus, setSyncStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [syncLog, setSyncLog] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleSyncToRobot = async () => {
    setSyncStatus("uploading");
    setSyncLog(
      `Initiating HTTP connection to Robot Controller Program & Manage server...\nTarget URL: http://${robotIp}:8080/\n\n`
    );

    const pathData = {
      name: pathName,
      season,
      waypoints: waypoints.map((w) => ({
        anchor: { x: parseFloat(w.anchor.x.toFixed(2)), y: parseFloat(w.anchor.y.toFixed(2)) },
        prevControl: w.prevControl
          ? { x: parseFloat(w.prevControl.x.toFixed(2)), y: parseFloat(w.prevControl.y.toFixed(2)) }
          : null,
        nextControl: w.nextControl
          ? { x: parseFloat(w.nextControl.x.toFixed(2)), y: parseFloat(w.nextControl.y.toFixed(2)) }
          : null,
      })),
      eventMarkers: markers.map((m) => ({
        name: m.name,
        waypointRelativePos: parseFloat((m.progress * (waypoints.length - 1)).toFixed(3)),
        command: {
          type: "named",
          name: m.actions[0] || m.name,
        },
      })),
      markers: markers.map((m) => ({
        id: m.id,
        name: m.name,
        progress: parseFloat(m.progress.toFixed(3)),
        actions: m.actions,
      })),
      constraintZones: constraintZones.map((z) => ({
        id: z.id,
        name: z.name,
        x: parseFloat(z.x.toFixed(2)),
        y: parseFloat(z.y.toFixed(2)),
        width: parseFloat(z.width.toFixed(2)),
        height: parseFloat(z.height.toFixed(2)),
        maxVelocity: z.maxVelocity,
      })),
      rotationTargets: rotationTargets.map((r) => ({
        id: r.id,
        name: r.name,
        x: parseFloat(r.x.toFixed(2)),
        y: parseFloat(r.y.toFixed(2)),
        waypointIndex: r.waypointIndex,
      })),
      maxVelocity,
      maxAcceleration,
      maxAngularVelocity,
      maxAngularAcceleration,
      startVelocity,
      startHeading,
      endVelocity,
      endHeading,
    };

    try {
      const targetUrl = `http://${robotIp}:8080/onbotjava/save?file=src/org/firstinspires/ftc/teamcode/${pathName}.json`;

      setSyncLog((prev) => prev + `Sending POST request payload to:\n${targetUrl}\n\n`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(pathData, null, 2),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setSyncStatus("success");
        setSyncLog(
          (prev) =>
            prev +
            `SUCCESS: Path successfully saved to Control Hub!\nFile located at: /FIRST/java/src/org/firstinspires/ftc/teamcode/${pathName}.json\n\nYou can now load this file in your OpMode using your JSON path parser!`
        );
      } else {
        throw new Error(`Server returned HTTP status ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      setSyncStatus("error");
      let errorMsg = err.message || err;
      if (err.name === "AbortError") {
        errorMsg = "Connection timed out. Ensure your PC is connected to the Robot's Wi-Fi network.";
      }

      setSyncLog(
        (prev) =>
          prev +
          `ERROR: Upload failed.\nDetail: ${errorMsg}\n\n` +
          `⚠️ TECHNICAL NOTE (Mixed Content & CORS):\n` +
          `Modern browsers block HTTPS websites (like aresfirst-portal.web.app) from calling local HTTP addresses (like http://${robotIp}:8080). ` +
          `If this failed, you can run the portal locally, or use the copyable ADB Command line below to push the file wirelessly!`
      );
    }
  };

  const adbPushCmd = `adb connect ${robotIp}:5555 && adb push ${pathName
    .toLowerCase()
    .replace(/\s+/g, "_")}.json /sdcard/FIRST/${pathName}.json`;

  const copyAdbCmd = () => {
    navigator.clipboard.writeText(adbPushCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return {
    robotIp,
    setRobotIp,
    syncStatus,
    syncLog,
    copiedCmd,
    handleSyncToRobot,
    adbPushCmd,
    copyAdbCmd,
  };
}
