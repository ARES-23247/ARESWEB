import { describe, expect, it } from "vitest";
import { encodeQrMatrix, qrMatrixToSvgPath } from "@/lib/qrSvg";

describe("Zero-network ISO/IEC 18004 QR SVG encoder", () => {
  it("encodes short and canonical robot/sponsor URLs across QR Versions 1-4 with finder patterns", () => {
    const v1 = encodeQrMatrix("ARES-23247");
    expect(v1.size).toBe(21);

    const v3 = encodeQrMatrix("https://aresfirst.org/robots/ares-mk4");
    expect(v3.size).toBe(29);

    const v4 = encodeQrMatrix(
      "https://aresfirst.org/robots/ares-mk4-championship-configuration?view=pit",
    );
    expect(v4.size).toBe(33);

    // Top-left, top-right, and bottom-left 7x7 finder corners must be dark
    expect(v3.modules[0][0]).toBe(true);
    expect(v3.modules[0][6]).toBe(true);
    expect(v3.modules[6][0]).toBe(true);
    expect(v3.modules[3][3]).toBe(true);
    expect(v3.modules[0][v3.size - 1]).toBe(true);
    expect(v3.modules[v3.size - 1][0]).toBe(true);

    const pathD = qrMatrixToSvgPath(v3);
    expect(pathD.startsWith("M")).toBe(true);
    expect(pathD).toContain("h1v1h-1z");
  });

  it("encodes long canonical robot URLs across QR Versions 5-L and 6-L (with 2-block RS interleaving)", () => {
    const v5Url = `https://aresfirst.org/robots/${"championship-robot-".repeat(3)}v5`;
    expect(new TextEncoder().encode(v5Url).length).toBeGreaterThan(78);
    expect(new TextEncoder().encode(v5Url).length).toBeLessThanOrEqual(106);
    const v5 = encodeQrMatrix(v5Url);
    expect(v5.size).toBe(37);
    expect(v5.modules[0][0]).toBe(true);
    expect(v5.modules[30][30]).toBe(true); // Version 5 alignment center

    const v6Url = `https://aresfirst.org/robots/${"a".repeat(98)}`;
    expect(new TextEncoder().encode(v6Url).length).toBe(127);
    const v6 = encodeQrMatrix(v6Url);
    expect(v6.size).toBe(41);
    expect(v6.modules[0][0]).toBe(true);
    expect(v6.modules[34][34]).toBe(true); // Version 6 alignment center
    expect(qrMatrixToSvgPath(v6)).toContain("h1v1h-1z");
  });

  it("rejects empty or oversize payloads cleanly", () => {
    expect(() => encodeQrMatrix("")).toThrow(/non-empty/i);
    expect(() => encodeQrMatrix("x".repeat(135))).toThrow(/exceeds QR capacity/i);
  });
});
