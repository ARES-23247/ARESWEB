import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { compressImage } from './imageProcessor';

// Mock heic2any so we don't need real WASM compilation decoding in our JSdom tests
vi.mock('heic2any', () => {
  return {
    default: vi.fn().mockResolvedValue(new Blob(['mock jpeg'], { type: 'image/jpeg' }))
  };
});

describe('imageProcessor utility', () => {
  let MockImage: any;

  beforeEach(() => {
    // Mock URL functions
    globalThis.URL.createObjectURL = vi.fn(() => 'mock-url') as any;
    globalThis.URL.revokeObjectURL = vi.fn();
    
    // Mock the HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    }) as any);
    
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (this: any, callback) {
      // Mock successful blob creation (size > 1024 to pass our strict checks)
      const mockBlob = new Blob([new ArrayBuffer(2048)], { type: 'image/webp' });
      callback(mockBlob);
    });

    // We must intercept Image constructor to manually trigger loads
    MockImage = class {
      onload!: () => void;
      onerror!: () => void;
      naturalWidth = 1000;
      naturalHeight = 1000;
      src = '';

      set src__trigger(val: string) {
        this.src = val;
        // Auto-trigger load successfully on next tick
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
    
    // Hack wrapper to let us trigger onload
    vi.stubGlobal('Image', function() {
      const img = new MockImage();
      // Setup proxy so when src is assigned, we trigger the load
      return new Proxy(img, {
        set(target, prop, value) {
          if (prop === 'src') {
            target[prop] = value;
            setTimeout(() => {
                if (target.naturalWidth === 0) target.onerror?.();
                else target.onload?.();
            }, 0);
            return true;
          }
          target[prop] = value;
          return true;
        }
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('compresses standard non-HEIC images directly using canvas', async () => {
    const pngFile = new File(['dummy'], 'robot.png', { type: 'image/png' });
    const result = await compressImage(pngFile);
    
    expect(result.ext).toBe('.webp');
    expect(result.blob.size).toBeGreaterThan(1000); // the padded ArrayBuffer
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('attempts native decode first for HEIC files', async () => {
    const heicFile = new File(['dummy'], 'photo.HEIC', { type: 'image/heic' });
    // In our mock, Image loads successfully so native decode works
    
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    const result = await compressImage(heicFile);
    expect(result.ext).toBe('.webp');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Native HEIC decode succeeded'), 'photo.HEIC');
  });

  it('falls back to heic2any software decode if native native canvas decoding fails', async () => {
    // We override our mock Image to simulate a native failure:
    let attempts = 0;
    vi.stubGlobal('Image', function() {
        const img = new MockImage();
        return new Proxy(img, {
          set(target, prop, value) {
            target[prop] = value;
            if (prop === 'src') {
              attempts++;
              if (attempts === 1) {
                setTimeout(() => target.onerror?.(), 0); // Fail first attempt (HEIC)
              } else {
                setTimeout(() => target.onload?.(), 0); // Succeed next attempt (JPEG)
              }
            }
            return true;
          }
        });
      });

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const heicFile = new File(['dummy'], 'photo.heic', { type: 'image/heic' });
    
    const result = await compressImage(heicFile);
    // After software decoding, it runs through the canvas fallback to compress
    expect(result.ext).toBe('.webp');
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Native HEIC decode failed, invoking software fallback:'), 'NATIVE_DECODE_FAILED');
  });
  
  it('rejects if the canvas output is too small (blank layout error)', async () => {
    // Override toBlob to return a tiny blob (e.g. 500 bytes)
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (this: any, callback) {
      callback(new Blob([new ArrayBuffer(500)])); // < 1024 bytes
    });

    const pngFile = new File(['dummy'], 'robot.png', { type: 'image/png' });
    await expect(compressImage(pngFile)).rejects.toThrow('CANVAS_OUTPUT_TOO_SMALL');
  });
});
