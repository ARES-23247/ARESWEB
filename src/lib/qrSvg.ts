/**
 * Zero-network ISO/IEC 18004 QR Code matrix & SVG path generator
 * (Versions 1–4, Byte Mode, Error Correction Level L, Mask 0).
 */

export interface QrMatrix {
  version: number;
  size: number;
  modules: boolean[][];
}

interface VersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignmentCenter: number | null;
}

const VERSION_SPECS: readonly VersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignmentCenter: null },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignmentCenter: 18 },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignmentCenter: 22 },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignmentCenter: 26 },
];

// Format bits for ECC Level L (01) + Mask 0 (000) with BCH(15,5) ^ 0x5412 = 0x77C4
const FORMAT_BITS_L_MASK_0 = 0x77c4;

function gfMul(x: number, y: number): number {
  let result = 0;
  let a = x;
  let b = y;
  for (let i = 0; i < 8; i += 1) {
    if ((b & 1) !== 0) {
      result ^= a;
    }
    const hiBit = a & 0x80;
    a = (a << 1) & 0xff;
    if (hiBit !== 0) {
      a ^= 0x1d;
    }
    b >>= 1;
  }
  return result;
}

function buildReedSolomonDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function computeReedSolomonRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const divisor = buildReedSolomonDivisor(ecLen);
  const remainder = new Uint8Array(ecLen);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecLen - 1] = 0;
    for (let i = 0; i < ecLen; i += 1) {
      remainder[i] ^= gfMul(divisor[i], factor);
    }
  }
  return remainder;
}

function buildCodewords(bytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit length
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const capacityBits = spec.dataCodewords * 8;
  const terminatorLen = Math.min(4, capacityBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const data = new Uint8Array(spec.dataCodewords);
  const byteCount = bits.length / 8;
  for (let i = 0; i < byteCount; i += 1) {
    let val = 0;
    for (let b = 0; b < 8; b += 1) {
      val = (val << 1) | bits[i * 8 + b];
    }
    data[i] = val;
  }

  for (let i = byteCount; i < spec.dataCodewords; i += 1) {
    data[i] = (i - byteCount) % 2 === 0 ? 0xec : 0x11;
  }

  const ec = computeReedSolomonRemainder(data, spec.ecCodewords);
  const full = new Uint8Array(spec.dataCodewords + spec.ecCodewords);
  full.set(data, 0);
  full.set(ec, spec.dataCodewords);
  return full;
}

export function encodeQrMatrix(text: string): QrMatrix {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("QR payload must be non-empty.");
  }
  const bytes = new TextEncoder().encode(trimmed);
  const spec = VERSION_SPECS.find((s) => bytes.length <= s.dataCodewords - 2);
  if (!spec) {
    throw new Error(`Payload length (${bytes.length} bytes) exceeds QR capacity.`);
  }

  const { size, alignmentCenter } = spec;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Finder patterns + 1-module white separators
  const placeFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr += 1) {
      for (let dc = -1; dc <= 7; dc += 1) {
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && dist !== 2;
        setFunctionModule(top + dr, left + dc, dark);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setFunctionModule(6, i, dark);
    setFunctionModule(i, 6, dark);
  }

  // Alignment pattern for Versions 2–4
  if (alignmentCenter !== null) {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const dist = Math.max(Math.abs(dr), Math.abs(dc));
        setFunctionModule(alignmentCenter + dr, alignmentCenter + dc, dist !== 1);
      }
    }
  }

  // Fixed dark module + reserve format areas
  setFunctionModule(size - 8, 8, true);
  const topLeftFormatCoords: Array<[number, number]> = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i += 1) {
    const bit = ((FORMAT_BITS_L_MASK_0 >>> (14 - i)) & 1) === 1;
    const [r, c] = topLeftFormatCoords[i];
    setFunctionModule(r, c, bit);
    if (i < 7) {
      setFunctionModule(size - 1 - i, 8, bit);
    } else {
      setFunctionModule(8, size - 15 + i, bit);
    }
  }

  // Place data + ECC codewords in 2-column upward/downward zig-zag with Mask 0
  const codewords = buildCodewords(bytes, spec);
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) {
      rightCol = 5;
    }
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let colOffset = 0; colOffset < 2; colOffset += 1) {
        const col = rightCol - colOffset;
        if (!isFunction[row][col]) {
          let dark = false;
          if (bitIndex < totalBits) {
            const byte = codewords[bitIndex >>> 3];
            dark = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
            bitIndex += 1;
          }
          // Mask 0: (row + col) % 2 === 0
          if ((row + col) % 2 === 0) {
            dark = !dark;
          }
          modules[row][col] = dark;
        }
      }
    }
    upward = !upward;
  }

  return { version: spec.version, size, modules };
}

export function qrMatrixToSvgPath(matrix: QrMatrix, quietZone = 2): string {
  const segments: string[] = [];
  for (let r = 0; r < matrix.size; r += 1) {
    for (let c = 0; c < matrix.size; c += 1) {
      if (matrix.modules[r][c]) {
        segments.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
      }
    }
  }
  return segments.join("");
}
