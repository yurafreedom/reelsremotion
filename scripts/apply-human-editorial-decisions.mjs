#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASR_PATH = path.join(ROOT, "transcripts/video1219377731/asr_video1219377731.json");
const ASR = JSON.parse(fs.readFileSync(ASR_PATH, "utf8"));
const DECISION_ARTIFACT = "reel-input/HUMAN_EDITORIAL_DECISIONS.md";

const timecode = (seconds, srt = false) => {
  const total = Math.round(Number(seconds) * 1000);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const ms = total % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${srt ? "," : "."}${String(ms).padStart(3, "0")}`;
};

const EPSILON = 0.001;

const selectSegments = (start, end) => ASR.segments
  .filter((segment) => segment.end > start && segment.start < end)
  .map((segment) => {
    const clipped = segment.start < start || segment.end > end;
    const words = (segment.words ?? [])
      .filter((word) => word.start >= start - EPSILON && word.end <= end + EPSILON)
      .map((word) => ({ word: word.word, start: word.start, end: word.end }));
    const selectedStart = clipped && words.length ? words[0].start : Math.max(segment.start, start);
    const selectedEnd = clipped && words.length ? words.at(-1).end : Math.min(segment.end, end);
    return {
      id: segment.id,
      start: selectedStart,
      end: selectedEnd,
      start_tc: timecode(selectedStart),
      end_tc: timecode(selectedEnd),
      original_segment_start: segment.start,
      original_segment_end: segment.end,
      language: segment.script ?? segment.lang ?? "unknown",
      text: clipped && words.length ? words.map((word) => word.word).join(" ") : segment.text,
      words,
    };
  })
  .filter((segment) => segment.words.length > 0 || segment.end > segment.start);

const canonicalBoundaryFlags = (start, end) => {
  const overlapping = ASR.segments.filter((segment) => segment.end > start && segment.start < end);
  const first = overlapping[0];
  const last = overlapping.at(-1);
  return {
    start_inside_subtitle: Boolean(first && start > first.start && start < first.end),
    end_inside_subtitle: Boolean(last && end > last.start && end < last.end),
  };
};

const edgeUpdates = {
  "r02-connection-without-future": {
    "r02-question": { end: 4581.6 },
    "r02-unique-value": { end: 4752.32 },
    "r02-permission-payoff": { end: 4865.36 },
  },
  "r03-dominance-is-not-control": {
    "r03-stabilization": { end: 2241.98 },
  },
  "r04-compromise-vs-consensus": {
    "r04-example": { end: 2845.49 },
  },
  "r05-adult-love-is-conditional": {
    "r05-conditions-boundaries": { start: 12133.07 },
  },
};

const humanReviewByClip = {
  "r01-hook-loss": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED; final heard text: с момента",
    corrections: [
      { id: "C01", decision: "ACCEPT", approved_source_text: "теряешь" },
    ],
  },
  "r01-clarity-ground": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED",
    corrections: [
      { id: "C02", decision: "ACCEPT", approved_source_text: "консента", approved_display_text: "консента" },
    ],
  },
  "r02-question": {
    audio_review: "PARTIAL_DECISION_APPLIED",
    end_edge: "HUMAN_APPROVED_AFTER there is no future together; APPLIED at 01:16:21.600",
    corrections: [
      { id: "C03", decision: "ACCEPT", approved_source_meaning: "couldn't just let yourself see someone, just date, just make love..." },
    ],
  },
  "r02-unique-value": {
    audio_review: "PARTIAL; EXTENDED EDGE REQUIRES HUMAN RECHECK",
    end_edge: "CURRENT 01:19:12.000 REJECTED; APPLIED 01:19:12.320 after locating complete unique and following silence",
    corrections: [
      { id: "C04", decision: "PARTIALLY_APPROVED", approved_start: "to actually indulge in that pleasure, to meet someone...", remainder_status: "PENDING_OPTIONAL_REVIEW" },
    ],
  },
  "r02-permission-payoff": {
    audio_review: "APPROVED_RECOMMENDED_END",
    end_edge: "HUMAN_APPROVED after without expectations; APPLIED at 01:21:05.360",
  },
  "r03-stabilization": {
    audio_review: "APPROVED",
    end_edge: "HUMAN_APPROVED after когда ты рассыпаешься; APPLIED at 00:37:21.980",
  },
  "r04-principle": {
    audio_review: "TEXT APPROVED; CLEAN START APPROVED; COMPACT CANDIDATE A APPROVED",
    start_edge: "HUMAN APPROVED clean Russian start at 00:39:13.240; current package source boundary retained because final timeline is not authorized",
    end_edge: "HUMAN CONFIRMED clip ends after the opposing-needs/third-solution phrase",
    corrections: [
      { id: "C05", decision: "ACCEPT" },
      { id: "C06", decision: "ACCEPT" },
      { id: "C07", decision: "ACCEPT_WITH_DISPLAY_NORMALIZATION", approved_source_pronunciation: "approximately коньюнктио", approved_display_text: "coniunctio" },
    ],
  },
  "r04-example": {
    audio_review: "APPROVED_RETAINED_FIRST_SECTION",
    end_edge: "HUMAN APPROVED after и это не работало; APPLIED at 00:47:25.490",
    speaker: "Denis",
    role: "Club participant / Russian interpreter for Andrew in the Zoom session",
    corrections: [
      { id: "C08", decision: "EXCLUDED_FROM_FINAL_EDIT", remediation_required: false },
    ],
  },
  "r05-conditions-boundaries": {
    audio_review: "APPROVED",
    start_edge: "HUMAN APPROVED earlier context; APPLIED at 03:22:13.070",
    end_edge: "APPROVED; final phrase и это прям круто is complete",
    corrections: [
      { id: "C09", decision: "ACCEPT", approved_source_text: "красивый", approved_display_text: "красивый", preserve_colloquial_syntax: true },
    ],
  },
  "r06-self-question": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED",
    editorial_content: "APPROVED",
  },
  "r06-evidence-question": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED",
    editorial_content: "APPROVED",
  },
  "r06-facts": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED",
    editorial_content: "APPROVED",
  },
  "r06-reality": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED",
    editorial_content: "APPROVED",
  },
  "r07-reframe": {
    corrections: [{
      id: "R07-ALWAYS",
      decision: "ACCEPT",
      approved_source_text: "Динамика всегда высвобождает",
      approved_display_text: "Динамика всегда высвобождает",
      canonical_episode_asr_modified: false,
    }],
  },
  "r07-lived-experience": {
    audio_review: "APPROVED",
    start_edge: "APPROVED",
    end_edge: "APPROVED; final complete phrase: like actually you live it; last word: it",
    corrections: [{
      id: "C10",
      decision: "ACCEPT",
      approved_source_text: "that makes you feel what you're thinking about, feel what you're saying",
      approved_display_text: "и это заставляет тебя почувствовать, о чём ты думаешь, почувствовать, что ты говоришь, — то есть ты действительно это проживаешь.",
      alignment: "phrase-group-only; no Russian acoustic word timestamps",
    }],
  },
  "r08-observe-parts": {
    corrections: [{
      id: "C11",
      decision: "ACCEPT",
      approved_source_text: "Первым этапом изучите свои эго-личности.",
      approved_display_text: "Первым этапом изучите свои эго-личности.",
    }],
  },
  "r08-protective-parts": {
    corrections: [{
      id: "C12",
      decision: "ACCEPT",
      approved_source_text: "на много эго-личностей",
      resolved: true,
      retain_in_recommended_edit: true,
      supersedes_previous_exclusion: true,
    }],
  },
};

const nativeApprovedDisplayByClip = {
  "r01-hook-loss": "когда очень много чувств, когда очень много страха потерять человека, ты начинаешь подстраиваться. Я думаю, что вам всем это знакомо, чувство, правда? И в этом подстраивании ты просто теряешь себя, теряешь путь, куда вы движетесь, и все начинает рушиться, поэтому я так люблю с момента",
  "r01-clarity-ground": "открытия для себя динамики четкое проговаривание контракта, четкое проговаривание консента, четкое проговаривание куда мы движемся, потому что именно это дает четкость и понятность. И это же можно применять в обычной повседневной жизни. Вы получите в рамках клуба ощущения, вот этой частоты, вот этого чувства, как это стоять на своей земле, не защищая позиции, не воюя за это, а просто оставаясь в своем центре. Вот это самое главное, что вы получите, и это будет как импринт вашего ощущения, которое вы понесете в жизнь.",
  "r04-principle": "И так интересно, то есть мы можем прийти к консенсусу — только к консенсусу, мы не можем прийти к компромиссу. То есть компромисс — это всегда у нас разрушающая история. Вот, я понимаю, что я себя предаю, если я иду на компромисс, или он себя предаёт, если мы идём на компромисс, и только консенсус — как третье. Да, вот помните, кто у меня в тантре coniunctio? Вот эта история, когда встречаются две противоположности и, выдерживая интенсивность, они рождают что-то третье. И вот у нас всегда так.",
  "r05-conditions-boundaries": "потому что привычка доказывать эту ценность, она настолько въедена в психику, что даже когда уже как бы все тебя безусловно до конца всего приняли, ты всё равно начинаешь понимать, что взрослая любовь всё равно условна. И там начинается момент взросления. То есть когда ты принимаешь условную любовь как что-то очень классное, развивающее тебя и здоровое, тут начинается переход от твоей детской части, которая хочет безусловно: «Люби меня за то, что я просто такой красивый есть», — до того, что, блять, оказывается, условия — это прям классно, границы — это прям круто, блять, меня возвращают и структурируют. Блин, у меня яйца начинают появляться — какие-то другого формата, другого размера, — и это прям круто.",
};

const contextualR02QuestionDisplay = "Ты когда-нибудь ловила себя на том, что воспринимаешь каждую романтическую связь слишком серьёзно и берёшь на себя слишком много ответственности — настолько, что не можешь просто встречаться с кем-то, ходить на свидания или заниматься любовью без чувства вины и груза ответственности, особенно когда с самого начала понимаешь, что общего будущего нет?";

const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");

for (const [slug, updates] of Object.entries(edgeUpdates)) {
  const packageDir = path.join(ROOT, "reel-input", slug);
  const manifestPath = path.join(packageDir, "source_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.approval_status = slug === "r04-compromise-vs-consensus"
    ? "HUMAN_EAR_APPROVED_COMPACT_RECOMMENDATION; FINAL_TIMELINE_NOT_AUTHORIZED"
    : "HUMAN_DECISIONS_PARTIALLY_APPLIED; FINAL_TIMELINE_NOT_AUTHORIZED";
  manifest.human_decision_batch = {
    applied_at: "2026-08-21",
    artifact: DECISION_ARTIFACT,
    canonical_episode_asr_modified: false,
  };

  for (const clip of manifest.clips) {
    const update = updates[clip.id];
    if (update) {
      clip.source_start = update.start ?? clip.source_start;
      clip.source_end = update.end ?? clip.source_end;
      clip.source_start_tc = timecode(clip.source_start);
      clip.source_end_tc = timecode(clip.source_end);
      clip.extracted_duration_expected = Number((clip.source_end - clip.source_start).toFixed(3));
      clip.source_subtitles = selectSegments(clip.source_start, clip.source_end);
      clip.source_quote = clip.source_subtitles.map((segment) => segment.text).join(" ");
      clip.boundary_flags = canonicalBoundaryFlags(clip.source_start, clip.source_end);
      if (clip.translation_groups?.length) {
        clip.translation_groups = clip.translation_groups.filter((group) => group.source_start >= clip.source_start && group.source_end <= clip.source_end);
        clip.display_ru.text = clip.translation_groups.map((group) => group.display_ru).join(" ");
      } else if (clip.display_ru?.kind === "native-source-proposal") {
        clip.display_ru.text = nativeApprovedDisplayByClip[clip.id] ?? clip.source_quote;
      }
    }
    if (humanReviewByClip[clip.id]) clip.human_review = humanReviewByClip[clip.id];
    if (nativeApprovedDisplayByClip[clip.id]) clip.display_ru.text = nativeApprovedDisplayByClip[clip.id];
    if (clip.id === "r04-example") {
      clip.speaker = "Denis — Club participant / Russian interpreter for Andrew in the Zoom session";
      clip.speaker_confidence = "HUMAN_CONFIRMED";
    }
    if (clip.id === "r02-question") {
      clip.display_ru.text = contextualR02QuestionDisplay;
      if (clip.translation_groups?.[0]) {
        clip.translation_groups[0].display_ru = "Ты когда-нибудь ловила себя на том, что воспринимаешь каждую романтическую связь слишком серьёзно и берёшь на себя слишком много ответственности — настолько, что не можешь просто встречаться с кем-то, ходить на свидания или заниматься любовью без чувства вины и груза ответственности,";
      }
      if (clip.translation_groups?.[1]) {
        clip.translation_groups[1].display_ru = "особенно когда с самого начала понимаешь, что общего будущего нет?";
      }
    }
  }

  writeJson(manifestPath, manifest);

  const transcriptDir = path.join(packageDir, "transcript");
  for (const clip of manifest.clips) {
    const srt = clip.source_subtitles
      .map((segment, index) => `${index + 1}\n${timecode(segment.start, true)} --> ${timecode(segment.end, true)}\n${segment.text}\n`)
      .join("\n");
    fs.writeFileSync(path.join(transcriptDir, `${clip.id}.source.srt`), srt, "utf8");
  }
  writeJson(path.join(transcriptDir, "words_source.json"), {
    authority: "transcripts/video1219377731/asr_video1219377731.json",
    timing_semantics: "source seconds are absolute master time; clip seconds are relative to extracted clip start",
    immutable_canonical_asr: true,
    human_decision_artifact: DECISION_ARTIFACT,
    clips: manifest.clips.map((clip) => ({
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
    human_decision_artifact: DECISION_ARTIFACT,
    clips: manifest.clips
      .filter((clip) => clip.display_ru.kind === "translation-layer")
      .map((clip) => ({
        id: clip.id,
        source_start: clip.source_start,
        source_end: clip.source_end,
        source_language: clip.languages,
        source_text: clip.source_quote,
        display_ru: clip.display_ru.text,
        translation_provenance: clip.display_ru.provenance,
        mapping_status: clip.human_review?.corrections?.some((item) => item.decision === "PARTIALLY_APPROVED")
          ? "PARTIALLY_HUMAN_APPROVED; REMAINDER_PENDING"
          : "HUMAN_DECISION_APPLIED_TO_RETAINED_GROUPS; FINAL_SUBTITLE_APPROVAL_PENDING",
        groups: clip.translation_groups,
      })),
  });
}

// R01 has no edge mutation, but its accepted corrections/edge review still
// belong in the mutable package decision layer.
{
  const packageDir = path.join(ROOT, "reel-input/r01-fear-of-losing-yourself");
  const manifestPath = path.join(packageDir, "source_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.approval_status = "HUMAN_AUDIO_REVIEW_APPROVED; FINAL_TIMELINE_NOT_AUTHORIZED";
  manifest.human_decision_batch = { applied_at: "2026-08-21", artifact: DECISION_ARTIFACT, canonical_episode_asr_modified: false };
  for (const clip of manifest.clips) {
    clip.human_review = humanReviewByClip[clip.id];
    if (nativeApprovedDisplayByClip[clip.id]) clip.display_ru.text = nativeApprovedDisplayByClip[clip.id];
  }
  writeJson(manifestPath, manifest);
}

// Apply the final human-ear metadata/display decisions without changing source
// boundaries or immutable episode provenance.
for (const slug of ["r06-what-is-actually-true", "r07-kneeling-return-to-body", "r08-where-do-you-fall-apart"]) {
  const manifestPath = path.join(ROOT, "reel-input", slug, "source_manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.human_decision_batch = { applied_at: "2026-08-21", artifact: DECISION_ARTIFACT, canonical_episode_asr_modified: false };
  manifest.approval_status = slug.startsWith("r06-")
    ? "HUMAN_AUDIO_AND_EDITORIAL_APPROVED; READY_FOR_DESIGN_PILOT; FINAL_TIMELINE_NOT_AUTHORIZED"
    : slug.startsWith("r07-")
      ? "CONTENT_APPROVED; JOIN_02_AUDIO_OPTIONS_PENDING; FINAL_TIMELINE_NOT_AUTHORIZED"
      : "C12_RETAINED; JOIN_02_COMPLETE_SENTENCE_OPTION_A_PENDING; FINAL_TIMELINE_NOT_AUTHORIZED";
  for (const clip of manifest.clips) {
    if (humanReviewByClip[clip.id]) clip.human_review = humanReviewByClip[clip.id];
    if (clip.id === "r07-lived-experience") {
      const group = clip.translation_groups?.find((item) => item.id === "r07-lived-experience-g2");
      if (group) {
        group.canonical_source_text = group.canonical_source_text ?? group.source_text;
        group.source_text = "because it starts to hurt and get uncomfortable and that makes you feel what you're thinking about, feel what you're saying, like actually you live it.";
        group.source_text_status = "HUMAN_CORRECTED_MUTABLE_LAYER_C10";
        group.display_ru = "потому что начинает болеть и становится некомфортно, и это заставляет тебя почувствовать, о чём ты думаешь, почувствовать, что ты говоришь, — то есть ты действительно это проживаешь.";
      }
      clip.display_ru.text = clip.translation_groups.map((item) => item.display_ru).join(" ");
    }
    if (clip.id === "r08-observe-parts") {
      clip.display_ru.text = clip.display_ru.text.replace("Первым этапом изучите свои галичности.", "Первым этапом изучите свои эго-личности.");
    }
    if (clip.id === "r08-protective-parts") {
      clip.display_ru.text = clip.display_ru.text.replace("намного оеголичности", "на много эго-личностей");
    }
  }
  writeJson(manifestPath, manifest);
  if (slug === "r07-kneeling-return-to-body") {
    writeJson(path.join(ROOT, "reel-input", slug, "transcript/translation_phrase_map.json"), {
      rule: "DISPLAY RU for English speech is phrase-group mapping only. Never treat Russian display words as acoustically aligned to English source words.",
      human_decision_artifact: DECISION_ARTIFACT,
      clips: manifest.clips
        .filter((clip) => clip.display_ru.kind === "translation-layer")
        .map((clip) => ({
          id: clip.id,
          source_start: clip.source_start,
          source_end: clip.source_end,
          source_language: clip.languages,
          canonical_source_text: clip.source_quote,
          human_approved_source_text: clip.translation_groups.map((group) => group.source_text).join(" "),
          display_ru: clip.display_ru.text,
          translation_provenance: clip.display_ru.provenance,
          mapping_status: "C10_HUMAN_APPROVED; PHRASE_GROUP_ALIGNMENT_ONLY",
          groups: clip.translation_groups,
        })),
    });
  }
}

console.log("Applied human decision metadata and approved source edges to mutable Reel review packages.");
