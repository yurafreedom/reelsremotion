// compose/ — the semantic authoring SDK. A thin meaning-level layer over the
// existing engine primitives (src/presets.ts, src/keyframes.ts, src/compose.ts)
// and TimelineIO (editor/src/io.ts). Every function produces CONTRACT-valid data;
// nothing here duplicates the sampling engine or modifies engine/editor internals.
//
//   import * as reel from "./compose";
//   const t = reel.createTimeline();
//   const s = reel.addScene(t, { durationInFrames: 90 });
//   reel.revealWordByWord(s, ["ОНА", "не требует", "СВЕРХ", "меры"]);
//   reel.emphasize(reel.findWord(s, "СВЕРХ"), "punch-red");
//   reel.writeTimeline(t, "public/timeline.json");

export * from "./timeline"; // structure: createTimeline/addScene/setVideo/setTransition/setAudio/...
export * from "./text"; // words: addWord/addLine/findWord
export * from "./animation"; // motion/emphasis: slideIn/.../emphasize/moveAlong/recolorAt
export * from "./patterns"; // revealWordByWord/kineticBeat
export * from "./layout"; // stackVertical/SAFE_ZONE
export * from "./io"; // importTimeline/writeTimeline (TimelineIO reuse)

// Re-export the engine's import migration (enterFrom → slide-in keyframes) so an
// ASR draft can be made to animate before applying emphasis/transitions on top.
export { migrateTimeline, migrateWord } from "@engine/presets";
