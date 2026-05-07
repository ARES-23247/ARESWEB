import sharp from 'sharp';
import { glob } from 'glob';
import fs from 'fs';
import path from 'path';

// Find all PNG and JPG images in public directory
const images = await glob('public/**/*.{png,jpg,jpeg}');
const sizes = [640, 1024, 1920]; // Per plan: 3 responsive variants

console.log(`Found ${images.length} images to optimize.`);

let totalOriginalSize = 0;
let totalWebpSize = 0;
let filesProcessed = 0;

for (const imagePath of images) {
  const parsedPath = path.parse(imagePath);

  // Skip if already generated and newer than source
  const webpPath = path.join(parsedPath.dir, `${parsedPath.name}.webp`);
  if (fs.existsSync(webpPath) && fs.statSync(webpPath).mtime > fs.statSync(imagePath).mtime) {
    console.log(`Skipping (already optimized): ${imagePath}`);
    continue;
  }

  console.log(`Optimizing: ${imagePath}`);

  try {
    const originalStats = fs.statSync(imagePath);
    totalOriginalSize += originalStats.size;

    // 1. Generate standard WebP replacement (same dimensions) at 85% quality
    const webpInfo = await sharp(imagePath)
      .webp({ quality: 85 })
      .toFile(webpPath);

    totalWebpSize += webpInfo.size;

    // 2. Generate responsive variants for ALL images (per plan requirement)
    for (const size of sizes) {
      const variantPath = path.join(parsedPath.dir, `${parsedPath.name}-${size}w.webp`);
      await sharp(imagePath)
        .resize(size, null, { // Resize to width, maintain aspect ratio
          withoutEnlargement: true, // Don't upscale smaller images
          fit: 'inside'
        })
        .webp({ quality: 85 })
        .toFile(variantPath);
    }

    filesProcessed++;
    console.log(`Generated WebP + 3 responsive variants for: ${imagePath}`);
  } catch (error) {
    console.error(`Error optimizing ${imagePath}:`, error);
  }
}

const totalKbSaved = Math.round((totalOriginalSize - totalWebpSize) / 1024);
const percentSaved = totalOriginalSize > 0 ? Math.round((1 - totalWebpSize / totalOriginalSize) * 100) : 0;

console.log(`\n=== Image Optimization Summary ===`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Original size: ${Math.round(totalOriginalSize / 1024)}KB`);
console.log(`WebP size: ${Math.round(totalWebpSize / 1024)}KB`);
console.log(`Space saved: ${totalKbSaved}KB (${percentSaved}%)`);
console.log(`===================================\n`);
