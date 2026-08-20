import type { Transform, transform as sucraseTransform } from "sucrase";

let transformerPromise: Promise<typeof sucraseTransform> | null = null;

async function loadTransformer(): Promise<typeof sucraseTransform> {
  transformerPromise ??= import("sucrase").then(({ transform }) => transform);
  return transformerPromise;
}

function transformsFor(filename: string): Transform[] {
  const transforms: Transform[] = ["imports"];
  if (/\.[jt]sx$/iu.test(filename)) transforms.push("jsx");
  if (/\.tsx?$/iu.test(filename)) transforms.push("typescript");
  return transforms;
}

/**
 * Compiles one simulator source file for the opaque preview module runtime.
 * Sucrase removes TS/JSX syntax and converts ESM imports to CommonJS while
 * leaving modern browser-supported JavaScript intact.
 */
export async function transformSimulationSource(
  code: string,
  filename: string,
): Promise<string> {
  const transform = await loadTransformer();
  return transform(code, {
    transforms: transformsFor(filename),
    filePath: filename,
    jsxRuntime: "classic",
    production: true,
    disableESTransforms: true,
  }).code;
}
