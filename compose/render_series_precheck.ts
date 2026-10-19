import * as fs from "node:fs";
import * as path from "node:path";
import { checkFrame } from "./check";

const timelinePath = process.argv[2];
const outputDir = process.argv[3];
if (!timelinePath || !outputDir) throw new Error("usage: render_series_precheck.ts <timeline.json> <output-dir>");

const timeline = JSON.parse(fs.readFileSync(timelinePath, "utf8"));
const groups = timeline.subtitleLayout?.groups ?? [];
const textTrack = timeline.tracks.find((track: { kind: string }) => track.kind === "text");
const speech = (textTrack?.words ?? []).filter((word: { subtitleRole?: string }) => word.subtitleRole === "speech");
const firstBroll = timeline.tracks
  .filter((track: { kind: string; id?: string }) => track.kind === "image" && String(track.id ?? "").startsWith("broll-"))
  .flatMap((track: { clips?: unknown[] }) => track.clips ?? [])
  .find((clip: { start?: number; end?: number }) => Number.isFinite(Number(clip.start)) && Number.isFinite(Number(clip.end)));
if (!groups.length || !speech.length) throw new Error("timeline has no width-aware speech groups");

const tokenCount = (group: { displayText?: string }) => String(group.displayText ?? "").trim().split(/\s+/u).filter(Boolean).length;
const candidates = [
  groups[0],
  [...groups].sort((a, b) => tokenCount(b) - tokenCount(a))[0],
  [...groups].sort((a, b) => (b.lineCount - a.lineCount) || (a.fontSize - b.fontSize) || (tokenCount(b) - tokenCount(a)))[0],
  groups.at(-1),
];
const selected: typeof groups = [];
for (const candidate of candidates) {
  if (candidate && !selected.some((group: { id: string }) => group.id === candidate.id)) selected.push(candidate);
}
for (const group of groups) {
  if (selected.length >= 4) break;
  if (!selected.some((item: { id: string }) => item.id === group.id)) selected.push(group);
}

fs.mkdirSync(outputDir, { recursive: true });
let outputIndex = 0;
if (firstBroll) {
  const frame = Math.round((Number(firstBroll.start) + Number(firstBroll.end)) / 2);
  const clipId = String(firstBroll.id ?? "broll");
  const output = path.join(outputDir, `${String(++outputIndex).padStart(2, "0")}_${clipId.replace(/[^a-zA-Z0-9_-]+/g, "_")}_f${frame}.png`);
  await checkFrame(timelinePath, frame, { out: output });
  console.log(`PRECHECK frame=${frame} broll=${clipId} output=${output}`);
}
for (const group of selected.slice(0, firstBroll ? 3 : 4)) {
  const words = speech.filter((word: { layoutGroupId?: string }) => word.layoutGroupId === group.id);
  if (!words.length) throw new Error(`no rendered speech words for ${group.id}`);
  const revealFrames = words.flatMap((word: { wordReveals?: { revealFrame: number }[] }) =>
    (word.wordReveals ?? []).map((item) => Number(item.revealFrame)).filter(Number.isFinite)
  );
  if (!revealFrames.length) throw new Error(`no finite reveal frames for ${group.id}`);
  const reveal = Math.max(...revealFrames);
  const ends = words.map((word: { end: number }) => Number(word.end)).filter(Number.isFinite);
  if (!ends.length) throw new Error(`no finite end frame for ${group.id}`);
  const end = Math.min(...ends);
  const frame = Math.max(0, Math.min(end - 1, reveal + 4));
  if (!Number.isFinite(frame)) throw new Error(`non-finite precheck frame for ${group.id}: reveal=${reveal} end=${end}`);
  const output = path.join(outputDir, `${String(++outputIndex).padStart(2, "0")}_${group.id.replace(/[^a-zA-Z0-9_-]+/g, "_")}_f${frame}.png`);
  await checkFrame(timelinePath, frame, { out: output });
  console.log(`PRECHECK frame=${frame} group=${group.id} lines=${group.lineCount} font=${group.fontSize} output=${output}`);
}
console.log(`PRE_RENDER_STILL_COUNT=${outputIndex}`);
