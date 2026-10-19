// Starting from an ASR draft (build step 4): load real word timings, give them
// motion (migrate enterFrom → slide-in keyframes), then layer emphasis + a recolor
// on top — the same operations as composing from scratch, just on imported facts.
//
//   node compose/run.mjs compose/example_asr.ts [draft.json] [out.json]

import * as reel from "./index";

const src = process.argv[2] ?? "out/draft.json";
const out = process.argv[3] ?? "public/timeline_asr.json";

// 1. Import the ASR draft (real text + start/end), then expand each word's
//    enterFrom hint into actual slide-in keyframes so the draft animates.
const t = reel.migrateTimeline(reel.importTimeline(src));

// 2. Apply taste on top: emphasize the key word in the red accent.
const s = t.scenes[0];
const key = reel.findWord(s, "сверхмеры,");
reel.emphasize(key, "punch-red");

// 3. A gentle fade-out on the last word so the scene breathes before the cut.
reel.fadeOut(s.words[s.words.length - 1], { duration: 12 });

reel.writeTimeline(t, out);
console.log(`wrote ${out} from ${src} — ${s.words.length} words, emphasis on "${key.text}"`);
