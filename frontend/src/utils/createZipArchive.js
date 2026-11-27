/**
 * Resolve JSZip across CRA/Webpack CJS interop shapes.
 * Prefer require() so `new JSZip()` always gets the constructor function.
 */
const JSZipLib = require("jszip");
const JSZip =
  typeof JSZipLib === "function"
    ? JSZipLib
    : typeof JSZipLib?.default === "function"
      ? JSZipLib.default
      : JSZipLib?.default?.default;

export function createZipArchive() {
  if (typeof JSZip !== "function") {
    throw new Error("ZIP library failed to load. Please refresh the page and try again.");
  }
  return new JSZip();
}
