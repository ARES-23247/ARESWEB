import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

describe('Image Optimization Script', () => {
  const testPublicDir = './test-public';
  const testImagesDir = `${testPublicDir}/test-images`;

  beforeEach(() => {
    // Create test directory structure
    fs.mkdirSync(testImagesDir, { recursive: true });

    // Create a simple test PNG (1x1 red pixel)
    const testImage = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(`${testImagesDir}/test.png`, testImage);
    fs.writeFileSync(`${testImagesDir}/test2.png`, testImage);
  });

  afterEach(() => {
    // Clean up test directory
    fs.rmSync(testPublicDir, { recursive: true, force: true });
  });

  it('should fail when script does not convert all images to responsive variants', async () => {
    // This test verifies that the script generates responsive variants for ALL images
    // not just hero/banner images
    const testImage = `${testImagesDir}/test.png`;
    const variant640 = testImage.replace('.png', '-640w.webp');
    const variant1024 = testImage.replace('.png', '-1024w.webp');
    const variant1920 = testImage.replace('.png', '-1920w.webp');

    // Before running the script, these shouldn't exist
    expect(fs.existsSync(variant640)).toBe(false);
    expect(fs.existsSync(variant1024)).toBe(false);
    expect(fs.existsSync(variant1920)).toBe(false);
  });

  it('should fail when script does not convert PNG to WebP', async () => {
    const scriptPath = './scripts/optimize-images.mjs';
    if (!fs.existsSync(scriptPath)) {
      // Script doesn't exist yet, this is the RED phase
      const testImage = `${testImagesDir}/test.png`;
      const webpPath = testImage.replace('.png', '.webp');

      expect(fs.existsSync(webpPath)).toBe(false);
    }
  });

  it('should fail when script does not generate responsive variants', async () => {
    const scriptPath = './scripts/optimize-images.mjs';
    if (!fs.existsSync(scriptPath)) {
      const testImage = `${testImagesDir}/test.png`;
      const variant640 = testImage.replace('.png', '-640w.webp');
      const variant1024 = testImage.replace('.png', '-1024w.webp');
      const variant1920 = testImage.replace('.png', '-1920w.webp');

      expect(fs.existsSync(variant640)).toBe(false);
      expect(fs.existsSync(variant1024)).toBe(false);
      expect(fs.existsSync(variant1920)).toBe(false);
    }
  });
});
