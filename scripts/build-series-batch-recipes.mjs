import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const writeJson = (file, value) => fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const packagePath = (slug, file) => `reel-input/${slug}/${file}`;
const standardVideo = (id, clipId, duration, trim = 0) => ({
  id,
  kind: "video",
  clip_id: clipId,
  duration_seconds: duration,
  ...(trim ? { trim_start_seconds: trim } : {}),
  source_timing_rate: 1,
  fit: "cover",
  volume: 1,
  backgroundBlur: 32,
  backgroundBrightness: 0.6,
  backgroundSaturation: 0.72,
  backgroundScale: 1.08,
  source_window: { x: 0, y: 34, width: 1080, height: 608, fit: "cover" },
});

const visibleTokens = (value) => String(value ?? "").trim().split(/\s+/u).filter(Boolean);
const displayTokensForWord = (word) => visibleTokens(word.display === undefined ? word.source : word.display);

const applyJoinedHyphens = (words) => {
  for (let index = 0; index < words.length - 1; index += 1) {
    if (/^-то[,.!?]?$/u.test(words[index + 1].source)) {
      const suffix = words[index + 1].source.replace(/^-/, "");
      words[index].display = `${words[index].source}-${suffix}`;
      words[index + 1].display = "";
    }
  }
};

const captionGroups = ({ words, sequenceId, trim = 0, duration, prefix }) => {
  const end = trim + duration;
  const selected = words.filter((word) => Number(word.clip_start) >= trim - 0.001 && Number(word.clip_start) < end - 0.001);
  const groups = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const tokens = current.flatMap(displayTokensForWord);
    if (tokens.length) {
      groups.push({
        sequence_id: sequenceId,
        role: "speech",
        phrase_id: `${prefix}-g${groups.length + 1}`,
        start_seconds: Number((Number(current[0].clip_start) - trim).toFixed(3)),
        end_seconds: Number((Math.min(end, Number(current.at(-1).clip_end)) - trim).toFixed(3)),
        text: tokens.join(" "),
        font: "nikulinaSans",
        size: 56,
        weight: 600,
        color: "#F7F4EF",
        x: 0,
        y: 520,
        shadow: [{ y: 3, blur: 18, color: "rgba(0,0,0,0.76)" }],
      });
    }
    current = [];
  };
  for (const word of selected) {
    current.push(word);
    const tokenCount = current.flatMap(displayTokensForWord).length;
    const span = Number(word.clip_end) - Number(current[0].clip_start);
    const naturalStop = /[.!?][”»']?$/u.test(word.source) && tokenCount >= 5;
    const clauseStop = /[,;:][”»']?$/u.test(word.source) && tokenCount >= 12;
    if (naturalStop || clauseStop || tokenCount >= 18 || span >= 7.2) flush();
  }
  flush();
  return groups;
};

const topGraphics = (sequence, duration) => [
  { id: `${sequence}-bottom-scrim`, sequence_id: sequence, start_seconds: 0, end_seconds: duration, shape: "rect", x: 0, y: 649, width: 1080, height: 622, color: "#080808", opacity: 0.3 },
];

const openingGraphics = (sequence, duration = 7.4) => [
  { id: `${sequence}-hook-zone`, sequence_id: sequence, start_seconds: 0, end_seconds: duration, shape: "rect", x: 0, y: -615, width: 1080, height: 690, color: "#080808", opacity: 0.68, animation: "fade", animation_duration_frames: 9, fade_out_frames: 7 },
  { id: `${sequence}-hook-plate`, sequence_id: sequence, start_seconds: 0.18, end_seconds: duration, shape: "rect", x: 0, y: -500, width: 910, height: 104, color: "#7A1F32", borderRadius: 2, animation: "fade-slide-up", animation_duration_frames: 10, slide_distance_px: 12, fade_out_frames: 7 },
];

const finalGraphics = (sequence, sequenceDuration, duration = 3.8) => [
  { id: `${sequence}-final-zone`, sequence_id: sequence, start_seconds: sequenceDuration - duration, end_seconds: sequenceDuration, shape: "rect", x: 0, y: -615, width: 1080, height: 690, color: "#080808", opacity: 0.68, animation: "fade", animation_duration_frames: 9 },
];

const editorial = (sequenceId, start, end, text, y, size = 72) => ({
  sequence_id: sequenceId,
  role: "editorial",
  start_seconds: start,
  end_seconds: end,
  text,
  font: "nikulinaCondensed",
  size,
  weight: 700,
  color: "#F7F4EF",
  case: "upper",
  x: 0,
  y,
  animation: "fade-slide-up",
  animation_duration_frames: 10,
  slide_distance_px: 12,
  fade_out_frames: 7,
});

const configs = {
  "r01-fear-of-losing-yourself": {
    id: "R01",
    sequence: [standardVideo("loss", "r01-hook-loss", 23.46), standardVideo("ground", "r01-clarity-ground", 39.74)],
    openings: ["СТРАХ ПОТЕРЯТЬ ДРУГОГО", "МОЖЕТ СТЕРЕТЬ ТЕБЯ"],
    final: "СТОЯТЬ НА СВОЕЙ ЗЕМЛЕ",
    broll: [
      { id: "r01-br041-loss-of-self", sequence_id: "loss", src: "broll/series/br041_walk_away.mp4", start_seconds: 11.9, end_seconds: 13.7, fit: "cover" },
      { id: "r01-br009-ground", sequence_id: "ground", src: "broll/series/br009_grounded_steps.mp4", start_seconds: 22.4, end_seconds: 24.2, fit: "cover" },
    ],
    music: { volume: 0.18, duckedVolume: 0.075 },
    musicName: "Finding Myself — Michael Ramir C.",
    joins: "Contiguous approved source: loss block → contract/consent/grounding payoff; natural pause after `теряешь` preserved.",
  },
  "r03-dominance-is-not-control": {
    id: "R03",
    sequence: [standardVideo("stability", "r03-stabilization", 39.94)],
    openings: ["ДОМИНИРОВАНИЕ —", "НЕ КОНТРОЛЬ"],
    final: "СТАБИЛИЗИРОВАТЬ, А НЕ ПОГЛОЩАТЬ",
    broll: [
      { id: "r03-br037-support", sequence_id: "stability", src: "broll/series/br037_hands_support.mp4", start_seconds: 20.4, end_seconds: 22.2, fit: "cover" },
      { id: "r03-br013-self-possessed", sequence_id: "stability", src: "broll/series/br013_self_possessed.mp4", start_seconds: 5.0, end_seconds: 6.8, fit: "cover" },
    ],
    music: { volume: 0.065, duckedVolume: 0.025 },
    musicName: "Vastness — Andrew Ev",
    joins: "One approved contiguous source block; rejected return-to-question tail remains excluded after `когда ты рассыпаешься`.",
  },
  "r05-adult-love-is-conditional": {
    id: "R05",
    sequence: [standardVideo("argument", "r05-conditions-boundaries", 55.98)],
    openings: ["ВЗРОСЛАЯ ЛЮБОВЬ", "ВСЁ РАВНО УСЛОВНА"],
    final: "ГРАНИЦЫ МОГУТ УКРЕПЛЯТЬ",
    broll: [
      { id: "r05-br004-adult-life", sequence_id: "argument", src: "broll/series/br004_adult_domestic.mp4", start_seconds: 18.5, end_seconds: 20.5, fit: "cover" },
      { id: "r05-br053-shared-direction", sequence_id: "argument", src: "broll/series/br053_shared_direction.mp4", start_seconds: 45.0, end_seconds: 47.0, fit: "cover" },
    ],
    music: { volume: 0.10, duckedVolume: 0.04 },
    musicName: "Forest Mist Whispers — Alejandro Magaña (A. M.)",
    joins: "One approved contiguous source block with earlier human-approved start; conversational syntax and complete final `и это прям круто` retained.",
  },
  "r04-compromise-vs-consensus": {
    id: "R04",
    sequence: [standardVideo("example", "r04-example-approved-splice", 7.76), standardVideo("principle", "r04-principle", 32.98, 6.74)],
    openings: ["КОМПРОМИСС", "НЕ ВСЕГДА РЕШАЕТ"],
    final: "КОНСЕНСУС ИЩЕТ ТРЕТЬЕ",
    broll: [
      { id: "r04-br007-attention", sequence_id: "example", src: "broll/series/br007_shared_attention.mp4", start_seconds: 1.2, end_seconds: 3.2, fit: "cover" },
      { id: "r04-br026-join-mask", sequence_id: "principle", src: "broll/series/br026_transition_embrace.mp4", start_seconds: 0, end_seconds: 1.8, fit: "cover" },
    ],
    music: { volume: 0.055, duckedVolume: 0.022 },
    musicName: "Cyberpunk City — Alejandro Magaña (A. M.)",
    joins: "Human-approved practical example splice → clean-start principle. The old 13-second diagnostic candidate is not the final endpoint; `coniunctio` is retained in DISPLAY.",
  },
  "r08-where-do-you-fall-apart": {
    id: "R08",
    sequence: [
      standardVideo("observe-a", "r08-observe-parts", 6.98),
      standardVideo("observe-b", "r08-observe-parts", 7.18, 23.48),
      standardVideo("protective-a", "r08-protective-parts", 17.56),
      standardVideo("protective-b", "r08-protective-parts", 10.16, 19.4),
    ],
    openings: ["В КАКОЙ ЧАСТИ СЕБЯ", "ТЫ РАССЫПАЕШЬСЯ?"],
    final: "НАЗОВИ СВОИ ЧАСТИ",
    broll: [
      { id: "r08-br034-reflection", sequence_id: "observe-b", src: "broll/series/br034_reflection.mp4", start_seconds: 2.8, end_seconds: 4.8, fit: "cover" },
      { id: "r08-br006-complex-space", sequence_id: "protective-b", src: "broll/series/br006_complex_space.mp4", start_seconds: 0.2, end_seconds: 1.4, fit: "cover" },
    ],
    music: { volume: 0.13, duckedVolume: 0.052 },
    musicName: "Feedback Dreams — Eugenio Mininni",
    joins: "Approved JOIN1, middle skip, and complete-sentence Option A. Parenting example removed; C12 sentence completes before `Вот смотри`.",
  },
};

const mutateWordMaps = (slug, wordsMap) => {
  for (const clip of wordsMap.clips) {
    applyJoinedHyphens(clip.words);
    for (const [index, word] of clip.words.entries()) {
      if (slug.startsWith("r01-") && clip.id === "r01-hook-loss" && word.source === "потеряешь") word.display = "теряешь";
      if (slug.startsWith("r01-") && word.source === "концента,") word.display = "консента,";
      if (slug.startsWith("r01-") && word.source === "повсеместной") word.display = "повседневной";
      if (slug.startsWith("r05-") && word.source === "красивей") word.display = "красивый";
      if (slug.startsWith("r08-") && word.source === "галичности.") word.display = "эго-личности.";
      if (slug.startsWith("r08-") && clip.id === "r08-observe-parts" && index === 46) word.display = "Вы наблю... вы";
      if (slug.startsWith("r08-") && word.source === "намного") word.display = "на много";
      if (slug.startsWith("r08-") && word.source === "оеголичности.") word.display = "эго-личностей.";
    }
  }
  wordsMap.human_display_overrides = {
    artifact: "reel-input/HUMAN_EDITORIAL_DECISIONS.md",
    canonical_episode_asr_modified: false,
    semantics: "source retains canonical ASR token; optional display is the approved mutable subtitle token",
  };
};

const ensureR04Splice = (manifest, wordsMap) => {
  const baseClip = manifest.clips.find((clip) => clip.id === "r04-example");
  const baseWords = wordsMap.clips.find((clip) => clip.id === "r04-example");
  const custom = {
    ...baseClip,
    id: "r04-example-approved-splice",
    role: "approved-practical-example",
    extracted_duration_expected: 7.76,
    output_path: "reel-input/r04-compromise-vs-consensus/public/clips/003_example-approved-splice.mp4",
    extraction_mode: "human-approved-discontinuous-reencode",
    source_ranges: [[2836.37, 2836.59], [2837.95, 2845.49]],
    source_quote: "Мы всегда шли на компромисс, пытались как-то договориться, ну ладно, давай в Париже, давай как-то вот подстроимся, но всегда это был компромисс и это не работало.",
    rendered_quote: "Мы пытались как-то договориться, ну ладно, давай в Париже, давай как-то вот подстроимся, но всегда это был компромисс и это не работало.",
    human_review: { audio_review: "APPROVED", splice: "Мы → пытались; retained through и это не работало" },
  };
  manifest.clips = [...manifest.clips.filter((clip) => clip.id !== custom.id), custom];
  const first = { ...baseWords.words[0], clip_start: 0, clip_end: 0.22 };
  const rest = baseWords.words.slice(5).map((word) => ({
    ...word,
    clip_start: Number((Number(word.clip_start) - 1.36).toFixed(3)),
    clip_end: Number((Number(word.clip_end) - 1.36).toFixed(3)),
  }));
  const customWords = { id: custom.id, source_start: 2836.37, source_end: 2845.49, language: ["ru"], words: [first, ...rest] };
  applyJoinedHyphens(customWords.words);
  wordsMap.clips = [...wordsMap.clips.filter((clip) => clip.id !== custom.id), customWords];
};

const r04Groups = [
  { id: "r04-approved-g1", clip_start: 6.74, clip_end: 13.68, display_ru: "И так интересно, то есть мы можем прийти к консенсусу, только к консенсусу, мы не можем прийти к компромиссу." },
  { id: "r04-approved-g2", clip_start: 13.68, clip_end: 17.8, display_ru: "То есть компромисс, это всегда у нас разрушающая история." },
  { id: "r04-approved-g3", clip_start: 17.8, clip_end: 26.62, display_ru: "Вот, я понимаю, что я себя предаю, если я иду на компромисс, или он себя предаёт, если мы идём на компромисс, и только консенсус, как третье." },
  { id: "r04-approved-g4", clip_start: 26.62, clip_end: 30.02, display_ru: "Да, вот помните, кто у меня в тантре coniunctio?" },
  { id: "r04-approved-g5", clip_start: 30.02, clip_end: 39.72, display_ru: "Вот эта история, когда встречаются две противоположности и, выдерживая интенсивность, они рождают что-то третье. И вот у нас всегда так." },
];

for (const [slug, config] of Object.entries(configs)) {
  const manifestFile = packagePath(slug, "source_manifest.json");
  const wordsFile = packagePath(slug, "transcript/words_source.json");
  const manifest = readJson(manifestFile);
  const wordsMap = readJson(wordsFile);
  mutateWordMaps(slug, wordsMap);
  if (config.id === "R04") ensureR04Splice(manifest, wordsMap);
  manifest.stage = "series-production-candidate";
  manifest.approval_status = "HUMAN_SOURCE_APPROVED; SERIES_PRODUCTION_CANDIDATE_AUTHORIZED";
  manifest.series_production = { width_aware_layout: true, canonical_episode_asr_modified: false, master_source_modified: false };
  writeJson(manifestFile, manifest);
  writeJson(wordsFile, wordsMap);

  if (config.id === "R04") {
    writeJson(packagePath(slug, "transcript/translation_phrase_map.json"), {
      rule: "Human-approved R04 DISPLAY groups use phrase-level visual reveal; canonical ASR remains unchanged.",
      human_decision_artifact: "reel-input/HUMAN_EDITORIAL_DECISIONS.md",
      clips: [{ id: "r04-principle", groups: r04Groups }],
    });
  }

  const clipWords = new Map(wordsMap.clips.map((clip) => [clip.id, clip.words]));
  const speech = [];
  for (const item of config.sequence) {
    if (config.id === "R04" && item.id === "principle") {
      for (const [index, group] of r04Groups.entries()) {
        speech.push({
          sequence_id: "principle",
          role: "speech",
          phrase_id: `principle-g${index + 1}`,
          translation_group_id: group.id,
          start_seconds: Number((group.clip_start - 6.74).toFixed(3)),
          end_seconds: Number((group.clip_end - 6.74).toFixed(3)),
          text: group.display_ru,
          font: "nikulinaSans", size: 54, weight: 600, color: "#F7F4EF", x: 0, y: 520,
          shadow: [{ y: 3, blur: 18, color: "rgba(0,0,0,0.76)" }],
        });
      }
    } else {
      speech.push(...captionGroups({
        words: clipWords.get(item.clip_id),
        sequenceId: item.id,
        trim: Number(item.trim_start_seconds ?? 0),
        duration: Number(item.duration_seconds),
        prefix: item.id,
      }));
    }
  }

  const first = config.sequence[0];
  const last = config.sequence.at(-1);
  const openingEnd = Math.min(7.4, Number(first.duration_seconds));
  const finalStart = Math.max(0, Number(last.duration_seconds) - 3.8);
  const captions = [
    editorial(first.id, 0.05, openingEnd, config.openings[0], -620, 68),
    editorial(first.id, 0.18, openingEnd, config.openings[1], -498, 76),
    ...speech,
    editorial(last.id, finalStart, Number(last.duration_seconds), config.final, -500, config.id === "R03" ? 58 : 66),
  ];
  const graphics = [
    ...config.sequence.flatMap((item) => topGraphics(item.id, Number(item.duration_seconds))),
    ...openingGraphics(first.id, openingEnd),
    ...finalGraphics(last.id, Number(last.duration_seconds)),
  ];
  writeJson(packagePath(slug, "timeline_recipe.json"), {
    schema_version: "2.0",
    approval_status: "APPROVED",
    production_status: `${config.id}_SERIES_PRODUCTION_CANDIDATE_AUTHORIZED`,
    style_tokens: "reel-input/_templates/nikulina_style_tokens.json",
    sequence: config.sequence,
    graphics,
    captions,
    broll: config.broll,
    music: {
      src: "media/series_music.mp3",
      start_seconds: 0,
      volume: config.music.volume,
      fadeInFrames: 18,
      fadeOutFrames: 36,
      ducking: { enabled: true, duckedVolume: config.music.duckedVolume, attackFrames: 8, releaseFrames: 12 },
    },
  });
  fs.writeFileSync(path.join(ROOT, packagePath(slug, "EDIT_PLAN.md")), `# Edit plan — ${config.id}\n\nSTATUS=SERIES_PRODUCTION_CANDIDATE_AUTHORIZED\nWIDTH_AWARE_FIXED_SUBTITLE_LAYOUT=YES\n\n## Source / joins\n\n${config.joins}\n\n## B-roll\n\n${config.broll.map((item) => `- ${item.id}: ${item.sequence_id} ${item.start_seconds.toFixed(2)}–${item.end_seconds.toFixed(2)} s; source ${item.src}`).join("\n")}\n\n## Music\n\nTRACK=${config.musicName}\nLICENSE=Mixkit Stock Music Free License\nVOCALS=NO\nBASE_GAIN=${config.music.volume}\nDUCKED_GAIN=${config.music.duckedVolume}\n\n## Guardrails\n\n- Source dialogue timing remains 1.0x.\n- Canonical episode ASR and master source are not modified.\n- B-roll is visual-only; source speech continues under every insert.\n- Full render is limited to one candidate for this Reel.\n`, "utf8");
  console.log(`${config.id}: recipe=${config.sequence.reduce((sum, item) => sum + Number(item.duration_seconds), 0).toFixed(2)}s captions=${speech.length} broll=${config.broll.length}`);
}
