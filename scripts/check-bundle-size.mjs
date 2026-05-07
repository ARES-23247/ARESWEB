import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Read baseline config
const baseline = JSON.parse(
  readFileSync('.planning/codebase/BUNDLE-BASELINE.json', 'utf-8')
);

const distDir = join(process.cwd(), 'dist', 'assets');

try {
  const files = readdirSync(distDir);
  let indexSize = 0;
  let vendorSize = 0;

  for (const file of files) {
    const stats = statSync(join(distDir, file));
    if (file.startsWith('index-') && file.endsWith('.js')) {
      indexSize += stats.size;
    } else if (file.includes('vendor-') && file.endsWith('.js')) {
      vendorSize += stats.size;
    }
  }

  const currentSizes = {
    index: indexSize,
    vendor: vendorSize
  };

  let exceeded = false;
  
  for (const [name, currentSize] of Object.entries(currentSizes)) {
    const base = baseline.bundles[name];
    if (!base || currentSize === 0) continue;

    const increase = (currentSize - base.size) / base.size;

    if (increase > baseline.threshold) {
      console.error(`❌ ${name} bundle increased by ${(increase * 100).toFixed(1)}%`);
      console.error(`   Was: ${base.size} bytes. Now: ${currentSize} bytes.`);
      exceeded = true;
    } else if (increase > 0) {
      console.log(`⚠️  ${name} bundle increased by ${(increase * 100).toFixed(1)}%`);
    } else {
      console.log(`✅ ${name} bundle decreased by ${(-increase * 100).toFixed(1)}%`);
    }
  }

  if (exceeded) {
    console.error("Bundle size regression detected!");
    process.exit(1);
  } else {
    console.log("Bundle size checks passed.");
  }
} catch (e) {
  console.log("Could not find dist/assets folder. Make sure to build the project first.");
  console.error(e);
}
