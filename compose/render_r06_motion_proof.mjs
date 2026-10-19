import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const root = "/Users/yurasachenko/ReelsRemotion";
const outputDir = path.join(root, "scratch_check/nikulina_2026/r06_motion_proof");
const output = path.join(outputDir, "r06_visual_presets_motion_proof.mp4");
const tokens = JSON.parse(
  await fs.readFile(path.join(root, "reel-input/_templates/nikulina_style_tokens.json"), "utf8")
);

const fps = 30;
const segments = [
  { id: "preset_1", frames: 131, clip: "001_hook.mp4", seek: 0 },
  { id: "preset_2", frames: 280, clip: "002_second-question.mp4", seek: 0 },
  { id: "preset_3", frames: 130, clip: "003_payoff.mp4", seek: 7.4 },
];
const totalFrames = segments.reduce((sum, segment) => sum + segment.frames, 0);
const clipsDir = path.join(root, "reel-input/r06-what-is-actually-true/public/clips");
const display = "Avenir Next Condensed";
const sans = "Avenir Next";
const nearWhite = tokens.palette.near_white;
const wine = tokens.palette.wine;
const grey = tokens.palette.grey;

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOut = (value) => 1 - (1 - clamp(value)) ** 3;
const elementMotion = (frame, start, duration, segmentFrames, distance = 14) => {
  const enter = easeOut((frame - start) / duration);
  const exit = clamp((segmentFrames - 1 - frame) / 7);
  const opacity = Math.min(enter, exit);
  return { opacity: opacity.toFixed(4), y: ((1 - enter) * distance).toFixed(2) };
};

const group = (motion, body) =>
  `<g opacity="${motion.opacity}" transform="translate(0 ${motion.y})">${body}</g>`;

