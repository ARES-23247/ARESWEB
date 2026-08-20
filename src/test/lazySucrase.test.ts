import { describe, expect, it } from "vitest";
import { transformSimulationSource } from "@/utils/lazySucrase";

describe("transformSimulationSource", () => {
  it("compiles TSX and CommonJS module exports for the preview runtime", async () => {
    const output = await transformSimulationSource(
      `import React from "react";
       interface Props { label: string }
       export default function Sim({ label }: Props) {
         return <section>{label}</section>;
       }`,
      "SimComponent.tsx",
    );

    const reactModule = {
      createElement: (tag: string, props: unknown, child: unknown) => ({
        tag,
        props,
        child,
      }),
    };
    const module = {
      exports: {} as { default?: (props: { label: string }) => unknown },
    };
    const requireModule = (name: string) => {
      if (name !== "react") throw new Error(`Unexpected module: ${name}`);
      return { __esModule: true, default: reactModule };
    };

    new Function("require", "module", "exports", output)(
      requireModule,
      module,
      module.exports,
    );

    expect(module.exports.default?.({ label: "Ready" })).toEqual({
      tag: "section",
      props: null,
      child: "Ready",
    });
    expect(output).not.toContain("interface Props");
  });

  it("preserves modern browser syntax while compiling local imports", async () => {
    const output = await transformSimulationSource(
      `import { helper } from "./helper.js";
       export const result = helper()?.value ?? 0;`,
      "logic.js",
    );

    const module = { exports: {} as { result?: number } };
    const requireModule = (name: string) => {
      if (name !== "./helper.js") throw new Error(`Unexpected module: ${name}`);
      return { helper: () => ({ value: 42 }) };
    };

    new Function("require", "module", "exports", output)(
      requireModule,
      module,
      module.exports,
    );

    expect(module.exports.result).toBe(42);
    expect(output).toContain("?.value ?? 0");
  });

  it("reports malformed simulator source instead of returning unusable input", async () => {
    await expect(
      transformSimulationSource("export default function (", "broken.tsx"),
    ).rejects.toThrow();
  });
});
