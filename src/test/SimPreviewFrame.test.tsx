import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import SimPreviewFrame from "@/components/editor/SimPreviewFrame";
import {
  MAX_CONSOLE_LOGS,
  MAX_TELEMETRY_POINTS,
  MAX_TELEMETRY_SERIES,
  useSimulationTelemetry,
} from "@/hooks/useSimulationTelemetry";

describe("SimPreviewFrame isolation", () => {
  it("uses an opaque-origin static sandbox without srcdoc inline scripts", () => {
    render(
      <SimPreviewFrame
        compiledFiles={{ "index.js": "module.exports = {};" }}
        compileError={null}
      />,
    );

    const iframe = screen.getByTitle("Simulation Preview");
    expect(iframe).toHaveAttribute("src", "/sandbox/simulation-preview.html");
    expect(iframe).not.toHaveAttribute("srcdoc");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-forms");
  });

  it("posts compiled files only after sim-sandbox-ready from its own opaque iframe", () => {
    render(
      <SimPreviewFrame
        compiledFiles={{ "SimComponent.jsx": "exports.default = () => null;" }}
        compileError={null}
      />,
    );
    const iframe = screen.getByTitle("Simulation Preview") as HTMLIFrameElement;
    const postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-sandbox-ready" },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "sim-run",
        compiledFiles: { "SimComponent.jsx": "exports.default = () => null;" },
      }),
      "*",
    );
  });

  it("accepts and validates messages only from its own opaque iframe window", () => {
    const onTestResult = vi.fn();
    const onTelemetry = vi.fn();
    const onScreenshot = vi.fn();
    const onConsoleLog = vi.fn();
    const onFps = vi.fn();

    render(
      <SimPreviewFrame
        compiledFiles={{ "index.js": "module.exports = {};" }}
        compileError={null}
        onTestResult={onTestResult}
        onTelemetry={onTelemetry}
        onScreenshot={onScreenshot}
        onConsoleLog={onConsoleLog}
        onFps={onFps}
      />,
    );
    const iframe = screen.getByTitle("Simulation Preview") as HTMLIFrameElement;
    const result = { name: "sandbox", passed: true };

    act(() => {
      // Wrong source or origin must be rejected.
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-test-result", result },
          source: window,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_SCREENSHOT", dataUrl: "https://attacker.example/leak.png" },
          source: window,
          origin: "https://evil.example",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-test-result", result },
          source: iframe.contentWindow,
          origin: "https://evil.example",
        }),
      );
      // Malformed payloads from the iframe itself must be rejected.
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-test-result", result: { name: "", passed: "yes" } },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_TELEMETRY", key: "toString", value: 12, timestamp: 10 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_TELEMETRY", key: "__proto__", value: 12, timestamp: 10 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_TELEMETRY", key: "heading", value: Number.NaN, timestamp: 10 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_SCREENSHOT", dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-console", level: "invalid", args: ["hi"] },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-console", level: "log", args: "not-an-array" },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-fps", fps: 5000 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
    });

    expect(onTestResult).not.toHaveBeenCalled();
    expect(onTelemetry).not.toHaveBeenCalled();
    expect(onScreenshot).not.toHaveBeenCalled();
    expect(onConsoleLog).not.toHaveBeenCalled();
    expect(onFps).not.toHaveBeenCalled();

    // Valid messages from the opaque iframe are forwarded cleanly.
    const validPng = "data:image/png;base64,iVBORw0KGgo=";
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-test-result", result },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_TELEMETRY", key: "heading", value: 42.5, timestamp: 1234 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_SCREENSHOT", dataUrl: validPng },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-console", level: "info", args: ["booted", 1], timestamp: 1235 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "sim-fps", fps: 60 },
          source: iframe.contentWindow,
          origin: "null",
        }),
      );
    });

    expect(onTestResult).toHaveBeenCalledWith(result);
    expect(onTelemetry).toHaveBeenCalledWith({ key: "heading", value: 42.5, timestamp: 1234 });
    expect(onScreenshot).toHaveBeenCalledWith(validPng);
    expect(onConsoleLog).toHaveBeenCalledWith({
      level: "info",
      args: ["booted", "1"],
      timestamp: 1235,
    });
    expect(onFps).toHaveBeenCalledWith(60);
  });

  it("does not attach a global window message listener in useSimulationTelemetry and bounds state", () => {
    let telemetryState: Record<string, { time: number; value: number }[]> = {};
    let consoleState: Array<{ level: "log" | "warn" | "error" | "info"; args: string[]; timestamp: number }> = [];
    const setAttachedImage = vi.fn();
    const setFps = vi.fn();

    const { result } = renderHook(() =>
      useSimulationTelemetry({
        setTelemetry: (updater) => {
          telemetryState =
            typeof updater === "function" ? updater(telemetryState) : updater;
        },
        setAttachedImage,
        setConsoleLogs: (updater) => {
          consoleState =
            typeof updater === "function" ? updater(consoleState) : updater;
        },
        setFps,
      }),
    );

    // Raw cross-origin window postMessages must never mutate state via useSimulationTelemetry.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_SCREENSHOT", dataUrl: "https://attacker.example/x.png" },
          origin: "https://attacker.example",
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "ARES_TELEMETRY", key: "toString", value: 1, timestamp: 1 },
        }),
      );
    });
    expect(setAttachedImage).not.toHaveBeenCalled();
    expect(telemetryState).toEqual({});

    // Direct handlers reject prototype keys & external URLs and cap series/points/logs.
    act(() => {
      result.current.onTelemetry({ key: "toString", value: 1, timestamp: 1 });
      result.current.onTelemetry({ key: "__proto__", value: 1, timestamp: 1 });
      result.current.onScreenshot("https://attacker.example/x.png");
      result.current.onFps(9999);
    });
    expect(telemetryState).toEqual({});
    expect(setAttachedImage).not.toHaveBeenCalled();
    expect(setFps).not.toHaveBeenCalled();

    act(() => {
      for (let series = 0; series < MAX_TELEMETRY_SERIES + 5; series += 1) {
        result.current.onTelemetry({ key: `s-${series}`, value: series, timestamp: series });
      }
      for (let pt = 0; pt < MAX_TELEMETRY_POINTS + 20; pt += 1) {
        result.current.onTelemetry({ key: "s-0", value: pt, timestamp: pt });
      }
      for (let i = 0; i < MAX_CONSOLE_LOGS + 25; i += 1) {
        result.current.onConsoleLog({ level: "log", args: [`msg-${i}`], timestamp: i });
      }
    });

    expect(Object.keys(telemetryState)).toHaveLength(MAX_TELEMETRY_SERIES);
    expect(telemetryState["s-0"]).toHaveLength(MAX_TELEMETRY_POINTS);
    expect(consoleState).toHaveLength(MAX_CONSOLE_LOGS);
  });
});
