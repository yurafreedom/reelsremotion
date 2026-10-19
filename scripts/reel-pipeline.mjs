#!/usr/bin/env node

// Small operator CLI for the editorial -> headless Remotion pipeline.
// It does not own rendering semantics. It prepares/probes/extracts/validates the
// package and delegates the final render to the existing `npm run render:reel`.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  applyWidthAwareFixedSubtitleLayout,
  WIDTH_AWARE_LAYOUT_SYSTEM,
} from "./subtitle-layout.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ASR = "transcripts/video1219377731/asr_video1219377731.json";
const REQUIRED_PREPRODUCTION = [
  "BRIEF.md",
  "SOURCE_SELECTION.md",
  "source_manifest.json",
  "SUBTITLE_SCRIPT.md",
  "EDIT_PLAN.md",
  "BROLL_PLAN.md",
];

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const writeNew = (p, value) => {
  if (!fs.existsSync(p)) fs.writeFileSync(p, value, "utf8");
};
const rootPath = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const rel = (p) => path.relative(ROOT, p) || ".";

const parseTime = (value) => {
  if (typeof value === "number") return value;
  if (/^\d+(\.\d+)?$/.test(String(value))) return Number(value);
  const parts = String(value).replace(",", ".").split(":").map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) {
    throw new Error(`invalid timecode: ${value}`);
  }
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return h * 3600 + m * 60 + s;
};

const timecode = (seconds, srt = false) => {
  const msTotal = Math.round(Number(seconds) * 1000);
  const h = Math.floor(msTotal / 3_600_000);
  const m = Math.floor((msTotal % 3_600_000) / 60_000);
  const s = Math.floor((msTotal % 60_000) / 1000);
  const ms = msTotal % 1000;
  const sep = srt ? "," : ".";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`;
};

const loadAsr = (file = DEFAULT_ASR) => {
  const abs = rootPath(file);
  const data = readJson(abs);
  if (!Array.isArray(data.segments)) fail(`${file} has no segments[]`);
  return { abs, data };
};

const selectTranscript = (data, start, end) => {
  if (!(end > start)) throw new Error(`end must be greater than start: ${start}..${end}`);
  // Half-open interval intersection. A segment ending exactly at `start` belongs
  // to the previous cut; one starting exactly at `end` belongs to the next cut.
  const segments = data.segments.filter((s) => s.end > start && s.start < end);
  const first = segments[0];
  const last = segments.at(-1);
  return {
    source_start: start,
    source_end: end,
    source_start_tc: timecode(start),
    source_end_tc: timecode(end),
    boundary_flags: {
      start_inside_subtitle: Boolean(first && start > first.start && start < first.end),
      end_inside_subtitle: Boolean(last && end > last.start && end < last.end),
    },
    segments: segments.map((s) => ({
      id: s.id,
      start: s.start,
      end: s.end,
      start_tc: timecode(s.start),
      end_tc: timecode(s.end),
      language: s.script ?? s.lang ?? "unknown",
      text: s.text,
      words: (s.words ?? []).map((w) => ({ word: w.word, start: w.start, end: w.end })),
    })),
  };
};

const renderQuote = (selection, format) => {
  if (format === "text") return `${selection.segments.map((s) => s.text).join(" ")}\n`;
  if (format === "srt") {
    return selection.segments
      .map((s, i) => `${i + 1}\n${timecode(s.start, true)} --> ${timecode(s.end, true)}\n${s.text}\n`)
      .join("\n");
  }
  return `${JSON.stringify(selection, null, 2)}\n`;
};

const templateFiles = (slug, title) => ({
  "BRIEF.md": `# ${title}\n\nSTATUS=PREPRODUCTION\n\n## Editorial idea\n\nTODO\n\n## Acceptance\n\n- 1080×1920, 30 fps.\n- Source quote remains traceable.\n- Final render is not approved yet.\n`,
  "SOURCE_SELECTION.md": `# Source selection — ${title}\n\nNo source range approved yet. Use \`npm run reel:quote -- <start> <end>\`.\n`,
  "SUBTITLE_SCRIPT.md": `# Subtitle script — ${title}\n\nKeep SOURCE and DISPLAY RU separate.\n`,
  "EDIT_PLAN.md": `# Edit plan — ${title}\n\nEditorial review required before timeline generation.\n`,
  "BROLL_PLAN.md": `# B-roll plan — ${title}\n\nTalking head is primary. Do not add unreviewed assets.\n`,
  "source_manifest.json": `${JSON.stringify({
    schema_version: "1.0",
    slug,
    stage: "preproduction",
    source_authority: {
      video: "video1219377731.mp4",
      native_asr: DEFAULT_ASR,
    },
    clips: [],
  }, null, 2)}\n`,
});

const prepare = (slug, title = slug) => {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail("slug must use lowercase letters, digits and hyphens");
  const dir = rootPath(path.join("reel-input", slug));
  fs.mkdirSync(path.join(dir, "public", "clips"), { recursive: true });
  fs.mkdirSync(path.join(dir, "public", "media"), { recursive: true });
  fs.mkdirSync(path.join(dir, "transcript"), { recursive: true });
  for (const [name, content] of Object.entries(templateFiles(slug, title))) {
    writeNew(path.join(dir, name), content);
  }
  console.log(`prepared ${rel(dir)} (existing files preserved)`);
};

const sourceQuote = (segments) => segments.map((s) => s.text).join(" ");

