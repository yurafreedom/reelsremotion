#!/usr/bin/env node

// Lightweight, local-font text measurement for the subtitle compiler.
// No browser, Studio, server, or render is started: sharp/librsvg resolves the
// same local Avenir families used by the Nikulina renderer and returns ink bounds.

import sharp from "sharp";

const FONT_FAMILIES = {
  nikulinaSans: "Avenir Next, Helvetica Neue, Arial, sans-serif",
  nikulinaCondensed: "Avenir Next Condensed, DIN Condensed, Arial Narrow, sans-serif",
  cleanSans: "Inter, sans-serif",
  condensedHeavy: "Oswald, sans-serif",
  unbounded: "Unbounded, sans-serif",
  onest: "Onest, sans-serif",
  playfairItalic: "Playfair Display, serif",
};

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const input = await new Promise((resolve, reject) => {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { raw += chunk; });
  process.stdin.on("end", () => {
    try { resolve(JSON.parse(raw)); }
    catch (error) { reject(error); }
  });
  process.stdin.on("error", reject);
});

const output = {};
for (const item of input.items ?? []) {
  const family = FONT_FAMILIES[item.font] ?? FONT_FAMILIES.cleanSans;
  const text = item.case === "upper" ? String(item.text).toUpperCase() : String(item.text);
  const size = Number(item.size);
  const weight = Number(item.weight ?? 600);
  const fontStyle = item.font === "playfairItalic" ? "italic" : "normal";
  const canvasWidth = Math.max(2048, Math.ceil(text.length * size * 1.4 + 256));
  const canvasHeight = Math.max(256, Math.ceil(size * 3.5));
  const baseline = Math.ceil(size * 2.25);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">` +
    `<rect width="100%" height="100%" fill="rgba(0,0,0,0)"/>` +
    `<text x="96" y="${baseline}" font-family="${escapeXml(family)}" ` +
    `font-size="${size}" font-weight="${weight}" font-style="${fontStyle}" ` +
    `letter-spacing="0" fill="white">${escapeXml(text)}</text></svg>`
  );
  const { info } = await sharp(svg)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });
  output[item.id] = { width: info.width, height: info.height };
}

process.stdout.write(`${JSON.stringify(output)}\n`);
