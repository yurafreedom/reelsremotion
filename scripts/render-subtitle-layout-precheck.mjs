#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const timelinePath = process.argv[2] ?? "reel-input/r02-connection-without-future/timeline.json";
const outputDir = process.argv[3] ?? "scratch_check/nikulina_2026/r02_width_precheck";
const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
const textTrack = timeline.tracks.find((track) => track.kind === "text");
const checks = [
  { frame: 36, name: "01_opening_1.200.png" },
  { frame: 645, name: "02_former_failure_21.500.png" },
  { frame: 852, name: "03_former_failure_28.400.png" },
  { frame: 1905, name: "04_former_failure_63.500.png" },
];

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

fs.mkdirSync(outputDir, { recursive: true });
for (const check of checks) {
  const active = (textTrack?.words ?? []).filter((word) =>
    word.subtitleRole === "speech" && word.start <= check.frame && word.end > check.frame
  );
  if (!active.length) throw new Error(`no active speech layout at frame ${check.frame}`);
  const safe = active[0].layoutSafeBounds;
  const labels = active.map((word) => {
    const centerX = timeline.width / 2 + word.x;
    const centerY = timeline.height / 2 + word.y;
    const baseline = centerY + word.size * 0.34;
    return `<text x="${centerX}" y="${baseline}" text-anchor="middle" ` +
      `font-family="Avenir Next, Helvetica Neue, Arial, sans-serif" font-size="${word.size}" ` +
      `font-weight="${word.weight}" fill="#F7F4EF">${escapeXml(word.text)}</text>`;
  }).join("");
  const group = active[0].layoutGroupId;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${timeline.width}" height="${timeline.height}">` +
    `<rect width="100%" height="100%" fill="#171717"/>` +
    `<rect x="${safe.left}" y="${safe.top}" width="${safe.right - safe.left}" height="${safe.bottom - safe.top}" ` +
    `fill="none" stroke="#7A1F32" stroke-width="3" stroke-dasharray="12 10"/>` +
    `<text x="${safe.left}" y="${safe.top - 24}" font-family="monospace" font-size="22" fill="#B9B5B0">` +
    `${escapeXml(group)} • frame ${check.frame} • fixed final page</text>` +
    labels + `</svg>`
  );
  const output = path.join(outputDir, check.name);
  await sharp(svg).png().toFile(output);
  console.log(`LAYOUT_PRECHECK frame=${check.frame} group=${group} output=${output}`);
}
console.log(`R02_WIDTH_PRECHECK_COUNT=${checks.length}`);