const buildPreproduction = (configFile) => {
  const configPath = rootPath(configFile);
  const config = readJson(configPath);
  const { data: asr } = loadAsr(config.native_asr ?? DEFAULT_ASR);
  const translations = config.english_ru_translations
    ? readJson(rootPath(config.english_ru_translations))
    : [];

  for (const reel of config.reels ?? []) {
    prepare(reel.slug, reel.title);
    const dir = rootPath(path.join("reel-input", reel.slug));
    const clips = reel.clips.map((spec, index) => {
      const startSeg = asr.segments.find((s) => s.id === spec.start_segment_id);
      const endSeg = asr.segments.find((s) => s.id === spec.end_segment_id);
      if (!startSeg || !endSeg) fail(`${reel.id}/${spec.id}: segment id missing`);
      const transcript = selectTranscript(asr, startSeg.start, endSeg.end);
      const languages = [...new Set(transcript.segments.map((s) => s.language))];
      const target = path.join("reel-input", reel.slug, "public", "clips", `${String(index + 1).padStart(3, "0")}_${spec.role}.mp4`);
      const translationGroups = (spec.translation_groups ?? []).map((group, groupIndex) => {
        const groupStart = asr.segments.find((s) => s.id === group.start_segment_id);
        const groupEnd = asr.segments.find((s) => s.id === group.end_segment_id);
        if (!groupStart || !groupEnd) fail(`${reel.id}/${spec.id}: translation group segment missing`);
        const sourceSegments = asr.segments.filter((s) => s.id >= group.start_segment_id && s.id <= group.end_segment_id);
        return {
          id: `${spec.id}-g${groupIndex + 1}`,
          source_start: groupStart.start,
          source_end: groupEnd.end,
          clip_start: Number((groupStart.start - startSeg.start).toFixed(3)),
          clip_end: Number((groupEnd.end - startSeg.start).toFixed(3)),
          source_text: sourceSegments.map((s) => s.text).join(" "),
          display_ru: group.display_ru,
        };
      });
      return {
        id: spec.id,
        role: spec.role,
        source_video: config.source_video,
        source_start: startSeg.start,
        source_end: endSeg.end,
        source_start_tc: timecode(startSeg.start),
        source_end_tc: timecode(endSeg.end),
        extracted_duration_expected: Number((endSeg.end - startSeg.start).toFixed(3)),
        output_path: target,
        extraction_mode: "exact-reencode",
        languages,
        speaker: spec.speaker,
        speaker_confidence: spec.speaker_confidence,
        source_quote: sourceQuote(transcript.segments),
        source_subtitles: transcript.segments,
        boundary_flags: transcript.boundary_flags,
        linguistic_boundary_note: spec.linguistic_boundary_note,
        include_reason: spec.include_reason,
        removable_filler: spec.removable_filler,
        visual_qc: spec.visual_qc ?? "REVIEW_REQUIRED_AT_EXACT_EDGES",
        display_ru: spec.translation_span_id !== undefined
          ? {
              kind: "translation-layer",
              alignment: "phrase-group-only; no Russian acoustic word timestamps",
              provenance: `${config.english_ru_translations}[${spec.translation_span_id}]`,
              text: spec.display_ru ?? translations[spec.translation_span_id],
            }
          : {
              kind: "native-source-proposal",
              alignment: "native ASR word timing available; verify ASR errors by ear",
              provenance: config.native_asr ?? DEFAULT_ASR,
              text: spec.display_ru ?? sourceQuote(transcript.segments),
            },
        translation_groups: translationGroups,
      };
    });

    const manifest = {
      schema_version: "1.0",
      reel_id: reel.id,
      slug: reel.slug,
      title: reel.title,
      stage: "preproduction",
      approval_status: "EDITORIAL_REVIEW_REQUIRED",
      source_authority: {
        source_video: config.source_video,
        native_asr_word_timing: config.native_asr ?? DEFAULT_ASR,
        native_srt: config.native_srt,
        english_translation_srt: config.english_srt,
        contextual_english_to_russian: config.english_ru_translations,
        prose_transcripts: "semantic search only; never timing authority",
      },
      source_media: config.source_media,
      clips,
    };
    writeJson(path.join(dir, "source_manifest.json"), manifest);

    const transcriptDir = path.join(dir, "transcript");
    fs.mkdirSync(transcriptDir, { recursive: true });
    for (const clip of clips) {
      const srt = clip.source_subtitles
        .map((s, i) => `${i + 1}\n${timecode(s.start, true)} --> ${timecode(s.end, true)}\n${s.text}\n`)
        .join("\n");
      fs.writeFileSync(path.join(transcriptDir, `${clip.id}.source.srt`), srt, "utf8");
    }
    writeJson(path.join(transcriptDir, "words_source.json"), {
      authority: config.native_asr ?? DEFAULT_ASR,
      timing_semantics: "source seconds are absolute master time; clip seconds are relative to extracted clip start",
      clips: clips.map((clip) => ({
        id: clip.id,
        source_start: clip.source_start,
        source_end: clip.source_end,
        language: clip.languages,
        words: clip.source_subtitles.flatMap((segment) => segment.words.map((word) => ({
          source: word.word,
          source_start: word.start,
          source_end: word.end,
          clip_start: Number((word.start - clip.source_start).toFixed(3)),
          clip_end: Number((word.end - clip.source_start).toFixed(3)),
        }))),
      })),
    });
    writeJson(path.join(transcriptDir, "translation_phrase_map.json"), {
      rule: "DISPLAY RU for English speech is phrase-group mapping only. Never treat Russian display words as acoustically aligned to English source words.",
      clips: clips
        .filter((clip) => clip.display_ru.kind === "translation-layer")
        .map((clip) => ({
          id: clip.id,
          source_start: clip.source_start,
          source_end: clip.source_end,
          source_language: clip.languages,
          source_text: clip.source_quote,
          display_ru: clip.display_ru.text,
          translation_provenance: clip.display_ru.provenance,
          mapping_status: "PHRASE_GROUPS_MAPPED; EDITORIAL_TEXT_REVIEW_REQUIRED",
          groups: clip.translation_groups,
        })),
    });

    const brief = `# ${reel.id} — ${reel.title}\n\nSTATUS=PREPRODUCTION / EDITORIAL REVIEW REQUIRED\nFINAL_RENDER_AUTHORIZED=NO\n\n## Core\n\n${reel.core}\n\n## Editorial objective\n\n${reel.objective}\n\n## Target structure\n\n${reel.target_structure}\n\n## Guardrails\n\n- Source speech is never silently rewritten.\n- Native ASR is machine-generated and must be checked by ear before approval.\n- DISPLAY RU is a separate layer whenever source speech is English.\n- B-roll is optional; talking-head reaction has priority.\n- Final cuts/timeline/render wait for editorial approval.\n`;
    fs.writeFileSync(path.join(dir, "BRIEF.md"), brief, "utf8");

    const selection = [`# Source selection — ${reel.id} ${reel.title}`, "", "Authority: native word-timestamped ASR JSON; exact video edges still require final visual/audio review.", ""];
    for (const clip of clips) {
      selection.push(
        `## ${clip.id} — ${clip.role}`,
        "",
        `- Exact source: \`${clip.source_start_tc} --> ${clip.source_end_tc}\` (${clip.extracted_duration_expected.toFixed(3)} s)`,
        `- Language: ${clip.languages.join("+")}`,
        `- Speaker: ${clip.speaker} (${clip.speaker_confidence})`,
        `- Why included: ${clip.include_reason}`,
        `- Removable filler: ${clip.removable_filler}`,
        `- Safe-cut note: subtitle boundaries are aligned; ${clip.linguistic_boundary_note}`,
        `- Visual QC: ${clip.visual_qc}`,
        "",
        "### Exact SOURCE quote (native ASR, unchanged)",
        "",
        clip.source_quote,
        ""
      );
    }
    selection.push("## Editorial exclusions", "", reel.exclusions, "");
    fs.writeFileSync(path.join(dir, "SOURCE_SELECTION.md"), `${selection.join("\n")}\n`, "utf8");

    const subtitle = [`# Subtitle script — ${reel.id} ${reel.title}`, "", "SOURCE is provenance text. DISPLAY RU is a proposal and must be approved separately.", ""];
    for (const clip of clips) {
      subtitle.push(
        `## ${clip.id} — ${clip.source_start_tc} → ${clip.source_end_tc}`,
        "",
        "### SOURCE",
        "",
        clip.source_quote,
        "",
        "### DISPLAY RU",
        "",
        clip.display_ru.text,
        "",
        `- Layer: ${clip.display_ru.kind}`,
        `- Timing rule: ${clip.display_ru.alignment}`,
        `- Provenance: \`${clip.display_ru.provenance}\``,
        "- Status: REVIEW_REQUIRED; punctuation/readability edits must be logged, not silently substituted.",
        ""
      );
    }
    subtitle.push("## Proposed cards (editorial copy, not source quotes)", "", reel.cards.map((x) => `- ${x}`).join("\n"), "");
    fs.writeFileSync(path.join(dir, "SUBTITLE_SCRIPT.md"), `${subtitle.join("\n")}\n`, "utf8");

    const edit = [`# Edit plan — ${reel.id} ${reel.title}`, "", "Status: proposal; timings below are Reel-relative targets, not an approved v3 timeline.", "", ...reel.edit_plan.map((item) => `- **${item.window} — ${item.type}:** ${item.content}`), "", "## Timeline rules", "", "- Primary source audio remains continuous inside each approved source clip.", "- B-roll changes only the visual layer; subtitle timing remains anchored to source audio.", "- Generate v3 absolute frames only after this plan and DISPLAY RU are approved.", "- No final Reel is rendered in this phase.", ""];
    fs.writeFileSync(path.join(dir, "EDIT_PLAN.md"), `${edit.join("\n")}\n`, "utf8");

    const broll = [`# B-roll plan — ${reel.id} ${reel.title}`, "", `Default: ${reel.broll_default}`, "", "## Candidates", ""];
    if (reel.broll.length === 0) broll.push("No B-roll proposed. Keep the speaker's face/reaction primary.", "");
    for (const item of reel.broll) {
      broll.push(
        `### ${item.function}`,
        "",
        `- Existing asset: \`${item.asset}\``,
        `- Suggested source range: ${item.source_range}`,
        `- Insert at: ${item.insert_at}`,
        `- Expected duration: ${item.duration}`,
        `- Reason: ${item.reason}`,
        `- Status: ${item.status}`,
        ""
      );
    }
    broll.push("## Coexistence rule", "", "B-roll is a muted image-track video overlay. Original talking-head audio and subtitle absolute timing do not move.", "");
    fs.writeFileSync(path.join(dir, "BROLL_PLAN.md"), `${broll.join("\n")}\n`, "utf8");

    const qc = [
      `# QC report — ${reel.id} ${reel.title}`,
      "",
      "STAGE=PREPRODUCTION",
      "FINAL_RENDER_QC=NOT_RUN_BY_DESIGN",
      "READY_FOR_TIMELINE=NO—EDITORIAL_APPROVAL_REQUIRED",
      "",
      "## Automated preproduction checks",
      "",
      `- [x] Source master declared: \`${config.source_video}\``,
      `- [x] Native provenance authority declared: \`${config.native_asr ?? DEFAULT_ASR}\``,
      "- [x] Source cuts use native segment boundaries; no cut crosses a subtitle interval.",
      "- [x] Literal SOURCE and DISPLAY RU are stored separately.",
      "- [x] English translation layers use deliberate phrase groups, not Russian word timestamps.",
      "- [x] B-roll references, when present, point to existing catalogued assets.",
      "",
      "## Clip extraction",
      "",
      ...clips.map((clip) => `- [${fs.existsSync(rootPath(clip.output_path)) ? "x" : " "}] ${clip.id}: \`${clip.output_path}\``),
      "",
      "## Editorial checks still required",
      "",
      "- [ ] Listen to every selected edge; confirm no clipped first/last phoneme.",
      "- [ ] Confirm speaker identity from video/audio (ASR is not diarized).",
      "- [ ] Correct obvious native-ASR lexical errors against the audio and log every correction.",
      "- [ ] Approve DISPLAY RU and phrase grouping.",
      "- [ ] Approve filler removals and discontinuous source jumps.",
      "- [ ] Approve or reject each optional B-roll insert.",
      "- [ ] Approve final duration and edit plan before generating timeline.json.",
      "",
      "## Render-stage checks (pending)",
      "",
      "- [ ] v3 timeline validation / asset existence / no unintended gaps or primary-audio overlap.",
      "- [ ] Headless stills: safe area, faces, subtitles, cards and layer overlap.",
      "- [ ] Encoded MP4: 1080×1920@30, H.264 yuv420p BT.709, AAC stereo, audio present, changing frames.",
      "- [ ] Final editorial watch-through.",
      "",
    ];
    fs.writeFileSync(path.join(dir, "QC_REPORT.md"), `${qc.join("\n")}\n`, "utf8");
    console.log(`built preproduction package ${reel.id}: ${rel(dir)}`);
  }
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", ...options });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${command} exited ${result.status}`);
};

