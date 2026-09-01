import type { LocalImageResult } from "../../core/types";

const imp560BenchmarkScenario = "imp-560-main-viewer-render";
const imp560BenchmarkRasterPrefix = "/workspace/docs/assets/imp-560-raster-";
const imp560BenchmarkRasterCache = new Map<string, string>();
let imp560BenchmarkScenarioSearch: string | null = null;
let imp560BenchmarkScenarioEnabled = false;

function isImp560BenchmarkScenario(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const search = window.location.search;
  if (search !== imp560BenchmarkScenarioSearch) {
    imp560BenchmarkScenarioSearch = search;
    imp560BenchmarkScenarioEnabled =
      new URLSearchParams(search).get("scenario") === imp560BenchmarkScenario;
  }
  return imp560BenchmarkScenarioEnabled;
}

function writeUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function crc32(parts: readonly Uint8Array[]): number {
  let crc = 0xffffffff;
  for (const part of parts) {
    for (const byte of part) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let first = 1;
  let second = 0;
  for (const byte of bytes) {
    first = (first + byte) % 65_521;
    second = (second + first) % 65_521;
  }
  return ((second << 16) | first) >>> 0;
}

function uncompressedZlib(bytes: Uint8Array): Uint8Array {
  const blockCount = Math.ceil(bytes.byteLength / 65_535);
  const encoded = new Uint8Array(2 + bytes.byteLength + blockCount * 5 + 4);
  encoded[0] = 0x78;
  encoded[1] = 0x01;
  let sourceOffset = 0;
  let targetOffset = 2;
  for (let block = 0; block < blockCount; block += 1) {
    const length = Math.min(65_535, bytes.byteLength - sourceOffset);
    encoded[targetOffset] = block + 1 === blockCount ? 0x01 : 0x00;
    encoded[targetOffset + 1] = length & 0xff;
    encoded[targetOffset + 2] = (length >>> 8) & 0xff;
    const complement = ~length & 0xffff;
    encoded[targetOffset + 3] = complement & 0xff;
    encoded[targetOffset + 4] = (complement >>> 8) & 0xff;
    targetOffset += 5;
    encoded.set(
      bytes.subarray(sourceOffset, sourceOffset + length),
      targetOffset,
    );
    sourceOffset += length;
    targetOffset += length;
  }
  writeUint32BigEndian(encoded, targetOffset, adler32(bytes));
  return encoded;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.byteLength);
  writeUint32BigEndian(chunk, 0, data.byteLength);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32BigEndian(chunk, 8 + data.byteLength, crc32([typeBytes, data]));
  return chunk;
}

function concatenateBytes(parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.byteLength; offset += 32_768) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, Math.min(bytes.byteLength, offset + 32_768)),
    );
  }
  return btoa(binary);
}

function createImp560BenchmarkRaster(
  width: number,
  height: number,
  seed: number,
): string {
  const rowLength = 1 + width * 4;
  const pixels = new Uint8Array(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    pixels[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 4;
      pixels[pixelOffset] = (x + seed * 17) & 0xff;
      pixels[pixelOffset + 1] = (y + seed * 31) & 0xff;
      pixels[pixelOffset + 2] = (x ^ y ^ seed) & 0xff;
      pixels[pixelOffset + 3] = 0xff;
    }
  }
  const header = new Uint8Array(13);
  writeUint32BigEndian(header, 0, width);
  writeUint32BigEndian(header, 4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const png = concatenateBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", uncompressedZlib(pixels)),
    pngChunk("IEND", new Uint8Array()),
  ]);
  return bytesToBase64(png);
}

export function resolveImp560BenchmarkRaster(
  path: string,
): LocalImageResult | null {
  if (
    !path.startsWith(imp560BenchmarkRasterPrefix) ||
    !isImp560BenchmarkScenario()
  ) {
    return null;
  }
  const uniqueMatch =
    /^\/workspace\/docs\/assets\/imp-560-raster-([1-6])\.png$/u.exec(path);
  const isLarge = path === `${imp560BenchmarkRasterPrefix}near-5-mib.png`;
  if (!uniqueMatch && !isLarge) {
    return null;
  }
  let content = imp560BenchmarkRasterCache.get(path);
  if (!content) {
    content = isLarge
      ? createImp560BenchmarkRaster(1280, 960, 97)
      : createImp560BenchmarkRaster(320, 180, Number(uniqueMatch?.[1] ?? 1));
    imp560BenchmarkRasterCache.set(path, content);
  }
  return {
    status: "resolved",
    mediaType: "image/png",
    encoding: "base64",
    resolvedPath: path,
    content,
  };
}
