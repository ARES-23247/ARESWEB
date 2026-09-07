import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import fontLicenseUrl from "../assets/fonts/OFL.txt?url";

const KEY = "ares.waggle-way.preferences.v1";
interface Preferences {
  sound: boolean;
  reducedMotion: boolean;
}
interface PreferenceState {
  value: Preferences;
  error: string;
  readable: boolean;
}

export function useWaggleExperience() {
  const [settings, setSettings] = useState<PreferenceState>(() => {
    const fallback = { sound: false, reducedMotion: false };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return { value: fallback, error: "", readable: true };
      if (raw.length > 1024) throw new Error("Oversized preferences");
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid preferences");
      const record = value as Record<string, unknown>;
      if (
        Object.keys(record).length !== 3 ||
        record.version !== 1 ||
        typeof record.sound !== "boolean" ||
        typeof record.reducedMotion !== "boolean"
      )
        throw new Error("Unsupported preferences");
      return {
        value: { sound: record.sound, reducedMotion: record.reducedMotion },
        error: "",
        readable: true,
      };
    } catch {
      return {
        value: fallback,
        error:
          "Saved preferences could not be read and were preserved. Changes apply to this session only.",
        readable: false,
      };
    }
  });
  const [audioError, setAudioError] = useState("");
  const context = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      void context.current?.close().catch(() => undefined);
      context.current = null;
    },
    [],
  );

  const update = (value: Preferences) => {
    let error = settings.error;
    if (settings.readable) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ version: 1, ...value }));
        error = "";
      } catch {
        error =
          "Preferences could not be saved. Your choices still apply to this session.";
      }
    }
    setSettings({ ...settings, value, error });
  };

  const playCue = useCallback(
    async (kind: "start" | "rescue" | "lost" | "win", force = false) => {
      if (!settings.value.sound && !force) return;
      try {
        if (typeof AudioContext === "undefined")
          throw new Error("Audio unavailable");
        const audio = context.current ?? new AudioContext();
        context.current = audio;
        if (audio.state === "suspended") await audio.resume();
        if (audio.state !== "running") throw new Error("Audio paused");
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        const frequency = { start: 392, rescue: 659, lost: 196, win: 784 }[
          kind
        ];
        oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audio.currentTime + 0.18,
        );
        oscillator.connect(gain).connect(audio.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.2);
        setAudioError("");
      } catch {
        setAudioError(
          "Sound is unavailable in this browser right now. All game events remain visible.",
        );
      }
    },
    [settings.value.sound],
  );

  return { settings, audioError, update, playCue };
}

export default function ExperienceControls({
  experience,
  compact = false,
}: {
  experience: ReturnType<typeof useWaggleExperience>;
  compact?: boolean;
}) {
  const { settings, update, playCue, audioError } = experience;
  return (
    <details name="ww-information" className="ww-panel ww-preferences">
      <summary>{compact ? "Sound" : "Sound and motion"}</summary>
      <div className="ww-panel-content">
        <div className="ww-toolbar">
          <label>
            <input
              type="checkbox"
              checked={settings.value.sound}
              onChange={(event) => {
                update({ ...settings.value, sound: event.target.checked });
                if (event.target.checked) void playCue("start", true);
              }}
            />{" "}
            Enable gentle sound cues
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.value.reducedMotion}
              onChange={(event) =>
                update({
                  ...settings.value,
                  reducedMotion: event.target.checked,
                })
              }
            />{" "}
            Reduce extra animation
          </label>
          <Button
            variant="secondary"
            disabled={!settings.value.sound}
            onClick={() => {
              void playCue("start");
            }}
          >
            Test sound
          </Button>
        </div>
        <p className="ww-caption">
          Your device’s reduced-motion setting is always respected. Bee flight
          shows the puzzle state; pause or step to inspect it at your own pace.
        </p>
        {settings.error && <p role="alert">{settings.error}</p>}
        {audioError && <p role="status">{audioError}</p>}
        <p className="ww-caption">
          Pixelify Sans by Stefie Justprince ·{" "}
          <a href={fontLicenseUrl} target="_blank" rel="noopener noreferrer">
            Font license
          </a>
        </p>
      </div>
    </details>
  );
}