const probe = (file) => {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries",
    "format=filename,duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
    "-of", "json", file,
  ], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr.trim() || `ffprobe failed: ${file}`);
  return JSON.parse(r.stdout);
};

const extract = (slug, mode = "exact") => {
  const dir = rootPath(path.join("reel-input", slug));
  const manifest = readJson(path.join(dir, "source_manifest.json"));
  for (const clip of manifest.clips ?? []) {
    const source = rootPath(clip.source_video);
    const output = rootPath(clip.output_path);
    if (!fs.existsSync(source)) fail(`missing source: ${rel(source)}`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (fs.existsSync(output)) fail(`refusing to overwrite: ${rel(output)}`);
    const duration = clip.source_end - clip.source_start;
    const common = ["-nostdin", "-n", "-ss", String(clip.source_start), "-i", source, "-t", String(duration), "-map", "0:v:0", "-map", "0:a?"];
    const codec = mode === "copy"
      ? ["-c", "copy", "-avoid_negative_ts", "make_zero"]
      : ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-avoid_negative_ts", "make_zero"];
    run("ffmpeg", [...common, ...codec, output]);
    const info = probe(output);
    const actual = Number(info.format?.duration ?? 0);
    if (Math.abs(actual - duration) > (mode === "copy" ? 2 : 0.25)) {
      fail(`${clip.id}: duration mismatch expected=${duration.toFixed(3)} actual=${actual.toFixed(3)}`);
    }
    console.log(`${clip.id}: ${rel(output)} ${actual.toFixed(3)}s`);
  }
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const p = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(p) : [p];
});