const svgFrame = (segmentId, localFrame, segmentFrames) => {
  const zone = elementMotion(localFrame, 0, 9, segmentFrames, 0);
  let body = "";

  if (segmentId === "preset_1") {
    const label = elementMotion(localFrame, 0, 10, segmentFrames, 8);
    const l1 = elementMotion(localFrame, 2, 12, segmentFrames, 14);
    const l2 = elementMotion(localFrame, 6, 12, segmentFrames, 14);
    const l3 = elementMotion(localFrame, 10, 12, segmentFrames, 14);
    body = `
      <rect width="1080" height="690" fill="#080808" fill-opacity="${(0.66 * Number(zone.opacity)).toFixed(4)}"/>
      ${group(label, `<text x="96" y="258" font-family="${sans}" font-size="27" font-weight="600" letter-spacing="3.2" fill="${grey}">R06  /  NIKULINA 2026</text>`)}
      ${group(l1, `<text x="96" y="378" font-family="${display}" font-size="112" font-weight="700" fill="${nearWhite}">ЧТО ТЫ</text>`)}
      ${group(l2, `<rect x="96" y="401" width="454" height="112" rx="2" fill="${wine}"/><text x="112" y="494" font-family="${display}" font-size="108" font-weight="700" fill="${nearWhite}">ЗНАЕШЬ</text>`)}
      ${group(l3, `<text x="96" y="616" font-family="${display}" font-size="112" font-weight="700" fill="${nearWhite}">НАВЕРНЯКА?</text>`)}
    `;
  } else if (segmentId === "preset_2") {
    const label = elementMotion(localFrame, 0, 10, segmentFrames, 8);
    const l1 = elementMotion(localFrame, 2, 12, segmentFrames, 12);
    const l2 = elementMotion(localFrame, 5, 12, segmentFrames, 12);
    const l3 = elementMotion(localFrame, 8, 12, segmentFrames, 12);
    const l4 = elementMotion(localFrame, 11, 12, segmentFrames, 10);
    body = `
      <rect width="1080" height="690" fill="#080808" fill-opacity="${(0.66 * Number(zone.opacity)).toFixed(4)}"/>
      ${group(label, `<text x="96" y="258" font-family="${sans}" font-size="27" font-weight="600" letter-spacing="3.2" fill="${grey}">R06  /  NIKULINA 2026</text>`)}
      ${group(l1, `<text x="96" y="344" font-family="${display}" font-size="88" font-weight="700" fill="${nearWhite}">СКОЛЬКО</text>`)}
      ${group(l2, `<rect x="96" y="371" width="846" height="94" rx="2" fill="${wine}"/><text x="108" y="448" font-family="${display}" font-size="80" font-weight="700" fill="${nearWhite}">ДОКАЗАТЕЛЬСТВ</text>`)}
      ${group(l3, `<text x="96" y="548" font-family="${display}" font-size="86" font-weight="700" fill="${nearWhite}">ТЕБЕ НУЖНО,</text>`)}
      ${group(l4, `<text x="96" y="638" font-family="${sans}" font-size="60" font-weight="600" fill="${nearWhite}">чтобы поверить?</text>`)}
    `;
  } else {
    const panel = elementMotion(localFrame, 2, 12, segmentFrames, 14);
    body = group(panel, `
      <rect x="78" y="1386" width="924" height="160" rx="18" fill="#080808" fill-opacity="0.64"/>
      <rect x="78" y="1386" width="8" height="160" rx="4" fill="${wine}"/>
      <text x="540" y="1455" text-anchor="middle" font-family="${sans}" font-size="56" font-weight="600" fill="${nearWhite}">Что этот человек</text>
      <text x="540" y="1521" text-anchor="middle" font-family="${sans}" font-size="56" font-weight="600" fill="${nearWhite}">действительно сделал?</text>
    `);
  }

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      ${body}
    </svg>
  `);
};

await fs.mkdir(outputDir, { recursive: true });
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "r06-motion-proof-"));
const baseVideo = path.join(tempDir, "base.mp4");
const overlayDir = path.join(tempDir, "overlay");
await fs.mkdir(overlayDir);

try {
  const d1 = (segments[0].frames / fps).toFixed(6);
  const d2 = (segments[1].frames / fps).toFixed(6);
  const d3 = (segments[2].frames / fps).toFixed(6);
  const filter = [
    `[0:v]fps=30,trim=end_frame=${segments[0].frames},setpts=PTS-STARTPTS,split=2[b0s][f0s]`,
    "[b0s]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=32,eq=brightness=-0.30:saturation=0.72[b0]",
    "[f0s]scale=1080:608[f0]",
    "[b0][f0]overlay=0:690[v0]",
    `[1:v]fps=30,trim=end_frame=${segments[1].frames},setpts=PTS-STARTPTS,split=2[b1s][f1s]`,
    "[b1s]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=32,eq=brightness=-0.30:saturation=0.72[b1]",
    "[f1s]scale=1080:608[f1]",
    "[b1][f1]overlay=0:690[v1]",
    `[2:v]fps=30,trim=end_frame=${segments[2].frames},setpts=PTS-STARTPTS,split=2[b2s][f2s]`,
    "[b2s]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=32,eq=brightness=-0.30:saturation=0.72[b2]",
    "[f2s]scale=1080:608[f2]",
    "[b2][f2]overlay=0:690[v2]",
    `[0:a]atrim=duration=${d1},asetpts=PTS-STARTPTS[a0]`,
    `[1:a]atrim=duration=${d2},asetpts=PTS-STARTPTS[a1]`,
    `[2:a]atrim=duration=${d3},asetpts=PTS-STARTPTS[a2]`,
    "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]",
  ].join(";");

  run("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error",
    "-t", d1, "-i", path.join(clipsDir, segments[0].clip),
    "-t", d2, "-i", path.join(clipsDir, segments[1].clip),
    "-ss", String(segments[2].seek), "-t", d3, "-i", path.join(clipsDir, segments[2].clip),
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-y", baseVideo,
  ]);

  let absoluteFrame = 0;
  for (const segment of segments) {
    for (let localFrame = 0; localFrame < segment.frames; localFrame += 1) {
      const filename = `overlay_${String(absoluteFrame).padStart(5, "0")}.png`;
      await sharp(svgFrame(segment.id, localFrame, segment.frames))
        .png({ compressionLevel: 6 })
        .toFile(path.join(overlayDir, filename));
      absoluteFrame += 1;
      if (absoluteFrame % 90 === 0) console.log(`overlay progress ${absoluteFrame}/${totalFrames}`);
    }
  }

  run("ffmpeg", [
    "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", baseVideo,
    "-framerate", String(fps), "-start_number", "0", "-i", path.join(overlayDir, "overlay_%05d.png"),
    "-filter_complex", "[0:v][1:v]overlay=0:0:shortest=1:format=auto,setpts=PTS-STARTPTS,fps=30[v]",
    "-map", "[v]", "-map", "0:a:0",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-fps_mode", "cfr", "-r", String(fps),
    "-c:a", "copy", "-movflags", "+faststart", "-frames:v", String(totalFrames), "-y", output,
  ]);

  console.log(`R06 motion proof created: ${output}`);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
