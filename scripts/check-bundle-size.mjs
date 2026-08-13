import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const config = JSON.parse(
  readFileSync("config/bundle-budgets.json", "utf-8"),
);
const distDir = join(process.cwd(), "dist");
const assetsDir = join(distDir, "assets");

function assetSize(filename) {
  const contents = readFileSync(join(assetsDir, filename));
  return { raw: contents.length, gzip: gzipSync(contents).length };
}

function sumAssets(filenames) {
  return filenames.reduce(
    (total, filename) => {
      const size = assetSize(filename);
      total.raw += size.raw;
      total.gzip += size.gzip;
      return total;
    },
    { raw: 0, gzip: 0 },
  );
}

try {
  const html = readFileSync(join(distDir, "index.html"), "utf-8");
  const initialAssets = new Set(
    [...html.matchAll(/(?:src|href)=["']\/assets\/([^"'?]+)["']/g)].map(
      (match) => match[1],
    ),
  );
  const initialJs = [...initialAssets].filter((file) => file.endsWith(".js"));
  const initialCss = [...initialAssets].filter((file) => file.endsWith(".css"));
  const lazyJs = readdirSync(assetsDir).filter(
    (file) => file.endsWith(".js") && !initialAssets.has(file),
  );
  const editorRuntimePattern = /^(?:ts|css|html|json|editor)\.worker-|^editor\.api-|^initialize-|^toggleHighContrast-|^monaco-vim\.|^vendor-(?:monaco|babel|prettier)-/;
  const routeLazyJs = lazyJs.filter((file) => !editorRuntimePattern.test(file));
  const editorRuntimeJs = lazyJs.filter((file) => editorRuntimePattern.test(file));
  const largestEditor = editorRuntimeJs
    .map((file) => ({ file, ...assetSize(file) }))
    .sort((a, b) => b.raw - a.raw)[0] ?? { file: "none", raw: 0, gzip: 0 };

  const largestLazy = routeLazyJs
    .map((file) => ({ file, ...assetSize(file) }))
    .sort((a, b) => b.raw - a.raw)[0] ?? { file: "none", raw: 0, gzip: 0 };

  const measurements = {
    initialJs: sumAssets(initialJs),
    initialCss: sumAssets(initialCss),
    largestLazyJs: largestLazy,
    totalRouteJs: sumAssets([...initialJs, ...routeLazyJs]),
    editorRuntimeJs: sumAssets(editorRuntimeJs),
    largestEditorJs: largestEditor,
  };

  let exceeded = false;
  for (const [name, measurement] of Object.entries(measurements)) {
    const budget = config.budgets[name];
    if (!budget) continue;

    const label = name === "largestLazyJs"
      ? `${name} (${largestLazy.file})`
      : name === "largestEditorJs"
        ? `${name} (${largestEditor.file})`
        : name;
    const overRaw = measurement.raw > budget.raw;
    const overGzip = measurement.gzip > budget.gzip;
    const marker = overRaw || overGzip ? "FAIL" : "PASS";
    console.log(
      `${marker} ${label}: ${measurement.raw} raw / ${measurement.gzip} gzip bytes ` +
      `(budgets ${budget.raw} / ${budget.gzip})`,
    );
    exceeded ||= overRaw || overGzip;
  }

  if (exceeded) {
    console.error("Bundle size budget exceeded.");
    process.exit(1);
  }
  console.log("Bundle size checks passed.");
} catch (error) {
  console.error("Bundle size check could not inspect dist/assets. Build first.");
  console.error(error);
  process.exit(1);
}
