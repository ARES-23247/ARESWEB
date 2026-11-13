import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SimPreviewFrame from "@/components/editor/SimPreviewFrame";

describe("SimPreviewFrame isolation", () => {
  it("uses an opaque-origin sandbox for untrusted simulation code", () => {
    render(<SimPreviewFrame compiledFiles={{ "index.js": "module.exports = {};" }} compileError={null} />);

    const iframe = screen.getByTitle("Simulation Preview");
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-forms");
  });

  it("accepts messages only from its own iframe window", () => {
    const onTestResult = vi.fn();
    render(
      <SimPreviewFrame
        compiledFiles={{ "index.js": "module.exports = {};" }}
        compileError={null}
        onTestResult={onTestResult}
      />
    );
    const iframe = screen.getByTitle("Simulation Preview") as HTMLIFrameElement;
    const result = { name: "sandbox", passed: true };

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "sim-test-result", result },
        source: window,
      }));
    });
    expect(onTestResult).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "sim-test-result", result },
        source: iframe.contentWindow,
        origin: "https://evil.example",
      }));
    });
    expect(onTestResult).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "sim-test-result", result: { name: "", passed: "yes" } },
        source: iframe.contentWindow,
        origin: "null",
      }));
    });
    expect(onTestResult).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "ARES_TELEMETRY", key: "heading", value: Number.NaN },
        source: iframe.contentWindow,
        origin: "null",
      }));
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "sim-fps", fps: 5000 },
        source: iframe.contentWindow,
        origin: "null",
      }));
      window.dispatchEvent(new MessageEvent("message", {
        data: { type: "sim-test-result", result },
        source: iframe.contentWindow,
        origin: "null",
      }));
    });
    expect(onTestResult).toHaveBeenCalledWith(result);
  });
});