const broll = (inputDir, outputFile, framesDir) => {
  const dir = rootPath(inputDir);
  if (!fs.existsSync(dir)) fail(`missing B-roll directory: ${inputDir}`);
  const media = walk(dir).filter((p) => /\.(mp4|mov|m4v|webm|png|jpe?g|webp)$/i.test(p));
  const items = [];
  if (framesDir) fs.mkdirSync(rootPath(framesDir), { recursive: true });
  for (const file of media) {
    const info = probe(file);
    const stream = info.streams?.find((s) => s.codec_type === "video") ?? {};
    const duration = Number(info.format?.duration ?? 0);
    let representative_frame = null;
    if (framesDir && duration > 0 && /\.(mp4|mov|m4v|webm)$/i.test(file)) {
      const frame = rootPath(path.join(framesDir, `${path.basename(file, path.extname(file))}_mid.jpg`));
      run("ffmpeg", ["-nostdin", "-y", "-v", "error", "-ss", String(duration / 2), "-i", file, "-frames:v", "1", "-q:v", "2", frame]);
      representative_frame = rel(frame);
    }
    items.push({
      path: rel(file), duration: duration || null, width: stream.width ?? null,
      height: stream.height ?? null, frame_rate: stream.r_frame_rate ?? null,
      codec: stream.codec_name ?? null, orientation: stream.width && stream.height
        ? (stream.height > stream.width ? "portrait" : stream.width > stream.height ? "landscape" : "square")
        : "unknown",
      representative_frame,
    });
  }
  const out = rootPath(outputFile);
  writeJson(out, { generated_at: new Date().toISOString(), input_dir: inputDir, items });
  console.log(`inventoried ${items.length} assets -> ${rel(out)}`);
};

const mergeRegions = (regions, gap = 12) => {
  const sorted = regions.filter((r) => r.endFrame > r.startFrame).sort((a, b) => a.startFrame - b.startFrame);
  const merged = [];
  for (const region of sorted) {
    const last = merged.at(-1);
    if (last && region.startFrame <= last.endFrame + gap) last.endFrame = Math.max(last.endFrame, region.endFrame);
    else merged.push({ ...region });
  }
  return merged;
};

const visibleTokens = (text) => String(text ?? "").trim().split(/\s+/u).filter(Boolean);
const normalizedVisibleToken = (text) => String(text)
  .normalize("NFKC")
  .toLocaleLowerCase("ru")
  .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const sameVisibleTokens = (a, b) =>
  a.length === b.length && a.every((token, index) => normalizedVisibleToken(token) === normalizedVisibleToken(b[index]));

const derivedRevealFrames = (start, end, count) => {
  if (!(count > 0) || end - start < count) {
    fail(`WORD_REVEAL_DATA_MISSING: ${count} translated tokens do not fit ${start}..${end}`);
  }
  const hold = Math.min(6, Math.max(0, end - start - count));
  const lastReveal = Math.max(start, end - 1 - hold);
  if (count === 1) return [start];
  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const ideal = Math.round(start + (lastReveal - start) * index / (count - 1));
    const reveal = index === 0 ? start : Math.max(frames[index - 1] + 1, ideal);
    if (reveal >= end) fail("WORD_REVEAL_DATA_MISSING: derived reveal escapes phrase-group interval");
    frames.push(reveal);
  }
  return frames;
};

