// Pure helpers for job photos (no server-only imports, so they can be unit tested).

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MAX_PER_JOB = 40;
export const PHOTO_DEFAULT_DAYS = 30;
export const PHOTO_UPLOADS_PER_HOUR = 80;
export const GALLERY_MAX_DAYS = 30;

export const isJpeg = (b: Uint8Array) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * Removes metadata segments (EXIF incl. GPS location, XMP, comments, ICC) from a JPEG, keeping only what is needed
 * to draw it. The browser already re-encodes photos (which drops metadata); this is the server-side guarantee.
 * Returns null if the bytes aren't a well-formed JPEG.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array | null {
  if (!isJpeg(input)) return null;
  const out: number[] = [0xff, 0xd8];
  const chunks: Uint8Array[] = [];
  let i = 2;
  const n = input.length;
  while (i < n) {
    if (input[i] !== 0xff) return null;
    // Skip fill bytes.
    while (i < n && input[i] === 0xff) i++;
    const marker = input[i++];
    if (marker === undefined) return null;
    if (marker === 0xd9) break; // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue; // standalone markers
    if (i + 2 > n) return null;
    const len = (input[i] << 8) | input[i + 1];
    if (len < 2 || i + len > n) return null;
    const segment = input.subarray(i - 2, i + len); // marker bytes (0xff, marker) + length + payload
    const isMeta = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe; // APP1-APP15 and COM; keep APP0 (JFIF)
    if (marker === 0xda) {
      // Start of scan: the rest of the file is entropy-coded image data up to EOI. Keep it as it is.
      chunks.push(input.subarray(i - 2, n));
      const head = Uint8Array.from(out);
      const total = chunks.reduce((s, c) => s + c.length, head.length);
      const res = new Uint8Array(total);
      res.set(head, 0);
      let o = head.length;
      for (const c of chunks) {
        res.set(c, o);
        o += c.length;
      }
      return res;
    }
    if (!isMeta) {
      chunks.push(segment);
    }
    i += len;
  }
  return null; // never reached a scan: not a usable image
}

/** Reads the pixel size from the first SOF marker, or null. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}

// --- Store-only ZIP writer (photos are already compressed, so no deflate is needed). ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_"));
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true);
    lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, f.data);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + f.data.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Whole days left before a photo is cleaned up (never negative). */
export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}
