import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { crc32, daysLeft, isJpeg, jpegSize, stripJpegMetadata, zipStore } from "../src/lib/photoFiles.ts";

// A tiny real JPEG made with sharp, plus a hand-built EXIF-style APP1 segment with fake GPS text to make sure it's removed.
const jpegB64 = execFileSync("node", ["-e", `require("sharp")({create:{width:40,height:30,channels:3,background:"#3a7"}}).jpeg().toBuffer().then(b=>process.stdout.write(b.toString("base64")))`], { cwd: process.cwd() }).toString();
const base = new Uint8Array(Buffer.from(jpegB64, "base64"));

function withApp1(src: Uint8Array, text: string): Uint8Array {
  const payload = Buffer.from("Exif\0\0" + text);
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
  return new Uint8Array(Buffer.concat([Buffer.from(src.subarray(0, 2)), seg, Buffer.from(src.subarray(2))]));
}

test("a real jpeg is recognised and sized", () => {
  assert.ok(isJpeg(base));
  assert.deepEqual(jpegSize(base), { width: 40, height: 30 });
});

test("non-jpeg files are rejected", () => {
  assert.equal(stripJpegMetadata(new Uint8Array(Buffer.from("GIF89a....."))), null);
  assert.equal(stripJpegMetadata(new Uint8Array(Buffer.from("<html>not an image</html>"))), null);
  assert.equal(stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff])), null);
  assert.equal(stripJpegMetadata(new Uint8Array(0)), null);
});

test("location/EXIF segments are removed and the picture is unchanged", () => {
  const dirty = withApp1(base, "GPSLatitude -37.8136 GPSLongitude 144.9631");
  assert.ok(Buffer.from(dirty).includes("GPSLatitude"));
  const clean = stripJpegMetadata(dirty)!;
  assert.ok(clean);
  assert.ok(!Buffer.from(clean).includes("GPSLatitude"));
  assert.ok(!Buffer.from(clean).includes("Exif"));
  assert.deepEqual(jpegSize(clean), { width: 40, height: 30 });
  // still decodes
  const out = execFileSync("node", ["-e", `require("sharp")(Buffer.from("${Buffer.from(clean).toString("base64")}","base64")).metadata().then(m=>process.stdout.write(m.width+"x"+m.height))`], { cwd: process.cwd() }).toString();
  assert.equal(out, "40x30");
});

test("a truncated or garbled jpeg is rejected rather than stored", () => {
  assert.equal(stripJpegMetadata(base.subarray(0, 20)), null);
});

test("zip has correct structure and checksums", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const zip = zipStore([{ name: "before-1.jpg", data: new Uint8Array([1, 2, 3]) }, { name: "../evil/after.jpg", data: new Uint8Array([4, 5]) }]);
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(zip.length - 22 + 10, true), 2);
  assert.ok(!Buffer.from(zip).includes("../"), "path separators in names are neutralised");
});

test("days left never goes negative", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");
  assert.equal(daysLeft("2026-11-20T00:00:00Z", now), 10);
  assert.equal(daysLeft("2026-11-01T00:00:00Z", now), 0);
});
