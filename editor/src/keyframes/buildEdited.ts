// End-to-end seam proof (build step 11 / acceptance "Round-trip"): drive the REAL
// editor code path on the v3 (tracks) model — default(migrated) → edit(presets,
// custom bezier, spatial path, copy/paste) → export(serialize) — then write render
// props. Bundled+run via esbuild (node), so it uses the same modules the UI does.
//
//   node_modules/.bin/esbuild editor/src/keyframes/buildEdited.ts --bundle \
//     --platform=node --format=cjs --alias:@engine=./src | node

import { writeFileSync } from "node:fs";
import { DEFAULT_TIMELINE } from "../fixtures";
import { textTrackOf } from "@engine/types.v3";
import { serializeTimelineV3 } from "../io";
import {
  copyKeyframes,
  pasteKeyframes,
  setEasing,
  setPositionKey,
  setScalarKey,
  setSpatialTangent,
} from "./kfEdits";

const W0 = { wordIndex: 0 };
const W1 = { wordIndex: 1 };

// 1) Start from the v3 default (already migrated: enterFrom → keyframes).
let tl = DEFAULT_TIMELINE;

// 2) Edit word[0]: a rich, hand-authored motion — overwrite the migrated slide with
//    a curved 2D path + custom-bezier temporal easing, plus size/color/spin.
tl = setPositionKey(tl, W0, 0, { x: -320, y: 360 }, { spatialOut: { x: 260, y: -380 } });
tl = setPositionKey(tl, W0, 40, { x: 320, y: 360 }, { easing: { bezier: [0.2, 0.9, 0.2, 1] }, spatialIn: { x: -260, y: -380 } });
tl = setScalarKey(tl, W0, "size", 0, 40);
tl = setScalarKey(tl, W0, "size", 40, 120, "easeOut");
tl = setScalarKey(tl, W0, "color", 0, "#ffffff");
tl = setScalarKey(tl, W0, "color", 40, "#c0182a", "linear");
tl = setScalarKey(tl, W0, "rotation", 0, 0);
tl = setScalarKey(tl, W0, "rotation", 40, 360, "easeInOut");
tl = setScalarKey(tl, W0, "blur", 0, 24);
tl = setScalarKey(tl, W0, "blur", 14, 0, "easeOut");
tl = setSpatialTangent(tl, W0, 0, "out", { x: 280, y: -400 });
tl = setEasing(tl, W0, "size", 1, { bezier: [0.3, 0, 0.1, 1] });

// 3) Copy word[0]'s whole keyframe set and paste onto word[1] (copy/paste,
//    element-relative → reproduces the motion verbatim).
const clip = copyKeyframes(textTrackOf(tl)!.words[0])!;
tl = pasteKeyframes(tl, [W1], clip);

// 4) Export through the real v3 serializer (strips `_scene`).
const serialized = serializeTimelineV3(tl);
writeFileSync(
  "public/props_editor.json",
  JSON.stringify({ showGrid: false, timeline: serialized }, null, 2)
);

// Sanity: re-serialize must be deep-equal (idempotent export).
const again = serializeTimelineV3(serialized);
const stable = JSON.stringify(again) === JSON.stringify(serialized);
const words = textTrackOf(serialized)!.words;
console.log("wrote public/props_editor.json; export idempotent:", stable);
console.log("word0 tracks:", Object.keys(words[0].keyframes!));
console.log("word1 (pasted) tracks:", Object.keys(words[1].keyframes!));
if (!stable) process.exit(1);