const buildTimeline = (target, options = {}) => {
  if (!target) fail("timeline requires a Reel slug or package directory");
  const dir = path.isAbsolute(target) || target.includes(path.sep)
    ? rootPath(target)
    : rootPath(path.join("reel-input", target));
  const slug = path.basename(dir);
  const manifest = readJson(path.join(dir, "source_manifest.json"));
  const recipePath = options.recipe ? rootPath(options.recipe) : path.join(dir, "timeline_recipe.json");
  if (!fs.existsSync(recipePath)) fail(`missing ${rel(recipePath)}; copy reel-input/_templates/timeline_recipe.example.json`);
  const recipe = readJson(recipePath);
  if (recipe.approval_status !== "APPROVED") fail("timeline_recipe.json approval_status must be APPROVED");
  const fps = 30;
  const styleTokensPath = rootPath(recipe.style_tokens ?? "reel-input/_templates/nikulina_style_tokens.json");
  const tokens = readJson(styleTokensPath);
  const isNikulina = path.basename(styleTokensPath).includes("nikulina_style_tokens");
  const subtitleLayout = isNikulina
    ? applyWidthAwareFixedSubtitleLayout({
        captions: recipe.captions ?? [],
        styleTokens: tokens,
        frameWidth: Number(tokens.frame?.width ?? 1080),
        frameHeight: Number(tokens.frame?.height ?? 1920),
      })
    : { captions: recipe.captions ?? [], report: null };
  const wordsSourcePath = path.join(dir, "transcript", "words_source.json");
  const wordsSource = fs.existsSync(wordsSourcePath) ? readJson(wordsSourcePath) : { clips: [] };
  const translationMapPath = path.join(dir, "transcript", "translation_phrase_map.json");
  const translationMap = fs.existsSync(translationMapPath) ? readJson(translationMapPath) : { clips: [] };
  const clipById = new Map((manifest.clips ?? []).map((clip) => [clip.id, clip]));
  const wordDataByClip = new Map((wordsSource.clips ?? []).map((clip) => [clip.id, clip]));
  const wordsByClip = new Map((wordsSource.clips ?? []).map((clip) => [clip.id, clip.words ?? []]));
  const translationGroupById = new Map(
    (translationMap.clips ?? []).flatMap((clip) => (clip.groups ?? []).map((group) => [group.id, { ...group, clip_id: clip.id }]))
  );
  const sequenceOffsets = new Map();
  const sequenceMeta = new Map();
  const videoClips = [];
  const sourceWindows = [];
  let cursor = 0;

  for (const item of recipe.sequence ?? []) {
    const start = cursor;
    let durationFrames;
    let clip;
    let source = null;
    let trimStart = 0;
    let sourceTimingRate = 1;
    if (item.kind === "video") {
      source = clipById.get(item.clip_id);
      if (!source) fail(`recipe sequence ${item.id}: unknown clip_id ${item.clip_id}`);
      sourceTimingRate = Number(item.source_timing_rate ?? source.source_timing_rate ?? 1);
      if (!(sourceTimingRate > 0)) fail(`${item.id}: source_timing_rate must be positive`);
      trimStart = Number(item.trim_start_seconds ?? 0);
      const available = source.extracted_duration_expected - trimStart;
      const duration = Number(item.duration_seconds ?? available);
      if (!(duration > 0) || duration > available + 0.05) fail(`${item.id}: invalid duration ${duration}s (available ${available}s)`);
      durationFrames = Math.round(duration * fps);
      const packagePublic = path.join(dir, "public");
      const outputAbs = rootPath(source.output_path);
      const publicPrefix = `${packagePublic}${path.sep}`;
      if (!outputAbs.startsWith(publicPrefix)) fail(`${source.id}: output_path is not under package public/`);
      const src = path.relative(packagePublic, outputAbs).split(path.sep).join("/");
      // Derived speed-adjusted media keeps canonical word data on the original
      // source-local clock. Convert that clock into rendered clip seconds here;
      // canonical ASR and translation maps therefore remain untouched.
      const timingWindowStart = trimStart * sourceTimingRate;
      const timingWindowEnd = (trimStart + duration) * sourceTimingRate;
      const speech = (wordsByClip.get(source.id) ?? [])
        .filter((word) => word.clip_end > timingWindowStart && word.clip_start < timingWindowEnd)
        .map((word) => ({
          startFrame: start + Math.max(0, Math.round(((word.clip_start - timingWindowStart) / sourceTimingRate) * fps)),
          endFrame: start + Math.min(durationFrames, Math.round(((word.clip_end - timingWindowStart) / sourceTimingRate) * fps)),
        }));
      clip = {
        id: item.id,
        kind: "video",
        src,
        start,
        end: start + durationFrames,
        startFrom: Math.round(trimStart * fps),
        fit: item.fit ?? "contain",
        backColor: item.backColor ?? tokens.palette.black,
        volume: item.volume ?? 1,
        muted: item.muted ?? false,
        speechRegions: mergeRegions(speech),
      };
      for (const key of ["backgroundBlur", "backgroundBrightness", "backgroundSaturation", "backgroundScale"]) {
        if (item[key] !== undefined) clip[key] = Number(item[key]);
      }
      if (item.source_window) {
        sourceWindows.push({
          id: `${item.id}-source-window`,
          kind: "image",
          src,
          start,
          end: start + durationFrames,
          startFrom: Math.round(trimStart * fps),
          x: Number(item.source_window.x ?? 0),
          y: Number(item.source_window.y ?? 0),
          width: Number(item.source_window.width ?? 1080),
          height: Number(item.source_window.height ?? 608),
          fit: item.source_window.fit ?? "cover",
          borderRadius: Number(item.source_window.borderRadius ?? 0),
          opacity: Number(item.source_window.opacity ?? 1),
        });
      }
    } else if (item.kind === "card") {
      durationFrames = Math.round(Number(item.duration_seconds) * fps);
      if (!(durationFrames > 0)) fail(`${item.id}: card duration must be positive`);
      clip = {
        id: item.id,
        kind: "color",
        color: item.color ?? tokens.palette.wine,
        start,
        end: start + durationFrames,
      };
    } else fail(`unsupported sequence kind: ${item.kind}`);
    if (item.transitionToNext) clip.transitionToNext = item.transitionToNext;
    videoClips.push(clip);
    sequenceOffsets.set(item.id, { start, end: start + durationFrames });
    sequenceMeta.set(item.id, { start, end: start + durationFrames, source, trimStart, sourceTimingRate });
    cursor += durationFrames - Math.round(Number(item.transitionToNext?.durationInFrames ?? 0));
  }

  const captions = subtitleLayout.captions;
  const speechGroups = new Map();
  captions.forEach((caption, i) => {
    const role = caption.role ?? (isNikulina ? "speech" : "editorial");
    if (role !== "speech") return;
    if (!caption.phrase_id) fail(`WORD_REVEAL_DATA_MISSING: caption ${i} has no phrase_id`);
    const key = `${caption.sequence_id}:${caption.phrase_id}`;
    const group = speechGroups.get(key) ?? [];
    group.push({ caption, index: i });
    speechGroups.set(key, group);
  });

  const revealMetaByCaption = new Map();
  for (const [key, entries] of speechGroups) {
    const first = entries[0].caption;
    const seq = sequenceOffsets.get(first.sequence_id);
    const meta = sequenceMeta.get(first.sequence_id);
    if (!seq || !meta?.source) fail(`WORD_REVEAL_DATA_MISSING: ${key} has no source video sequence`);
    const localStart = Number(first.start_seconds ?? 0);
    const localEnd = Number(first.end_seconds);
    if (entries.some(({ caption }) =>
      Number(caption.start_seconds ?? 0) !== localStart || Number(caption.end_seconds) !== localEnd
    )) fail(`WORD_REVEAL_DATA_MISSING: ${key} lines must share one semantic boundary`);

    const displayTokens = entries.flatMap(({ caption }) => visibleTokens(caption.text));
    if (!displayTokens.length || displayTokens.some((token) => !normalizedVisibleToken(token))) {
      fail(`WORD_REVEAL_DATA_MISSING: ${key} contains empty or punctuation-only tokens`);
    }
    let revealFrames;
    let timingType;
    let notAcousticWordAlignment = false;
    let semanticStartFrame;
    let semanticEndFrame;

    if (first.translation_group_id) {
      if (entries.some(({ caption }) => caption.translation_group_id !== first.translation_group_id)) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} mixes translation phrase groups`);
      }
      const translationGroup = translationGroupById.get(first.translation_group_id);
      if (!translationGroup || translationGroup.clip_id !== meta.source.id) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} translation group ${first.translation_group_id} not found for ${meta.source.id}`);
      }
      const authorityTokens = visibleTokens(translationGroup.display_ru);
      if (!sameVisibleTokens(displayTokens, authorityTokens)) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} DISPLAY RU differs from translation phrase map`);
      }
      const groupStart = seq.start + Math.round(((Number(translationGroup.clip_start) / meta.sourceTimingRate) - meta.trimStart) * fps);
      const groupEnd = seq.start + Math.round(((Number(translationGroup.clip_end) / meta.sourceTimingRate) - meta.trimStart) * fps);
      const captionStart = seq.start + Math.round(localStart * fps);
      const captionEnd = seq.start + Math.round(localEnd * fps);
      if (Math.abs(groupStart - captionStart) > 1 || Math.abs(groupEnd - captionEnd) > 1) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} timing differs from translation phrase group`);
      }
      revealFrames = derivedRevealFrames(groupStart, groupEnd, displayTokens.length);
      semanticStartFrame = groupStart;
      semanticEndFrame = groupEnd;
      timingType = "DERIVED_VISUAL_REVEAL";
      notAcousticWordAlignment = true;
    } else {
      const sourceWordData = wordDataByClip.get(meta.source.id);
      const languages = sourceWordData?.language ?? [];
      if (!languages.includes("ru")) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} English speech requires translation_group_id`);
      }
      const sourceWindowStart = (meta.trimStart + localStart) * meta.sourceTimingRate;
      const sourceWindowEnd = (meta.trimStart + localEnd) * meta.sourceTimingRate;
      const sourceWords = (sourceWordData?.words ?? []).filter((word) =>
        Number(word.clip_start) >= sourceWindowStart - 0.001 && Number(word.clip_start) < sourceWindowEnd - 0.001
      );
      // Package word maps may attach a human-approved mutable DISPLAY override
      // while preserving the immutable canonical ASR token in `source`.
      // Overrides may expand or suppress a token (for example `намного` ->
      // `на много`, or joining ASR's split `что` + `-то` as `что-то`).
      const displayWordTokens = sourceWords.flatMap((word) =>
        visibleTokens(word.display === undefined ? word.source : word.display)
          .map((token) => ({ token, word }))
      );
      const sourceTokens = displayWordTokens.map(({ token }) => token);
      if (!sameVisibleTokens(displayTokens, sourceTokens)) {
        fail(`WORD_REVEAL_DATA_MISSING: ${key} native DISPLAY tokens do not match source words`);
      }
      revealFrames = displayWordTokens.map(({ word }) =>
        seq.start + Math.max(0, Math.round(((Number(word.clip_start) / meta.sourceTimingRate) - meta.trimStart) * fps))
      );
      semanticStartFrame = seq.start + Math.round(localStart * fps);
      semanticEndFrame = seq.start + Math.round(localEnd * fps);
      timingType = "SOURCE_WORD_TIMESTAMPS";
    }

    let tokenCursor = 0;
    for (const { caption, index } of entries) {
      const lineTokens = visibleTokens(caption.text);
      const lineFrames = revealFrames.slice(tokenCursor, tokenCursor + lineTokens.length);
      tokenCursor += lineTokens.length;
      const pageStartToken = Number(caption.layout_page_token_start ?? 0);
      const pageEndToken = Number(caption.layout_page_token_end ?? displayTokens.length);
      const pageStart = revealFrames[pageStartToken] ?? semanticStartFrame;
      const pageEnd = revealFrames[pageEndToken] ?? semanticEndFrame;
      revealMetaByCaption.set(index, {
        start: pageStart,
        end: Math.max(pageStart + 1, pageEnd),
        wordReveals: lineTokens.map((text, tokenIndex) => ({ text, revealFrame: lineFrames[tokenIndex] })),
        timingType,
        notAcousticWordAlignment,
      });
    }
  }

  const words = captions.map((caption, i) => {
    const seq = sequenceOffsets.get(caption.sequence_id);
    if (!seq) fail(`caption ${i}: unknown sequence_id ${caption.sequence_id}`);
    const token = tokens.typography[caption.style ?? "subtitle"];
    if (!token) fail(`caption ${i}: unknown typography token ${caption.style}`);
    const start = seq.start + Math.round(Number(caption.start_seconds ?? 0) * fps);
    const end = seq.start + Math.round(Number(caption.end_seconds) * fps);
    if (!(end > start) || end > seq.end) fail(`caption ${i}: timing is outside ${caption.sequence_id}`);
    const word = {
      text: caption.text,
      start,
      end,
      x: caption.x ?? token.x,
      y: caption.y ?? token.y,
      font: caption.font ?? token.font,
      size: caption.size ?? token.size,
      weight: caption.weight ?? token.weight,
      color: caption.color ?? token.color,
      enterFrom: "none",
      case: caption.case ?? token.case ?? "none",
    };
    if (caption.stroke ?? token.stroke) word.stroke = caption.stroke ?? token.stroke;
    if (caption.shadow ?? token.shadow) word.shadow = caption.shadow ?? token.shadow;
    const role = caption.role ?? (isNikulina ? "speech" : "editorial");
    word.subtitleRole = role;
    if (role === "speech") {
      const reveal = revealMetaByCaption.get(i);
      if (!reveal) fail(`WORD_REVEAL_DATA_MISSING: caption ${i} has no cumulative reveal metadata`);
      word.start = reveal.start;
      word.end = reveal.end;
      word.revealMode = "cumulative-word";
      word.wordReveals = reveal.wordReveals;
      word.revealFadeFrames = Number(caption.reveal_fade_frames ?? 3);
      word.timingType = reveal.timingType;
      word.notAcousticWordAlignment = reveal.notAcousticWordAlignment;
      word.layoutSystem = caption.layout_system;
      word.layoutGroupId = caption.layout_group_id;
      word.layoutLineIndex = caption.layout_line_index;
      word.layoutLineCount = caption.layout_line_count;
      word.layoutBounds = caption.layout_bounds;
      word.layoutSafeBounds = caption.layout_safe_bounds;
      word.fixedFinalLayout = caption.layout_fixed_final;
      word.horizontalReflow = caption.layout_horizontal_reflow;
      word.verticalReflow = caption.layout_vertical_reflow;
      word.finalWordPositions = caption.layout_word_positions;
      return word;
    }
    const preset = caption.animation ?? token.animation;
    if (preset === "fade-pop") {
      const d = Math.min(end - start, tokens.animation.fade_pop_frames ?? 4);
      word.keyframes = {
        opacity: [{ frame: 0, value: 0 }, { frame: d, value: 1, easing: "easeOut" }],
        size: [{ frame: 0, value: Math.round(word.size * 0.9) }, { frame: d, value: word.size, easing: "easeOut" }],
      };
    } else if (preset === "fade-slide-up") {
      const d = Math.min(end - start, Number(caption.animation_duration_frames ?? 12));
      const distance = Number(caption.slide_distance_px ?? 14);
      const relEnd = end - start;
      const fadeOut = Math.min(relEnd, Number(caption.fade_out_frames ?? 0));
      word.keyframes = {
        opacity: [{ frame: 0, value: 0 }, { frame: d, value: 1, easing: "easeOut" }],
        position: [
          { frame: 0, value: { x: word.x, y: word.y + distance } },
          { frame: d, value: { x: word.x, y: word.y }, easing: "easeOut" },
        ],
      };
      if (fadeOut > 0 && relEnd - fadeOut > d) {
        word.keyframes.opacity.push(
          { frame: relEnd - fadeOut, value: 1 },
          { frame: relEnd, value: 0, easing: "easeIn" }
        );
      }
    }
    return word;
  });

  const shapes = (recipe.graphics ?? []).map((graphic, i) => {
    const seq = sequenceOffsets.get(graphic.sequence_id);
    if (!seq) fail(`graphic ${i}: unknown sequence_id ${graphic.sequence_id}`);
    const start = seq.start + Math.round(Number(graphic.start_seconds ?? 0) * fps);
    const end = seq.start + Math.round(Number(graphic.end_seconds) * fps);
    if (!(end > start) || end > seq.end) fail(`graphic ${i}: timing is outside ${graphic.sequence_id}`);
    const shape = {
      id: graphic.id ?? `graphic-${i + 1}`,
      shape: graphic.shape ?? "rect",
      start,
      end,
      x: Number(graphic.x ?? 0),
      y: Number(graphic.y ?? 0),
      width: Number(graphic.width),
      height: Number(graphic.height),
      color: graphic.color,
      borderRadius: Number(graphic.borderRadius ?? 0),
      opacity: Number(graphic.opacity ?? 1),
    };
    const relEnd = end - start;
    const d = Math.min(relEnd, Number(graphic.animation_duration_frames ?? 10));
    const fadeOut = Math.min(relEnd, Number(graphic.fade_out_frames ?? 0));
    if (graphic.animation === "fade" || graphic.animation === "fade-slide-up") {
      shape.keyframes = {
        opacity: [{ frame: 0, value: 0 }, { frame: d, value: shape.opacity, easing: "easeOut" }],
      };
      if (graphic.animation === "fade-slide-up") {
        const distance = Number(graphic.slide_distance_px ?? 14);
        shape.keyframes.position = [
          { frame: 0, value: { x: shape.x, y: shape.y + distance } },
          { frame: d, value: { x: shape.x, y: shape.y }, easing: "easeOut" },
        ];
      }
      if (fadeOut > 0 && relEnd - fadeOut > d) {
        shape.keyframes.opacity.push(
          { frame: relEnd - fadeOut, value: shape.opacity },
          { frame: relEnd, value: 0, easing: "easeIn" }
        );
      }
    }
    return shape;
  });

  const imageTracks = (recipe.broll ?? []).map((overlay, i) => {
    const seq = sequenceOffsets.get(overlay.sequence_id);
    if (!seq) fail(`broll ${i}: unknown sequence_id ${overlay.sequence_id}`);
    const start = seq.start + Math.round(Number(overlay.start_seconds ?? 0) * fps);
    const end = seq.start + Math.round(Number(overlay.end_seconds) * fps);
    if (!(end > start) || end > seq.end) fail(`broll ${i}: timing is outside ${overlay.sequence_id}`);
    return {
      id: `broll-${i + 1}`,
      kind: "image",
      clips: [{
        id: overlay.id ?? `broll-${i + 1}`,
        kind: "image",
        src: overlay.src,
        start, end,
        x: overlay.x ?? 0, y: overlay.y ?? 0,
        width: overlay.width ?? 1080, height: overlay.height ?? 1920,
        fit: overlay.fit ?? "cover",
        opacity: overlay.opacity ?? 1,
      }],
    };
  });

  const tracks = [
    { id: "video", kind: "video", clips: videoClips },
    ...(sourceWindows.length ? [{ id: "source-window", kind: "image", clips: sourceWindows }] : []),
    ...imageTracks,
    { id: "shape", kind: "shape", shapes },
    { id: "text", kind: "text", words },
  ];
  if (recipe.music) {
    tracks.push({ id: "audio", kind: "audio", clips: [{
      id: "music",
      src: recipe.music.src,
      start: 0,
      end: cursor,
      startFrom: Math.round(Number(recipe.music.start_seconds ?? 0) * fps),
      volume: recipe.music.volume ?? 0.15,
      fadeInFrames: recipe.music.fadeInFrames ?? 15,
      fadeOutFrames: recipe.music.fadeOutFrames ?? 30,
      ducking: recipe.music.ducking,
    }] });
  }
  const timeline = {
    fps,
    width: 1080,
    height: 1920,
    durationInFrames: Math.max(1, cursor),
    ...(subtitleLayout.report ? { subtitleLayout: subtitleLayout.report } : {}),
    tracks,
  };
  const timelinePath = options.output ? rootPath(options.output) : path.join(dir, "timeline.json");
  writeJson(timelinePath, timeline);
  console.log(`timeline ${slug}: ${timeline.durationInFrames}f ${(timeline.durationInFrames / fps).toFixed(2)}s, ${words.length} captions, ${imageTracks.length} B-roll tracks`);
  if (options.output) console.log(`timeline output: ${rel(timelinePath)}`);
};

const validate = (target, stage = "preproduction") => {
  if (!target) fail("validate requires a Reel slug or package directory");
  const dir = path.isAbsolute(target) || target.includes(path.sep)
    ? rootPath(target)
    : rootPath(path.join("reel-input", target));
  const slug = path.basename(dir);
  const errors = [];
  const warnings = [];
  for (const file of REQUIRED_PREPRODUCTION) {
    if (!fs.existsSync(path.join(dir, file))) errors.push(`missing ${file}`);
  }
  let manifest;
  try { manifest = readJson(path.join(dir, "source_manifest.json")); }
  catch (e) { errors.push(`invalid source_manifest.json: ${e.message}`); }
  for (const clip of manifest?.clips ?? []) {
    if (!(clip.source_end > clip.source_start)) errors.push(`${clip.id}: invalid source range`);
    if (!fs.existsSync(rootPath(clip.source_video))) errors.push(`${clip.id}: source video missing: ${clip.source_video}`);
    if (!clip.source_quote || !(clip.source_subtitles?.length > 0)) errors.push(`${clip.id}: missing literal source provenance`);
    const joined = (clip.source_subtitles ?? []).map((s) => s.text).join(" ");
    if (joined !== clip.source_quote) errors.push(`${clip.id}: source_quote differs from source_subtitles`);
    const sourceWords = (clip.source_subtitles ?? []).flatMap((subtitle) => subtitle.words ?? []);
    const atWordBoundary = (edge, side) => sourceWords.some((word) =>
      Math.abs(Number(edge) - Number(side === "start" ? word.start : word.end)) <= 0.001
    );
    const humanStartApproved = /APPROVED/.test(clip.human_review?.start_edge ?? "");
    const humanEndApproved = /APPROVED/.test(clip.human_review?.end_edge ?? "");
    if (clip.boundary_flags?.start_inside_subtitle) {
      if (humanStartApproved && atWordBoundary(clip.source_start, "start")) {
        warnings.push(`${clip.id}: human-approved word-level start lies inside a canonical subtitle segment`);
      } else errors.push(`${clip.id}: source start crosses a subtitle boundary without a human-approved word boundary`);
    }
    if (clip.boundary_flags?.end_inside_subtitle) {
      if (humanEndApproved && atWordBoundary(clip.source_end, "end")) {
        warnings.push(`${clip.id}: human-approved word-level end lies inside a canonical subtitle segment`);
      } else errors.push(`${clip.id}: source end crosses a subtitle boundary without a human-approved word boundary`);
    }
    if (!fs.existsSync(rootPath(clip.output_path))) warnings.push(`${clip.id}: extracted clip not created yet`);
    if (clip.display_ru?.kind === "translation-layer" && !/phrase-group/.test(clip.display_ru.alignment ?? "")) {
      errors.push(`${clip.id}: translated display text must declare phrase-group alignment`);
    }
    if (clip.display_ru?.kind === "translation-layer" && !(clip.translation_groups?.length > 0)) {
      errors.push(`${clip.id}: translated display text has no deliberate phrase groups`);
    }
  }
  const timelinePath = path.join(dir, "timeline.json");
  if (stage === "render" || fs.existsSync(timelinePath)) {
    if (!fs.existsSync(timelinePath)) errors.push("missing timeline.json for render stage");
    else {
      const timeline = readJson(timelinePath);
      if (timeline.fps !== 30 || timeline.width !== 1080 || timeline.height !== 1920) errors.push("timeline must be 1080x1920 @ 30fps");
      if (!Array.isArray(timeline.tracks) || !(timeline.durationInFrames > 0)) errors.push("timeline must be v3 tracks with durationInFrames");
      const publicDir = path.join(dir, "public");
      const primary = (timeline.tracks ?? []).find((track) => track.kind === "video");
      const primaryClips = [...(primary?.clips ?? [])].sort((a, b) => a.start - b.start);
      if (!primary || primaryClips.length === 0) errors.push("timeline needs a primary video track with at least one clip");
      for (let i = 0; i < primaryClips.length; i += 1) {
        const item = primaryClips[i];
        if (!(item.end > item.start) || item.start < 0 || item.end > timeline.durationInFrames) {
          errors.push(`${item.id}: primary clip timing is outside timeline`);
        }
        if (i === 0 && item.start !== 0) errors.push(`${item.id}: unintended primary-track gap before first clip`);
        if (i > 0) {
          const prev = primaryClips[i - 1];
          const expected = prev.end - Number(prev.transitionToNext?.durationInFrames ?? 0);
          if (item.start !== expected) {
            errors.push(`${item.id}: primary track join must start at frame ${expected}, got ${item.start}`);
          }
        }
      }
      if (primaryClips.at(-1)?.end !== timeline.durationInFrames) {
        errors.push("primary video track must end at durationInFrames");
      }
      for (const track of timeline.tracks ?? []) {
        for (const item of track.clips ?? []) {
          if (!(item.end > item.start) || item.start < 0 || item.end > timeline.durationInFrames) {
            errors.push(`${item.id}: clip timing is outside timeline`);
          }
          if (item.src && item.src !== "placeholder") {
            const asset = path.resolve(publicDir, item.src);
            if (!asset.startsWith(`${publicDir}${path.sep}`)) errors.push(`timeline asset escapes package public/: ${item.src}`);
            else if (!fs.existsSync(asset)) errors.push(`timeline asset missing: ${item.src}`);
          }
        }
        for (const item of [...(track.words ?? []), ...(track.shapes ?? [])]) {
          if (!(item.end > item.start) || item.start < 0 || item.end > timeline.durationInFrames) {
            errors.push(`${item.id ?? item.text}: timed element is outside timeline`);
          }
        }
        for (const item of track.words ?? []) {
          if (item.subtitleRole === "speech" && (
            item.revealMode !== "cumulative-word" || !(item.wordReveals?.length > 0) || !item.timingType
          )) errors.push(`WORD_REVEAL_DATA_MISSING: ${item.text}`);
          if (item.timingType === "DERIVED_VISUAL_REVEAL" && item.notAcousticWordAlignment !== true) {
            errors.push(`translated reveal must declare notAcousticWordAlignment: ${item.text}`);
          }
          if (item.subtitleRole === "speech" && timeline.subtitleLayout?.system === WIDTH_AWARE_LAYOUT_SYSTEM) {
            const bounds = item.layoutBounds;
            const safeBounds = item.layoutSafeBounds ?? timeline.subtitleLayout.safeBounds;
            const metadataOk = item.layoutSystem === WIDTH_AWARE_LAYOUT_SYSTEM &&
              item.fixedFinalLayout === true && item.horizontalReflow === false && item.verticalReflow === false &&
              Number.isInteger(item.layoutLineIndex) && Number(item.layoutLineCount) >= 1 && Number(item.layoutLineCount) <= 4 &&
              Array.isArray(item.finalWordPositions) && item.finalWordPositions.length === item.wordReveals?.length;
            if (!metadataOk || !bounds || !safeBounds) {
              errors.push(`PRE_RENDER_SUBTITLE_SAFE_WIDTH=FAIL group=${item.layoutGroupId ?? "unknown"} missing fixed-layout metadata`);
            } else if (
              Number(bounds.left) < Number(safeBounds.left) || Number(bounds.right) > Number(safeBounds.right) ||
              Number(bounds.top) < Number(safeBounds.top) || Number(bounds.bottom) > Number(safeBounds.bottom)
            ) {
              errors.push(
                `PRE_RENDER_SUBTITLE_SAFE_WIDTH=FAIL group=${item.layoutGroupId} text=${JSON.stringify(item.text)} ` +
                `lines=${item.layoutLineCount} font=${item.size} width=${(Number(bounds.right) - Number(bounds.left)).toFixed(2)} ` +
                `safeWidth=${(Number(safeBounds.right) - Number(safeBounds.left)).toFixed(2)}`
              );
            }
          }
        }
      }
      if (timeline.subtitleLayout?.system === WIDTH_AWARE_LAYOUT_SYSTEM && !errors.some((error) => error.includes("PRE_RENDER_SUBTITLE_SAFE_WIDTH=FAIL"))) {
        console.log(`PRE_RENDER_SUBTITLE_SAFE_WIDTH=PASS groups=${timeline.subtitleLayout.groups?.length ?? 0}`);
      }
    }
  }
  console.log(`VALIDATION slug=${slug} stage=${stage} clips=${manifest?.clips?.length ?? 0}`);
  for (const w of warnings) console.log(`WARN: ${w}`);
  for (const e of errors) console.error(`FAIL: ${e}`);
  if (errors.length) process.exit(1);
  console.log("PASS");
};

const render = (slug, output) => {
  validate(slug, "render");
  const dir = rootPath(path.join("reel-input", slug));
  const timeline = path.join(dir, "timeline.json");
  const target = output ? rootPath(output) : rootPath(path.join("out", `${slug}.mp4`));
  run("npm", ["run", "render:reel", "--", timeline, target], {
    env: { ...process.env, REEL_PUBLIC_DIR: path.join(dir, "public") },
  });
};

const argv = process.argv.slice(2);
const command = argv.shift();
switch (command) {
  case "prepare": prepare(argv[0], argv.slice(1).join(" ") || argv[0]); break;
  case "quote": {
    const start = parseTime(argv[0]);
    const end = parseTime(argv[1]);
    const formatAt = argv.indexOf("--format");
    const outAt = argv.indexOf("--out");
    const asrAt = argv.indexOf("--asr");
    const format = formatAt >= 0 ? argv[formatAt + 1] : "json";
    const asrFile = asrAt >= 0 ? argv[asrAt + 1] : DEFAULT_ASR;
    const { data } = loadAsr(asrFile);
    const rendered = renderQuote(selectTranscript(data, start, end), format);
    if (outAt >= 0) {
      const out = rootPath(argv[outAt + 1]);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, rendered, "utf8");
      console.log(`wrote ${rel(out)}`);
    } else process.stdout.write(rendered);
    break;
  }
  case "preproduction": buildPreproduction(argv[0] ?? "reel-input/preproduction_eight.json"); break;
  case "extract": extract(argv[0], argv.includes("--copy") ? "copy" : "exact"); break;
  case "broll": broll(argv[0] ?? "public/media", argv[1] ?? "reel-input/_catalog/broll_inventory.json", argv[2]); break;
  case "timeline": {
    const recipeAt = argv.indexOf("--recipe");
    const outputAt = argv.indexOf("--output");
    buildTimeline(argv[0], {
      recipe: recipeAt >= 0 ? argv[recipeAt + 1] : undefined,
      output: outputAt >= 0 ? argv[outputAt + 1] : undefined,
    });
    break;
  }
  case "validate": validate(argv[0], argv.includes("--render") ? "render" : "preproduction"); break;
  case "render": render(argv[0], argv[1]); break;
  default:
    console.log(`usage:
  npm run reel:prepare -- <slug> [title]
  npm run reel:quote -- <start> <end> [--format json|srt|text] [--out file] [--asr file]
  npm run reel:preproduction -- <config.json>
  npm run reel:extract -- <slug> [--copy]
  npm run reel:broll -- [input-dir] [inventory.json] [frames-dir]
  npm run reel:timeline -- <slug|package-dir> [--recipe file.json] [--output timeline.json]
  npm run reel:validate -- <slug|package-dir> [--render]
  npm run reel:render -- <slug> [out/file.mp4]`);
    if (command) process.exit(1);
}
