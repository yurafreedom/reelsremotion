// compose/render_reel.ts
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";

// src/types.v3.ts
var isV3 = (t) => !!t && Array.isArray(t.tracks);

// editor/src/v3util.ts
var stripSceneTags = (tl) => {
  const next = JSON.parse(JSON.stringify(tl));
  for (const tr of next.tracks) {
    if (tr.kind === "text") tr.words.forEach((w) => delete w._scene);
    if (tr.kind === "shape") tr.shapes.forEach((s) => delete s._scene);
  }
  return next;
};

// editor/src/io.ts
function serializeEasing(e) {
  if (e === void 0 || e === null) return void 0;
  if (typeof e === "string") return e;
  const b = e.bezier;
  return { bezier: [b[0], b[1], b[2], b[3]] };
}
var serializeVec2 = (v) => ({ x: v.x, y: v.y });
function serializeScalarKf(k) {
  const o = { frame: k.frame, value: k.value };
  const e = serializeEasing(k.easing);
  if (e !== void 0) o.easing = e;
  return o;
}
function serializePositionKf(k) {
  const o = { frame: k.frame, value: serializeVec2(k.value) };
  const e = serializeEasing(k.easing);
  if (e !== void 0) o.easing = e;
  if (k.spatialIn) o.spatialIn = serializeVec2(k.spatialIn);
  if (k.spatialOut) o.spatialOut = serializeVec2(k.spatialOut);
  return o;
}
var FLAT_TRACKS = [
  "size",
  "weight",
  "fontFamily",
  "letterSpacing",
  "color",
  "opacity",
  "rotation",
  "blur",
  "clipReveal"
];
function serializeKeyframes(kf) {
  const o = {};
  if (Array.isArray(kf.position) && kf.position.length > 0) {
    o.position = kf.position.map(serializePositionKf);
  }
  for (const key of FLAT_TRACKS) {
    const track = kf[key];
    if (Array.isArray(track) && track.length > 0) {
      o[key] = track.map(serializeScalarKf);
    }
  }
  return Object.keys(o).length > 0 ? o : void 0;
}
function serializeWord(w) {
  const o = {};
  o.text = w.text;
  o.start = w.start;
  o.end = w.end;
  o.x = w.x;
  o.y = w.y;
  o.font = w.font;
  o.size = w.size;
  o.weight = w.weight;
  o.color = w.color;
  o.enterFrom = w.enterFrom;
  if (w.case !== void 0 && w.case !== null) o.case = w.case;
  if (w.stroke !== void 0 && w.stroke !== null) {
    o.stroke = { color: w.stroke.color, width: w.stroke.width };
  }
  if (Array.isArray(w.shadow)) {
    o.shadow = w.shadow.map((sh) => {
      const so = {};
      if (sh.x !== void 0 && sh.x !== null) so.x = sh.x;
      if (sh.y !== void 0 && sh.y !== null) so.y = sh.y;
      so.blur = sh.blur;
      so.color = sh.color;
      return so;
    });
  }
  if (w.keyframes) {
    const kf = serializeKeyframes(w.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}
function serializeBackground(b) {
  switch (b.type) {
    case "color":
      return { type: "color", color: b.color };
    case "image": {
      const o = { type: "image", src: b.src ?? "placeholder" };
      if (b.fit !== void 0 && b.fit !== null) o.fit = b.fit;
      return o;
    }
    case "cover": {
      const o = { type: "cover", src: b.src ?? "placeholder" };
      if (b.startFrom !== void 0 && b.startFrom !== null) o.startFrom = b.startFrom;
      if (b.volume !== void 0 && b.volume !== null) o.volume = b.volume;
      if (b.muted !== void 0 && b.muted !== null) o.muted = b.muted;
      if (Array.isArray(b.speechRegions)) {
        o.speechRegions = b.speechRegions.map((r) => ({
          startFrame: r.startFrame,
          endFrame: r.endFrame
        }));
      }
      return o;
    }
    case "box": {
      const o = {
        type: "box",
        src: b.src ?? "placeholder",
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        borderRadius: b.borderRadius ?? 0,
        backColor: b.backColor
      };
      if (b.fit !== void 0 && b.fit !== null) o.fit = b.fit;
      if (b.startFrom !== void 0 && b.startFrom !== null) o.startFrom = b.startFrom;
      if (b.volume !== void 0 && b.volume !== null) o.volume = b.volume;
      if (b.muted !== void 0 && b.muted !== null) o.muted = b.muted;
      if (Array.isArray(b.speechRegions)) {
        o.speechRegions = b.speechRegions.map((r) => ({
          startFrame: r.startFrame,
          endFrame: r.endFrame
        }));
      }
      return o;
    }
    default:
      return { type: "color", color: "#000000" };
  }
}
var SHAPE_FLAT_TRACKS = [
  "width",
  "height",
  "color",
  "opacity",
  "rotation",
  "borderRadius",
  "blur"
];
function serializeShapeKeyframes(kf) {
  const o = {};
  if (Array.isArray(kf.position) && kf.position.length > 0) {
    o.position = kf.position.map(serializePositionKf);
  }
  for (const key of SHAPE_FLAT_TRACKS) {
    const track = kf[key];
    if (Array.isArray(track) && track.length > 0) {
      o[key] = track.map(serializeScalarKf);
    }
  }
  return Object.keys(o).length > 0 ? o : void 0;
}
function serializeShape(s) {
  const o = {};
  o.id = s.id;
  o.shape = s.shape;
  o.start = s.start;
  o.end = s.end;
  o.x = s.x;
  o.y = s.y;
  o.width = s.width;
  o.height = s.height;
  o.color = s.color;
  if (s.borderRadius !== void 0 && s.borderRadius !== null) o.borderRadius = s.borderRadius;
  if (s.stroke !== void 0 && s.stroke !== null) {
    o.stroke = { color: s.stroke.color, width: s.stroke.width };
  }
  if (s.opacity !== void 0 && s.opacity !== null) o.opacity = s.opacity;
  if (s.rotation !== void 0 && s.rotation !== null) o.rotation = s.rotation;
  if (s.keyframes) {
    const kf = serializeShapeKeyframes(s.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}
function serializeOverlay(ov) {
  const o = {};
  o.src = ov.src;
  o.start = ov.start;
  o.end = ov.end;
  o.x = ov.x;
  o.y = ov.y;
  o.width = ov.width;
  o.height = ov.height;
  if (ov.fit !== void 0 && ov.fit !== null) o.fit = ov.fit;
  if (ov.borderRadius !== void 0 && ov.borderRadius !== null) o.borderRadius = ov.borderRadius;
  if (ov.opacity !== void 0 && ov.opacity !== null) o.opacity = ov.opacity;
  if (ov.rotation !== void 0 && ov.rotation !== null) o.rotation = ov.rotation;
  if (ov.keyframes) {
    const kf = serializeShapeKeyframes(ov.keyframes);
    if (kf) o.keyframes = kf;
  }
  return o;
}
function serializeAudio(a) {
  if (a == null) return null;
  if (typeof a === "string") return a;
  const o = { src: a.src, volume: a.volume };
  if (a.fadeInFrames !== void 0 && a.fadeInFrames !== null) o.fadeInFrames = a.fadeInFrames;
  if (a.fadeOutFrames !== void 0 && a.fadeOutFrames !== null) o.fadeOutFrames = a.fadeOutFrames;
  if (a.ducking !== void 0 && a.ducking !== null) {
    o.ducking = {
      enabled: a.ducking.enabled,
      duckedVolume: a.ducking.duckedVolume,
      attackFrames: a.ducking.attackFrames,
      releaseFrames: a.ducking.releaseFrames
    };
  }
  return o;
}
function serializeTransition(t) {
  const o = {};
  o.type = t.type;
  o.durationInFrames = t.durationInFrames;
  if (t.direction !== void 0 && t.direction !== null) o.direction = t.direction;
  if (t.timing !== void 0 && t.timing !== null) o.timing = t.timing;
  return o;
}
function serializeScene(s) {
  const o = {};
  o.id = s.id;
  o.durationInFrames = s.durationInFrames;
  o.background = serializeBackground(s.background ?? { type: "color", color: "#000000" });
  if (Array.isArray(s.shapes) && s.shapes.length > 0) {
    o.shapes = s.shapes.map(serializeShape);
  }
  o.words = (s.words || []).map(serializeWord);
  if (Array.isArray(s.overlays) && s.overlays.length > 0) {
    o.overlays = s.overlays.map(serializeOverlay);
  }
  if (s.transitionToNext !== void 0 && s.transitionToNext !== null) {
    o.transitionToNext = serializeTransition(s.transitionToNext);
  }
  return o;
}
function serializeTimeline(t) {
  return {
    fps: t.fps,
    width: t.width,
    height: t.height,
    audio: serializeAudio(t.audio),
    scenes: (t.scenes || []).map(serializeScene)
  };
}
function validateTimeline(t) {
  const errs = [];
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    errs.push("root is not a Timeline object");
    return errs;
  }
  const o = t;
  for (const k of ["fps", "width", "height"]) {
    if (typeof o[k] !== "number") errs.push(k + " must be a number");
  }
  if ("background" in o && typeof o.background !== "string") {
    errs.push("background, if present (legacy), must be a string");
  }
  if (!("audio" in o)) errs.push("audio field missing (use null)");
  if (!Array.isArray(o.scenes)) {
    errs.push("scenes must be an array");
    return errs;
  }
  o.scenes.forEach((sUnknown, i) => {
    const s = sUnknown;
    if (typeof s.id !== "string") errs.push(`scenes[${i}].id must be a string`);
    if (typeof s.durationInFrames !== "number")
      errs.push(`scenes[${i}].durationInFrames must be a number`);
    if (!Array.isArray(s.words)) errs.push(`scenes[${i}].words must be an array`);
    (s.words || []).forEach((wUnknown, j) => {
      const w = wUnknown;
      for (const k of ["start", "end", "x", "y", "size", "weight"]) {
        if (typeof w[k] !== "number")
          errs.push(`scenes[${i}].words[${j}].${k} must be a number`);
      }
      if (typeof w.text !== "string")
        errs.push(`scenes[${i}].words[${j}].text must be a string`);
    });
  });
  return errs;
}
function validateTimelineV3(t) {
  const errs = [];
  if (!t || typeof t !== "object" || Array.isArray(t)) return ["root is not a Timeline object"];
  const o = t;
  for (const k of ["fps", "width", "height"]) if (typeof o[k] !== "number") errs.push(`${k} must be a number`);
  if (!Array.isArray(o.tracks)) errs.push("tracks must be an array");
  return errs;
}
function serializeTimelineV3(t) {
  return stripSceneTags(t);
}

// compose/render_reel.ts
var require2 = createRequire(import.meta.url);
var { bundle } = require2("@remotion/bundler");
var { selectComposition, renderMedia, ensureBrowser } = require2("@remotion/renderer");
var ROOT = process.cwd();
var tlPath = process.argv[2] ?? "public/timeline_reel.json";
var outPath = path.resolve(process.argv[3] ?? "out/reel.mp4");
(async () => {
  const raw = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  const timeline = isV3(raw) ? serializeTimelineV3(raw) : serializeTimeline(raw);
  const errs = isV3(timeline) ? validateTimelineV3(timeline) : validateTimeline(timeline);
  if (errs.length) throw new Error(`invalid timeline:
  ${errs.join("\n  ")}`);
  const localFontsOnly = process.env.REELS_LOCAL_FONTS_ONLY === "1";
  const concurrency = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 1));
  const inputProps = { timeline, showGrid: false, localFontsOnly };
  await ensureBrowser();
  console.log("bundling\u2026");
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    // REEL_PUBLIC_DIR → bundle against a SLIM public dir (only this reel's media)
    // so the bundler doesn't copy ~860MB of unused source media on a near-full disk.
    publicDir: process.env.REEL_PUBLIC_DIR ? path.resolve(process.env.REEL_PUBLIC_DIR) : path.join(ROOT, "public"),
    onProgress: () => {
    }
  });
  const composition = await selectComposition({ serveUrl, id: "Reels", inputProps });
  const totalFrames = composition.durationInFrames;
  console.log(`rendering ${totalFrames} frames \u2192 ${outPath}`);
  console.log(`concurrency=${concurrency} localFontsOnly=${localFontsOnly}`);
  let last = 0;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    // EXPORT-COMPAT FIX: imageFormat "jpeg" produced FULL-RANGE yuvj420p / bt470bg
    // h264, which Apple players (QuickTime/Preview/Safari) render as a single
    // FROZEN frame with no audio. Force the universally-decodable standard:
    // PNG frames (no full-range JPEG tag) → yuv420p, limited-range bt709.
    imageFormat: "png",
    pixelFormat: "yuv420p",
    colorSpace: "bt709",
    outputLocation: outPath,
    concurrency,
    inputProps,
    overwrite: true,
    onProgress: ({ renderedFrames }) => {
      const pct = Math.floor(renderedFrames / totalFrames * 100);
      if (pct >= last + 10) {
        last = pct;
        console.log(`  ${pct}% (${renderedFrames}/${totalFrames})`);
      }
    }
  });
  console.log(`done: ${outPath}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY29tcG9zZS9yZW5kZXJfcmVlbC50cyIsICIuLi9zcmMvdHlwZXMudjMudHMiLCAiLi4vZWRpdG9yL3NyYy92M3V0aWwudHMiLCAiLi4vZWRpdG9yL3NyYy9pby50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gcmVuZGVyX3JlZWwudHMgXHUyMDE0IGZ1bGwgbXA0IHJlbmRlciBvZiB0aGUgcmUtdGltZWQgcmVlbC4gU2FtZSByZW5kZXIgcGF0aCBhcyB0aGVcbi8vIGVkaXRvciB3b3JrZXIgKyBSZW1vdGlvbiBDTEk6IGJ1bmRsZSBzcmMvaW5kZXgudHMgXHUyMTkyIHNlbGVjdENvbXBvc2l0aW9uKFwiUmVlbHNcIilcbi8vIHdpdGggaW5wdXRQcm9wcyB7IHRpbWVsaW5lLCBzaG93R3JpZDpmYWxzZSB9IFx1MjE5MiByZW5kZXJNZWRpYSAoaDI2NCwgY3JmIDE4LCBqcGVnKS5cbi8vIFdZU0lXWUcgd2l0aCBjaGVjay50cyBzdGlsbHMgKGlkZW50aWNhbCBjb21wb3NpdGlvbiArIGlucHV0UHJvcHMpLlxuLy9cbi8vICAgbm9kZSBjb21wb3NlL3J1bi5tanMgY29tcG9zZS9yZW5kZXJfcmVlbC50cyBbcHVibGljL3RpbWVsaW5lX3JlZWwuanNvbl0gW291dC9yZWVsLm1wNF1cblxuaW1wb3J0IHsgY3JlYXRlUmVxdWlyZSB9IGZyb20gXCJub2RlOm1vZHVsZVwiO1xuaW1wb3J0ICogYXMgZnMgZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHR5cGUgeyBUaW1lbGluZSB9IGZyb20gXCJAZW5naW5lL3R5cGVzXCI7XG5pbXBvcnQgdHlwZSB7IFRpbWVsaW5lVjMgfSBmcm9tIFwiQGVuZ2luZS90eXBlcy52M1wiO1xuaW1wb3J0IHsgaXNWMyB9IGZyb20gXCJAZW5naW5lL3R5cGVzLnYzXCI7XG5pbXBvcnQge1xuICBzZXJpYWxpemVUaW1lbGluZSxcbiAgc2VyaWFsaXplVGltZWxpbmVWMyxcbiAgdmFsaWRhdGVUaW1lbGluZSxcbiAgdmFsaWRhdGVUaW1lbGluZVYzLFxufSBmcm9tIFwiLi9pb1wiO1xuXG5jb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1xuY29uc3QgeyBidW5kbGUgfSA9IHJlcXVpcmUoXCJAcmVtb3Rpb24vYnVuZGxlclwiKSBhcyB0eXBlb2YgaW1wb3J0KFwiQHJlbW90aW9uL2J1bmRsZXJcIik7XG5jb25zdCB7IHNlbGVjdENvbXBvc2l0aW9uLCByZW5kZXJNZWRpYSwgZW5zdXJlQnJvd3NlciB9ID1cbiAgcmVxdWlyZShcIkByZW1vdGlvbi9yZW5kZXJlclwiKSBhcyB0eXBlb2YgaW1wb3J0KFwiQHJlbW90aW9uL3JlbmRlcmVyXCIpO1xuXG5jb25zdCBST09UID0gcHJvY2Vzcy5jd2QoKTtcbmNvbnN0IHRsUGF0aCA9IHByb2Nlc3MuYXJndlsyXSA/PyBcInB1YmxpYy90aW1lbGluZV9yZWVsLmpzb25cIjtcbmNvbnN0IG91dFBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5hcmd2WzNdID8/IFwib3V0L3JlZWwubXA0XCIpO1xuXG4oYXN5bmMgKCkgPT4ge1xuICBjb25zdCByYXcgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyh0bFBhdGgsIFwidXRmOFwiKSkgYXMgVGltZWxpbmUgfCBUaW1lbGluZVYzO1xuICBjb25zdCB0aW1lbGluZSA9IGlzVjMocmF3KSA/IHNlcmlhbGl6ZVRpbWVsaW5lVjMocmF3KSA6IHNlcmlhbGl6ZVRpbWVsaW5lKHJhdyk7XG4gIGNvbnN0IGVycnMgPSBpc1YzKHRpbWVsaW5lKVxuICAgID8gdmFsaWRhdGVUaW1lbGluZVYzKHRpbWVsaW5lKVxuICAgIDogdmFsaWRhdGVUaW1lbGluZSh0aW1lbGluZSk7XG4gIGlmIChlcnJzLmxlbmd0aCkgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHRpbWVsaW5lOlxcbiAgJHtlcnJzLmpvaW4oXCJcXG4gIFwiKX1gKTtcblxuICBjb25zdCBsb2NhbEZvbnRzT25seSA9IHByb2Nlc3MuZW52LlJFRUxTX0xPQ0FMX0ZPTlRTX09OTFkgPT09IFwiMVwiO1xuICBjb25zdCBjb25jdXJyZW5jeSA9IE1hdGgubWF4KDEsIE51bWJlcihwcm9jZXNzLmVudi5SRU5ERVJfQ09OQ1VSUkVOQ1kgPz8gMSkpO1xuICBjb25zdCBpbnB1dFByb3BzID0geyB0aW1lbGluZSwgc2hvd0dyaWQ6IGZhbHNlLCBsb2NhbEZvbnRzT25seSB9O1xuICBhd2FpdCBlbnN1cmVCcm93c2VyKCk7XG4gIGNvbnNvbGUubG9nKFwiYnVuZGxpbmdcdTIwMjZcIik7XG4gIGNvbnN0IHNlcnZlVXJsID0gYXdhaXQgYnVuZGxlKHtcbiAgICBlbnRyeVBvaW50OiBwYXRoLmpvaW4oUk9PVCwgXCJzcmNcIiwgXCJpbmRleC50c1wiKSxcbiAgICAvLyBSRUVMX1BVQkxJQ19ESVIgXHUyMTkyIGJ1bmRsZSBhZ2FpbnN0IGEgU0xJTSBwdWJsaWMgZGlyIChvbmx5IHRoaXMgcmVlbCdzIG1lZGlhKVxuICAgIC8vIHNvIHRoZSBidW5kbGVyIGRvZXNuJ3QgY29weSB+ODYwTUIgb2YgdW51c2VkIHNvdXJjZSBtZWRpYSBvbiBhIG5lYXItZnVsbCBkaXNrLlxuICAgIHB1YmxpY0RpcjogcHJvY2Vzcy5lbnYuUkVFTF9QVUJMSUNfRElSXG4gICAgICA/IHBhdGgucmVzb2x2ZShwcm9jZXNzLmVudi5SRUVMX1BVQkxJQ19ESVIpXG4gICAgICA6IHBhdGguam9pbihST09ULCBcInB1YmxpY1wiKSxcbiAgICBvblByb2dyZXNzOiAoKSA9PiB7fSxcbiAgfSk7XG4gIGNvbnN0IGNvbXBvc2l0aW9uID0gYXdhaXQgc2VsZWN0Q29tcG9zaXRpb24oeyBzZXJ2ZVVybCwgaWQ6IFwiUmVlbHNcIiwgaW5wdXRQcm9wcyB9KTtcbiAgY29uc3QgdG90YWxGcmFtZXMgPSBjb21wb3NpdGlvbi5kdXJhdGlvbkluRnJhbWVzO1xuICBjb25zb2xlLmxvZyhgcmVuZGVyaW5nICR7dG90YWxGcmFtZXN9IGZyYW1lcyBcdTIxOTIgJHtvdXRQYXRofWApO1xuICBjb25zb2xlLmxvZyhgY29uY3VycmVuY3k9JHtjb25jdXJyZW5jeX0gbG9jYWxGb250c09ubHk9JHtsb2NhbEZvbnRzT25seX1gKTtcbiAgbGV0IGxhc3QgPSAwO1xuICBhd2FpdCByZW5kZXJNZWRpYSh7XG4gICAgY29tcG9zaXRpb24sXG4gICAgc2VydmVVcmwsXG4gICAgY29kZWM6IFwiaDI2NFwiLFxuICAgIGNyZjogMTgsXG4gICAgLy8gRVhQT1JULUNPTVBBVCBGSVg6IGltYWdlRm9ybWF0IFwianBlZ1wiIHByb2R1Y2VkIEZVTEwtUkFOR0UgeXV2ajQyMHAgLyBidDQ3MGJnXG4gICAgLy8gaDI2NCwgd2hpY2ggQXBwbGUgcGxheWVycyAoUXVpY2tUaW1lL1ByZXZpZXcvU2FmYXJpKSByZW5kZXIgYXMgYSBzaW5nbGVcbiAgICAvLyBGUk9aRU4gZnJhbWUgd2l0aCBubyBhdWRpby4gRm9yY2UgdGhlIHVuaXZlcnNhbGx5LWRlY29kYWJsZSBzdGFuZGFyZDpcbiAgICAvLyBQTkcgZnJhbWVzIChubyBmdWxsLXJhbmdlIEpQRUcgdGFnKSBcdTIxOTIgeXV2NDIwcCwgbGltaXRlZC1yYW5nZSBidDcwOS5cbiAgICBpbWFnZUZvcm1hdDogXCJwbmdcIixcbiAgICBwaXhlbEZvcm1hdDogXCJ5dXY0MjBwXCIsXG4gICAgY29sb3JTcGFjZTogXCJidDcwOVwiLFxuICAgIG91dHB1dExvY2F0aW9uOiBvdXRQYXRoLFxuICAgIGNvbmN1cnJlbmN5LFxuICAgIGlucHV0UHJvcHMsXG4gICAgb3ZlcndyaXRlOiB0cnVlLFxuICAgIG9uUHJvZ3Jlc3M6ICh7IHJlbmRlcmVkRnJhbWVzIH0pID0+IHtcbiAgICAgIGNvbnN0IHBjdCA9IE1hdGguZmxvb3IoKHJlbmRlcmVkRnJhbWVzIC8gdG90YWxGcmFtZXMpICogMTAwKTtcbiAgICAgIGlmIChwY3QgPj0gbGFzdCArIDEwKSB7XG4gICAgICAgIGxhc3QgPSBwY3Q7XG4gICAgICAgIGNvbnNvbGUubG9nKGAgICR7cGN0fSUgKCR7cmVuZGVyZWRGcmFtZXN9LyR7dG90YWxGcmFtZXN9KWApO1xuICAgICAgfVxuICAgIH0sXG4gIH0pO1xuICBjb25zb2xlLmxvZyhgZG9uZTogJHtvdXRQYXRofWApO1xuICBwcm9jZXNzLmV4aXQoMCk7XG59KSgpLmNhdGNoKChlKSA9PiB7XG4gIGNvbnNvbGUuZXJyb3IoZSk7XG4gIHByb2Nlc3MuZXhpdCgxKTtcbn0pO1xuIiwgIi8vIENPTlRSQUNUIHYzIHNjaGVtYSBcdTIwMTQgc2VxdWVudGlhbCB0cmFja3Mgb24gYW4gQUJTT0xVVEUgdGltZWxpbmUuXG4vL1xuLy8gVGhpcyBSRVBMQUNFUyB0aGUgc2NlbmUgbW9kZWwgKHNyYy90eXBlcy50cyBgVGltZWxpbmUuc2NlbmVzW11gKSB3aXRoXG4vLyBgVGltZWxpbmUudHJhY2tzW11gLiBBbGwgY2xpcC9lbGVtZW50IHN0YXJ0L2VuZCBhcmUgQUJTT0xVVEUgdGltZWxpbmUgZnJhbWVzXG4vLyAoZnJvbSB0aGUgc3RhcnQgb2YgdGhlIHdob2xlIHJlZWwpLiBLZXlmcmFtZSBmcmFtZXMgc3RheSBFTEVNRU5ULXJlbGF0aXZlXG4vLyAoMCA9IGVsZW1lbnQuc3RhcnQpIFx1MjAxNCB1bmNoYW5nZWQgZnJvbSB2Miwgd2hpY2ggaXMgd2h5IGBXb3JkYC9gU2hhcGVgL2tleWZyYW1lXG4vLyB0eXBlcyBhcmUgcmV1c2VkIHZlcmJhdGltIGZyb20gLi90eXBlczogb25seSB0aGUgdGltaW5nIFNFTUFOVElDUyBjaGFuZ2UuXG4vL1xuLy8gdjIgKHNjZW5lcykgXHUyMTkyIHYzICh0cmFja3MpIGlzIHBlcmZvcm1lZCBieSBzcmMvbWlncmF0ZVYzLnRzIChpZGVtcG90ZW50KS4gVGhlXG4vLyBlbmdpbmUgKFZpZGVvLnRzeC9Sb290LnRzeCkgcmVuZGVycyB0aGlzIHYzIG1vZGVsOyBvbGQgdjIgcHJvcHMgYXJlIG1pZ3JhdGVkXG4vLyBvbiBsb2FkIHNvIHRoZXkga2VlcCB3b3JraW5nLlxuXG5pbXBvcnQgdHlwZSB7XG4gIEJhY2tncm91bmRGaXQsXG4gIER1Y2tpbmcsXG4gIFNoYXBlS2V5ZnJhbWVzLFxuICBTcGVlY2hSZWdpb24sXG4gIFRyYW5zaXRpb25UeXBlLFxuICBUcmFuc2l0aW9uRGlyLFxuICBXb3JkLFxuICBTaGFwZSxcbn0gZnJvbSBcIi4vdHlwZXNcIjtcblxuLy8gUmUtZXhwb3J0IHRoZSBlbGVtZW50IHR5cGVzIHVuY2hhbmdlZCBcdTIwMTQgaW4gdjMgdGhlaXIgc3RhcnQvZW5kIGFyZSBBQlNPTFVURS5cbmV4cG9ydCB0eXBlIHsgV29yZCwgU2hhcGUgfSBmcm9tIFwiLi90eXBlc1wiO1xuXG4vKiogSW50ZXJuYWwsIE5PTi1zZXJpYWxpemVkIGdyb3VwaW5nIGhpbnQgd3JpdHRlbiBieSBtaWdyYXRlVjJ0b1YzIG9udG8gbWlncmF0ZWRcbiAqICB3b3Jkcy9zaGFwZXMgc28gdGhlIHNlZ21lbnQtY29tcG9zaXRlIHJlbmRlcmVyIGNhbiByZXByb2R1Y2UgdjIncyBleGFjdFxuICogIHBlci1zY2VuZSBjb21wb3NpdGluZyBcdTIwMTQgZXZlbiB3aGVuIGFuIGVsZW1lbnQgc3RhcnRzIGluc2lkZSBhIHRyYW5zaXRpb25cbiAqICBvdmVybGFwICh3aGVyZSBhYnNvbHV0ZSBjb29yZGluYXRlcyBhbG9uZSBhcmUgYW1iaWd1b3VzKS4gTk9UIHBhcnQgb2YgdGhlXG4gKiAgb24tZGlzayBDT05UUkFDVDsgdGhlIGZ1dHVyZSB2MyBzZXJpYWxpemVyIE1VU1Qgc3RyaXAgYF9zY2VuZWAuICovXG5leHBvcnQgdHlwZSBTY2VuZVRhZ2dlZDxUPiA9IFQgJiB7IF9zY2VuZT86IG51bWJlciB9O1xuXG4vKiogVmlkZW8vaW1hZ2UgZml0LiBgY292ZXJgID0gZnVsbHNjcmVlbjsgYGNvbnRhaW5gID0gY2VudGVyZWQgYm94IG92ZXIgYSBmaWxsLiAqL1xuZXhwb3J0IHR5cGUgRml0ID0gQmFja2dyb3VuZEZpdDsgLy8gJ2NvdmVyJyB8ICdjb250YWluJ1xuXG4vKiogQSB0cmFuc2l0aW9uIGxpdmVzIG9uIGEgY2xpcCBhcyBgdHJhbnNpdGlvblRvTmV4dGAgPSB0aGUgYmxlbmQgYXQgdGhlIEpPSU4gd2l0aFxuICogIHRoZSBuZXh0IGNsaXAgb24gdGhlIFNBTUUgdHJhY2sgKGFuIG92ZXJsYXApLiBJZGVudGljYWwgc2hhcGUgdG8gdjJcbiAqICBgU2NlbmVUcmFuc2l0aW9uYCwgcmVuYW1lZCBwZXIgQ09OVFJBQ1QgdjMuICovXG5leHBvcnQgdHlwZSBDbGlwVHJhbnNpdGlvbiA9IHtcbiAgdHlwZTogVHJhbnNpdGlvblR5cGU7XG4gIC8qKiBPVkVSTEFQOiBmcmFtZXMgY29uc3VtZWQgZnJvbSB0aGUgZW5kIG9mIHRoaXMgY2xpcCBBTkQgdGhlIHN0YXJ0IG9mIHRoZSBuZXh0LiAqL1xuICBkdXJhdGlvbkluRnJhbWVzOiBudW1iZXI7XG4gIGRpcmVjdGlvbj86IFRyYW5zaXRpb25EaXI7XG4gIHRpbWluZz86IFwibGluZWFyXCIgfCBcInNwcmluZ1wiO1xufTtcblxuLy8gPT09PT0gVmlzdWFsIGNsaXBzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gVmlkZW8gdHJhY2sgaG9sZHMgdmlkZW8gfCBjb2xvcjsgaW1hZ2UgdHJhY2tzIGhvbGQgaW1hZ2UuXG5cbmV4cG9ydCB0eXBlIFZpZGVvQ2xpcCA9IHtcbiAgaWQ6IHN0cmluZztcbiAga2luZDogXCJ2aWRlb1wiO1xuICAvKiogUGF0aCByZWxhdGl2ZSB0byBwdWJsaWMvLCBvciBcInBsYWNlaG9sZGVyXCIgXHUyMTkyIHN0dWIgcmVjdGFuZ2xlIChuZXZlciBmYWlscykuICovXG4gIHNyYzogc3RyaW5nO1xuICAvKiogQUJTT0xVVEUgcGxhY2VtZW50IG9uIHRoZSB0cmFjay4gKi9cbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIC8qKiBTb3VyY2UgaW4tcG9pbnQ6IHdoaWNoIHNvdXJjZSBmcmFtZSBwbGF5cyBhdCBjbGlwIHN0YXJ0IChzZXQgYnkgVFJJTSkuICovXG4gIHN0YXJ0RnJvbTogbnVtYmVyO1xuICAvKiogJ2NvdmVyJyA9IGZ1bGxzY3JlZW47ICdjb250YWluJyA9IGNlbnRlcmVkIGJveCBvdmVyIGBiYWNrQ29sb3JgLiAqL1xuICBmaXQ6IEZpdDtcbiAgLyoqIExldHRlcmJveC9iYWNrZ3JvdW5kIGZpbGwgd2hlbiBgZml0Oidjb250YWluJ2AgKHRoZSBib3gtb3Zlci1jb2xvciBsb29rKS4gKi9cbiAgYmFja0NvbG9yPzogc3RyaW5nO1xuICB2b2x1bWU/OiBudW1iZXI7XG4gIG11dGVkPzogYm9vbGVhbjtcbiAgc3BlZWNoUmVnaW9ucz86IFNwZWVjaFJlZ2lvbltdO1xuICB0cmFuc2l0aW9uVG9OZXh0PzogQ2xpcFRyYW5zaXRpb247XG5cbiAgLy8gXHUyNTAwXHUyNTAwIHYzLjAgQURESVRJVkUgRVhURU5TSU9OIChvcHRpb25hbCwgYmFjay1jb21wYXRpYmxlKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbiAgLy8gUHJlc2VydmUgdGhlIHYyIGluc2V0LWJveCBnZW9tZXRyeSBsb3NzbGVzc2x5IHdoZW4gbWlncmF0aW5nIGFcbiAgLy8gQm94QmFja2dyb3VuZCAoZml0Oidjb250YWluJykuIFdoZW4gYW55IG9mIHRoZXNlIGlzIHByZXNlbnQgdGhlIHJlbmRlcmVyXG4gIC8vIGRyYXdzIHRoZSB2aWRlbyBhcyBhIHBvc2l0aW9uZWQvc2l6ZWQvcm91bmRlZCBib3ggb3ZlciBgYmFja0NvbG9yYCAoZXhhY3RcbiAgLy8gdjIgQm94TGF5ZXIgbG9vaykgaW5zdGVhZCBvZiBhIGZ1bGwtZnJhbWUgbGV0dGVyYm94LiBBYnNlbnQgXHUyMTkyIHBsYWluXG4gIC8vIGBvYmplY3RGaXQ6Y29udGFpbmAgZnVsbC1mcmFtZS4gQ09OVFJBQ1QgdjMgYmFzZSBzaGFwZSBpcyB1bmNoYW5nZWQuXG4gIC8qKiBPZmZzZXQgaW4gcHggb2YgdGhlIGJveCBDRU5URVIgZnJvbSBmcmFtZSBjZW50ZXIuICovXG4gIHg/OiBudW1iZXI7XG4gIHk/OiBudW1iZXI7XG4gIC8qKiBCb3ggc2l6ZSBpbiBweC4gKi9cbiAgd2lkdGg/OiBudW1iZXI7XG4gIGhlaWdodD86IG51bWJlcjtcbiAgLyoqIENvcm5lciByb3VuZGluZyBpbiBweC4gKi9cbiAgYm9yZGVyUmFkaXVzPzogbnVtYmVyO1xuICAvKiogT3B0aW9uYWwgc2FtZS1zb3VyY2UgdmVydGljYWwtZmlsbCB0cmVhdG1lbnQgZm9yIGxhbmRzY2FwZSBmb290YWdlLiAqL1xuICBiYWNrZ3JvdW5kQmx1cj86IG51bWJlcjtcbiAgYmFja2dyb3VuZEJyaWdodG5lc3M/OiBudW1iZXI7XG4gIGJhY2tncm91bmRTYXR1cmF0aW9uPzogbnVtYmVyO1xuICBiYWNrZ3JvdW5kU2NhbGU/OiBudW1iZXI7XG59O1xuXG5leHBvcnQgdHlwZSBDb2xvckNsaXAgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIGtpbmQ6IFwiY29sb3JcIjtcbiAgY29sb3I6IHN0cmluZztcbiAgLyoqIEFCU09MVVRFIHBsYWNlbWVudC4gKi9cbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIHRyYW5zaXRpb25Ub05leHQ/OiBDbGlwVHJhbnNpdGlvbjtcbn07XG5cbmV4cG9ydCB0eXBlIEltYWdlQ2xpcCA9IHtcbiAgaWQ6IHN0cmluZztcbiAga2luZDogXCJpbWFnZVwiO1xuICBzcmM6IHN0cmluZztcbiAgLyoqIEFCU09MVVRFIHBsYWNlbWVudC4gKi9cbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG4gIC8qKiBPZmZzZXQgaW4gcHggb2YgdGhlIGltYWdlIENFTlRFUiBmcm9tIGZyYW1lIGNlbnRlcjsgc2l6ZSBpbiBweC4gKi9cbiAgeDogbnVtYmVyO1xuICB5OiBudW1iZXI7XG4gIHdpZHRoOiBudW1iZXI7XG4gIGhlaWdodDogbnVtYmVyO1xuICBmaXQ/OiBGaXQ7XG4gIGJvcmRlclJhZGl1cz86IG51bWJlcjtcbiAgb3BhY2l0eT86IG51bWJlcjtcbiAgcm90YXRpb24/OiBudW1iZXI7XG4gIC8qKiBTb3VyY2UgaW4tcG9pbnQgd2hlbiB0aGlzIGltYWdlLXRyYWNrIGNhcnJpZXIgaXMgYSB2aWRlbyBvdmVybGF5LiAqL1xuICBzdGFydEZyb20/OiBudW1iZXI7XG4gIC8qKiBBbmltYXRhYmxlIGxpa2UgYSBzaGFwZSAoc2FtcGxlZCB2aWEga2V5ZnJhbWVzLnRzOyBmcmFtZXMgZWxlbWVudC1yZWxhdGl2ZSkuICovXG4gIGtleWZyYW1lcz86IFNoYXBlS2V5ZnJhbWVzO1xuXG4gIC8vIFx1MjUwMFx1MjUwMCB2My4wIEFERElUSVZFIEVYVEVOU0lPTiAob3B0aW9uYWwsIGJhY2stY29tcGF0aWJsZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4gIC8vIENPTlRSQUNUIHYzIEltYWdlQ2xpcCBoYXMgbm8gdHJhbnNpdGlvblRvTmV4dDsgd2UgYWRkIGl0IHNvIGFuIGltYWdlLWJnXG4gIC8vIHNjZW5lIHRoYXQgaGFkIGEgYHRyYW5zaXRpb25Ub05leHRgIG1pZ3JhdGVzIGxvc3NsZXNzbHkuIEFic2VudCBcdTIxOTIgbm9uZS5cbiAgdHJhbnNpdGlvblRvTmV4dD86IENsaXBUcmFuc2l0aW9uO1xufTtcblxuLy8gPT09PT0gQXVkaW8gY2xpcCA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5leHBvcnQgdHlwZSBBdWRpb0NsaXAgPSB7XG4gIGlkOiBzdHJpbmc7XG4gIHNyYzogc3RyaW5nO1xuICAvKiogQUJTT0xVVEUgcGxhY2VtZW50LiAqL1xuICBzdGFydDogbnVtYmVyO1xuICBlbmQ6IG51bWJlcjtcbiAgLyoqIFNvdXJjZSBpbi1wb2ludCAoVFJJTSkuICovXG4gIHN0YXJ0RnJvbTogbnVtYmVyO1xuICB2b2x1bWU6IG51bWJlcjtcbiAgZmFkZUluRnJhbWVzPzogbnVtYmVyO1xuICBmYWRlT3V0RnJhbWVzPzogbnVtYmVyO1xuICBkdWNraW5nPzogRHVja2luZztcbn07XG5cbi8vID09PT09IFRyYWNrcyAoZGlzY3JpbWluYXRlZCBieSBraW5kKSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIHotb3JkZXIgYm90dG9tXHUyMTkydG9wOiB2aWRlbyBcdTIxOTIgaW1hZ2UocykgXHUyMTkyIHNoYXBlIFx1MjE5MiB0ZXh0LiBBdWRpbyBoYXMgbm8gei5cblxuZXhwb3J0IHR5cGUgVmlkZW9UcmFjayA9IHsgaWQ6IHN0cmluZzsga2luZDogXCJ2aWRlb1wiOyBjbGlwczogKFZpZGVvQ2xpcCB8IENvbG9yQ2xpcClbXSB9O1xuZXhwb3J0IHR5cGUgSW1hZ2VUcmFjayA9IHsgaWQ6IHN0cmluZzsga2luZDogXCJpbWFnZVwiOyBjbGlwczogSW1hZ2VDbGlwW10gfTtcbmV4cG9ydCB0eXBlIFNoYXBlVHJhY2sgPSB7IGlkOiBzdHJpbmc7IGtpbmQ6IFwic2hhcGVcIjsgc2hhcGVzOiBTaGFwZVtdIH07XG5leHBvcnQgdHlwZSBUZXh0VHJhY2sgPSB7IGlkOiBzdHJpbmc7IGtpbmQ6IFwidGV4dFwiOyB3b3JkczogV29yZFtdIH07XG5leHBvcnQgdHlwZSBBdWRpb1RyYWNrVjMgPSB7IGlkOiBzdHJpbmc7IGtpbmQ6IFwiYXVkaW9cIjsgY2xpcHM6IEF1ZGlvQ2xpcFtdIH07XG5cbmV4cG9ydCB0eXBlIFRyYWNrID0gVmlkZW9UcmFjayB8IEltYWdlVHJhY2sgfCBTaGFwZVRyYWNrIHwgVGV4dFRyYWNrIHwgQXVkaW9UcmFja1YzO1xuZXhwb3J0IHR5cGUgVHJhY2tLaW5kID0gVHJhY2tbXCJraW5kXCJdO1xuXG5leHBvcnQgdHlwZSBUaW1lbGluZVYzID0ge1xuICBmcHM6IG51bWJlcjtcbiAgd2lkdGg6IG51bWJlcjtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIC8qKiBUb3RhbCA9IG1heCBjbGlwIGBlbmRgIGFjcm9zcyB0cmFja3MgKFx1MDNBMyBzY2VuZSBkdXJhdGlvbnMgXHUyMjEyIFx1MDNBMyBvdmVybGFwcykuICovXG4gIGR1cmF0aW9uSW5GcmFtZXM6IG51bWJlcjtcbiAgLyoqIE9wdGlvbmFsIG1lYXN1cmVkIHN1YnRpdGxlIGZvdW5kYXRpb24gbWV0YWRhdGE7IGFkZGl0aXZlIGFuZCByZW5kZXItbmV1dHJhbC4gKi9cbiAgc3VidGl0bGVMYXlvdXQ/OiB7XG4gICAgc3lzdGVtOiBcIldJRFRIX0FXQVJFX0ZJWEVEX1NVQlRJVExFX0xBWU9VVFwiO1xuICAgIG1heExpbmVzOiBudW1iZXI7XG4gICAgbWluaW11bUZvbnRTaXplOiBudW1iZXI7XG4gICAgaW50ZXJuYWxNYXJnaW46IG51bWJlcjtcbiAgICBzYWZlQm91bmRzOiB7IGxlZnQ6IG51bWJlcjsgcmlnaHQ6IG51bWJlcjsgdG9wOiBudW1iZXI7IGJvdHRvbTogbnVtYmVyIH07XG4gICAgZ3JvdXBzOiB1bmtub3duW107XG4gIH07XG4gIHRyYWNrczogVHJhY2tbXTtcbn07XG5cbi8qKiBUb3AtbGV2ZWwgY29tcG9zaXRpb24gaW5wdXRQcm9wcyBmb3IgdGhlIHYzIGVuZ2luZS4gKi9cbmV4cG9ydCB0eXBlIFJlZWxzUHJvcHNWMyA9IHtcbiAgdGltZWxpbmU6IFRpbWVsaW5lVjM7XG4gIHNob3dHcmlkOiBib29sZWFuO1xufTtcblxuLy8gPT09PT0gVHlwZSBndWFyZHMgLyB0cmFjayBhY2Nlc3NvcnMgKHNoYXJlZCBieSBlbmdpbmUgKyBtaWdyYXRpb24pID09PT09PT09PVxuXG5leHBvcnQgY29uc3QgaXNWMyA9ICh0OiB1bmtub3duKTogdCBpcyBUaW1lbGluZVYzID0+XG4gICEhdCAmJiBBcnJheS5pc0FycmF5KCh0IGFzIFRpbWVsaW5lVjMpLnRyYWNrcyk7XG5cbmV4cG9ydCBjb25zdCB2aWRlb1RyYWNrT2YgPSAodDogVGltZWxpbmVWMyk6IFZpZGVvVHJhY2sgfCB1bmRlZmluZWQgPT5cbiAgdC50cmFja3MuZmluZCgodHIpOiB0ciBpcyBWaWRlb1RyYWNrID0+IHRyLmtpbmQgPT09IFwidmlkZW9cIik7XG5leHBvcnQgY29uc3QgaW1hZ2VUcmFja3NPZiA9ICh0OiBUaW1lbGluZVYzKTogSW1hZ2VUcmFja1tdID0+XG4gIHQudHJhY2tzLmZpbHRlcigodHIpOiB0ciBpcyBJbWFnZVRyYWNrID0+IHRyLmtpbmQgPT09IFwiaW1hZ2VcIik7XG5leHBvcnQgY29uc3Qgc2hhcGVUcmFja09mID0gKHQ6IFRpbWVsaW5lVjMpOiBTaGFwZVRyYWNrIHwgdW5kZWZpbmVkID0+XG4gIHQudHJhY2tzLmZpbmQoKHRyKTogdHIgaXMgU2hhcGVUcmFjayA9PiB0ci5raW5kID09PSBcInNoYXBlXCIpO1xuZXhwb3J0IGNvbnN0IHRleHRUcmFja09mID0gKHQ6IFRpbWVsaW5lVjMpOiBUZXh0VHJhY2sgfCB1bmRlZmluZWQgPT5cbiAgdC50cmFja3MuZmluZCgodHIpOiB0ciBpcyBUZXh0VHJhY2sgPT4gdHIua2luZCA9PT0gXCJ0ZXh0XCIpO1xuZXhwb3J0IGNvbnN0IGF1ZGlvVHJhY2tPZiA9ICh0OiBUaW1lbGluZVYzKTogQXVkaW9UcmFja1YzIHwgdW5kZWZpbmVkID0+XG4gIHQudHJhY2tzLmZpbmQoKHRyKTogdHIgaXMgQXVkaW9UcmFja1YzID0+IHRyLmtpbmQgPT09IFwiYXVkaW9cIik7XG4iLCAiLy8gRWRpdG9yLXNpZGUgdGltaW5nL3RvcG9sb2d5IGhlbHBlcnMgZm9yIHRoZSB2MyAodHJhY2tzLCBhYnNvbHV0ZSBheGlzKSBtb2RlbC5cbi8vIFRoZSBlbmdpbmUgb3ducyByZW5kZXItdGltZSBzYW1wbGluZy90cmFuc2l0aW9ucyAoc3JjL2NvbXBvc2UudHMsIHNyYy9WaWRlby50c3gpO1xuLy8gdGhpcyBtb2R1bGUgaXMgdGhlIGVkaXRvcidzIHNtYWxsIHJlYWQtbW9kZWwgb3ZlciBhIFRpbWVsaW5lVjM6IHRvdGFsIGR1cmF0aW9uLFxuLy8gd2hpY2ggZWxlbWVudHMgYXJlIGxpdmUgYXQgYSBmcmFtZSwgYW5kIHRoZSBwZXItY2xpcCB0cmFuc2l0aW9uIG92ZXJsYXAgKG1pcnJvcnNcbi8vIFZpZGVvLnRzeCBzZWdPdmVybGFwQWZ0ZXIgc28gdGhlIHRpbWVsaW5lIFVJIHNob3dzIGV4YWN0bHkgd2hhdCByZW5kZXJzKS5cblxuaW1wb3J0IHR5cGUge1xuICBBdWRpb0NsaXAsXG4gIENsaXBUcmFuc2l0aW9uLFxuICBDb2xvckNsaXAsXG4gIEltYWdlQ2xpcCxcbiAgVGltZWxpbmVWMyxcbiAgVHJhY2ssXG4gIFZpZGVvQ2xpcCxcbn0gZnJvbSBcIkBlbmdpbmUvdHlwZXMudjNcIjtcbmltcG9ydCB7XG4gIGF1ZGlvVHJhY2tPZixcbiAgaW1hZ2VUcmFja3NPZixcbiAgc2hhcGVUcmFja09mLFxuICB0ZXh0VHJhY2tPZixcbiAgdmlkZW9UcmFja09mLFxufSBmcm9tIFwiQGVuZ2luZS90eXBlcy52M1wiO1xuXG5leHBvcnQgdHlwZSBWaXN1YWxDbGlwID0gVmlkZW9DbGlwIHwgQ29sb3JDbGlwIHwgSW1hZ2VDbGlwO1xuXG4vKiogRXZlcnkgY2xpcC9lbGVtZW50IGVuZCBvbiBhIHRyYWNrIChmb3IgZHVyYXRpb24gKyBsYW5lIGxheW91dCkuICovXG5jb25zdCB0cmFja0VuZHMgPSAodHI6IFRyYWNrKTogbnVtYmVyW10gPT4ge1xuICBzd2l0Y2ggKHRyLmtpbmQpIHtcbiAgICBjYXNlIFwidmlkZW9cIjpcbiAgICBjYXNlIFwiaW1hZ2VcIjpcbiAgICBjYXNlIFwiYXVkaW9cIjpcbiAgICAgIHJldHVybiB0ci5jbGlwcy5tYXAoKGMpID0+IGMuZW5kKTtcbiAgICBjYXNlIFwic2hhcGVcIjpcbiAgICAgIHJldHVybiB0ci5zaGFwZXMubWFwKChzKSA9PiBzLmVuZCk7XG4gICAgY2FzZSBcInRleHRcIjpcbiAgICAgIHJldHVybiB0ci53b3Jkcy5tYXAoKHcpID0+IHcuZW5kKTtcbiAgfVxufTtcblxuLyoqIFRvdGFsIGNvbXBvc2l0aW9uIGxlbmd0aCA9IG1heCBjbGlwL2VsZW1lbnQgYGVuZGAgYWNyb3NzIGV2ZXJ5IHRyYWNrLiBBbHdheXMgXHUyMjY1MS5cbiAqICAoQ09OVFJBQ1QgdjMgXHUwMEE3XCJDbGlwcyBvbiBhIHRyYWNrXCI6IHRvdGFsID0gbWF4IGVuZCBhY3Jvc3MgdHJhY2tzLikgKi9cbmV4cG9ydCBjb25zdCBkdXJhdGlvblYzID0gKHRsOiBUaW1lbGluZVYzKTogbnVtYmVyID0+IHtcbiAgbGV0IG1heCA9IDA7XG4gIGZvciAoY29uc3QgdHIgb2YgdGwudHJhY2tzKSBmb3IgKGNvbnN0IGUgb2YgdHJhY2tFbmRzKHRyKSkgaWYgKGUgPiBtYXgpIG1heCA9IGU7XG4gIHJldHVybiBNYXRoLm1heCgxLCBtYXgpO1xufTtcblxuLyoqIFZpc3VhbCBjbGlwcyBvZiB0aGUgdmlkZW8gdHJhY2sgKHZpZGVvfGNvbG9yKSBpbiBzdGFydCBvcmRlci4gKi9cbmV4cG9ydCBjb25zdCB2aWRlb0NsaXBzID0gKHRsOiBUaW1lbGluZVYzKTogKFZpZGVvQ2xpcCB8IENvbG9yQ2xpcClbXSA9PlxuICBbLi4uKHZpZGVvVHJhY2tPZih0bCk/LmNsaXBzID8/IFtdKV0uc29ydCgoYSwgYikgPT4gYS5zdGFydCAtIGIuc3RhcnQpO1xuXG4vKiogQWxsIGltYWdlIGNsaXBzIGFjcm9zcyBpbWFnZSB0cmFja3MgKGVhY2ggdHJhY2sgaXMgaXRzIG93biB6LWxheWVyKS4gKi9cbmV4cG9ydCBjb25zdCBhbGxJbWFnZUNsaXBzID0gKHRsOiBUaW1lbGluZVYzKTogSW1hZ2VDbGlwW10gPT5cbiAgaW1hZ2VUcmFja3NPZih0bCkuZmxhdE1hcCgoaXQpID0+IGl0LmNsaXBzKTtcblxuLyoqIEVmZmVjdGl2ZSB0cmFuc2l0aW9uIG92ZXJsYXAgKGZyYW1lcykgY29uc3VtZWQgQUZURVIgY2xpcCBgaWAgb24gYSBjbGlwIGxpc3RcbiAqICAodmlkZW8gdHJhY2spLiAwID0gaGFyZCBjdXQuIE1pcnJvcnMgVmlkZW8udHN4IHNlZ092ZXJsYXBBZnRlciBleGFjdGx5LiAqL1xuZXhwb3J0IGNvbnN0IGNsaXBPdmVybGFwQWZ0ZXIgPSAoXG4gIGNsaXBzOiB7IHN0YXJ0OiBudW1iZXI7IGVuZDogbnVtYmVyOyB0cmFuc2l0aW9uVG9OZXh0PzogQ2xpcFRyYW5zaXRpb24gfVtdLFxuICBpOiBudW1iZXJcbik6IG51bWJlciA9PiB7XG4gIGNvbnN0IGMgPSBjbGlwc1tpXTtcbiAgY29uc3QgbiA9IGNsaXBzW2kgKyAxXTtcbiAgaWYgKCFjIHx8ICFuKSByZXR1cm4gMDtcbiAgY29uc3QgdCA9IGMudHJhbnNpdGlvblRvTmV4dDtcbiAgaWYgKCF0IHx8IHQudHlwZSA9PT0gXCJub25lXCIpIHJldHVybiAwO1xuICBjb25zdCB3YW50ID0gTWF0aC5yb3VuZCh0LmR1cmF0aW9uSW5GcmFtZXMpO1xuICBpZiAod2FudCA8PSAwKSByZXR1cm4gMDtcbiAgY29uc3QgZHVyQSA9IGMuZW5kIC0gYy5zdGFydDtcbiAgY29uc3QgZHVyQiA9IG4uZW5kIC0gbi5zdGFydDtcbiAgY29uc3QgbWF4ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oZHVyQSwgZHVyQikgLSAxKTtcbiAgcmV0dXJuIE1hdGgubWluKHdhbnQsIG1heCk7XG59O1xuXG4vKiogSW5kZXggb2YgdGhlIHZpZGVvLXRyYWNrIGNsaXAgY292ZXJpbmcgYW4gYWJzb2x1dGUgZnJhbWUgKGxhdGVzdCBzdGFydGVkKSwgb3JcbiAqICAtMSBpZiBub25lLiBVc2VkIGJ5IHRoZSBjYW52YXMgdG8gc2VsZWN0IFwidGhlIGJhY2tncm91bmQgdW5kZXIgdGhlIHBsYXloZWFkXCIuICovXG5leHBvcnQgY29uc3QgdmlkZW9DbGlwSW5kZXhBdCA9ICh0bDogVGltZWxpbmVWMywgZnJhbWU6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIGNvbnN0IGNsaXBzID0gdmlkZW9UcmFja09mKHRsKT8uY2xpcHMgPz8gW107XG4gIGxldCBpZHggPSAtMTtcbiAgY2xpcHMuZm9yRWFjaCgoYywgaSkgPT4ge1xuICAgIGlmIChmcmFtZSA+PSBjLnN0YXJ0ICYmIGZyYW1lIDwgYy5lbmQpIGlkeCA9IGk7XG4gIH0pO1xuICByZXR1cm4gaWR4O1xufTtcblxuLyoqIFdvcmQgaW5kaWNlcyBsaXZlIGF0IGFuIGFic29sdXRlIGZyYW1lIChzdGFydCBcdTIyNjQgZiA8IGVuZCkuICovXG5leHBvcnQgY29uc3QgYWN0aXZlV29yZEluZGljZXMgPSAodGw6IFRpbWVsaW5lVjMsIGZyYW1lOiBudW1iZXIpOiBudW1iZXJbXSA9PiB7XG4gIGNvbnN0IHdvcmRzID0gdGV4dFRyYWNrT2YodGwpPy53b3JkcyA/PyBbXTtcbiAgY29uc3Qgb3V0OiBudW1iZXJbXSA9IFtdO1xuICB3b3Jkcy5mb3JFYWNoKCh3LCBpKSA9PiB7XG4gICAgaWYgKGZyYW1lID49IHcuc3RhcnQgJiYgZnJhbWUgPCB3LmVuZCkgb3V0LnB1c2goaSk7XG4gIH0pO1xuICByZXR1cm4gb3V0O1xufTtcblxuLyoqIFNoYXBlIGluZGljZXMgbGl2ZSBhdCBhbiBhYnNvbHV0ZSBmcmFtZSAoc3RhcnQgXHUyMjY0IGYgPCBlbmQpLiAqL1xuZXhwb3J0IGNvbnN0IGFjdGl2ZVNoYXBlSW5kaWNlcyA9ICh0bDogVGltZWxpbmVWMywgZnJhbWU6IG51bWJlcik6IG51bWJlcltdID0+IHtcbiAgY29uc3Qgc2hhcGVzID0gc2hhcGVUcmFja09mKHRsKT8uc2hhcGVzID8/IFtdO1xuICBjb25zdCBvdXQ6IG51bWJlcltdID0gW107XG4gIHNoYXBlcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgaWYgKGZyYW1lID49IHMuc3RhcnQgJiYgZnJhbWUgPCBzLmVuZCkgb3V0LnB1c2goaSk7XG4gIH0pO1xuICByZXR1cm4gb3V0O1xufTtcblxuLyoqIEltYWdlIGNsaXAgaW5kaWNlcyBsaXZlIGF0IGFuIGFic29sdXRlIGZyYW1lLCBwZXIgaW1hZ2UgdHJhY2sgaWQuICovXG5leHBvcnQgY29uc3QgYWN0aXZlSW1hZ2VDbGlwcyA9IChcbiAgdGw6IFRpbWVsaW5lVjMsXG4gIGZyYW1lOiBudW1iZXJcbik6IHsgdHJhY2tJZDogc3RyaW5nOyBjbGlwSW5kZXg6IG51bWJlcjsgY2xpcDogSW1hZ2VDbGlwIH1bXSA9PiB7XG4gIGNvbnN0IG91dDogeyB0cmFja0lkOiBzdHJpbmc7IGNsaXBJbmRleDogbnVtYmVyOyBjbGlwOiBJbWFnZUNsaXAgfVtdID0gW107XG4gIGZvciAoY29uc3QgaXQgb2YgaW1hZ2VUcmFja3NPZih0bCkpIHtcbiAgICBpdC5jbGlwcy5mb3JFYWNoKChjbGlwLCBjbGlwSW5kZXgpID0+IHtcbiAgICAgIGlmIChmcmFtZSA+PSBjbGlwLnN0YXJ0ICYmIGZyYW1lIDwgY2xpcC5lbmQpIG91dC5wdXNoKHsgdHJhY2tJZDogaXQuaWQsIGNsaXBJbmRleCwgY2xpcCB9KTtcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gb3V0O1xufTtcblxuLyoqIEF1ZGlvIGNsaXBzIGFjcm9zcyBhdWRpbyB0cmFja3MgKGZsYXR0ZW5lZCwgd2l0aCB0cmFjayBpZCkuICovXG5leHBvcnQgY29uc3QgYWxsQXVkaW9DbGlwcyA9IChcbiAgdGw6IFRpbWVsaW5lVjNcbik6IHsgdHJhY2tJZDogc3RyaW5nOyBjbGlwSW5kZXg6IG51bWJlcjsgY2xpcDogQXVkaW9DbGlwIH1bXSA9PiB7XG4gIGNvbnN0IG91dDogeyB0cmFja0lkOiBzdHJpbmc7IGNsaXBJbmRleDogbnVtYmVyOyBjbGlwOiBBdWRpb0NsaXAgfVtdID0gW107XG4gIGNvbnN0IGF0ID0gYXVkaW9UcmFja09mKHRsKTtcbiAgaWYgKGF0KSBhdC5jbGlwcy5mb3JFYWNoKChjbGlwLCBjbGlwSW5kZXgpID0+IG91dC5wdXNoKHsgdHJhY2tJZDogYXQuaWQsIGNsaXBJbmRleCwgY2xpcCB9KSk7XG4gIHJldHVybiBvdXQ7XG59O1xuXG4vKiogU3RyaXAgdGhlIG1pZ3JhdGlvbi1vbmx5IGBfc2NlbmVgIHRhZyBmcm9tIHdvcmRzL3NoYXBlcyAoTk9UIHBhcnQgb2YgdGhlXG4gKiAgb24tZGlzayBDT05UUkFDVCkuIFJldHVybnMgYSBkZWVwIGNsb25lIHNhZmUgdG8gc2VyaWFsaXplL2F1dGhvci4gKi9cbmV4cG9ydCBjb25zdCBzdHJpcFNjZW5lVGFncyA9ICh0bDogVGltZWxpbmVWMyk6IFRpbWVsaW5lVjMgPT4ge1xuICBjb25zdCBuZXh0OiBUaW1lbGluZVYzID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0bCkpO1xuICBmb3IgKGNvbnN0IHRyIG9mIG5leHQudHJhY2tzKSB7XG4gICAgaWYgKHRyLmtpbmQgPT09IFwidGV4dFwiKSB0ci53b3Jkcy5mb3JFYWNoKCh3KSA9PiBkZWxldGUgKHcgYXMgeyBfc2NlbmU/OiBudW1iZXIgfSkuX3NjZW5lKTtcbiAgICBpZiAodHIua2luZCA9PT0gXCJzaGFwZVwiKSB0ci5zaGFwZXMuZm9yRWFjaCgocykgPT4gZGVsZXRlIChzIGFzIHsgX3NjZW5lPzogbnVtYmVyIH0pLl9zY2VuZSk7XG4gIH1cbiAgcmV0dXJuIG5leHQ7XG59O1xuIiwgIi8vIFRpbWVsaW5lSU8gXHUyMDE0IGVudi1hZ25vc3RpYyBpbXBvcnQvZXhwb3J0IGNvcmUsIHBvcnRlZCB2ZXJiYXRpbSAoc2VtYW50aWNzKSBmcm9tXG4vLyBjbGljay10b29sL2luZGV4Lmh0bWwgKENPUkU6VElNRUxJTkUtSU8pLiBTaW5nbGUgYmVoYXZpb3IsIG5vdyB0eXBlZC5cbi8vXG4vLyBJbnZhcmlhbnRzIChndWFyZGVkIGJ5IGNsaWNrLXRvb2wvcm91bmR0cmlwLnRlc3QuY2pzICsgZWRpdG9yIGlvLnRlc3QpOlxuLy8gICAtIENPTlRSQUNUIFx1MDBBNzQga2V5IG9yZGVyIG9uIGV2ZXJ5IG9iamVjdC5cbi8vICAgLSBgY2FzZWAgZW1pdHRlZCBPTkxZIHdoZW4gcHJlc2VudCAgXHUyMTkyIHJvdW5kLXRyaXAgb2YgYSBuby1gY2FzZWAgd29yZCBpc1xuLy8gICAgIGRlZXAtZXF1YWwgdG8gaXRzIGlucHV0LlxuLy8gICAtIGB0cmFuc2l0aW9uVG9OZXh0YCBlbWl0dGVkIE9OTFkgd2hlbiBwcmVzZW50ICh2Mi4wKSBcdTIxOTIgcm91bmQtdHJpcCBvZiBhbiBvbGRcbi8vICAgICB0aW1lbGluZSAobm8gdHJhbnNpdGlvbnMpIHN0YXlzIGRlZXAtZXF1YWwgdG8gaW5wdXQuXG4vLyAgIC0gc3RhcnQvZW5kIG5ldmVyIGRyaWZ0OyB1bnRvdWNoZWQgZmllbGRzIHBhc3MgdGhyb3VnaCB2ZXJiYXRpbS5cblxuaW1wb3J0IHR5cGUge1xuICBBdWRpb1RyYWNrLFxuICBCYWNrZ3JvdW5kLFxuICBFYXNpbmcsXG4gIEtleWZyYW1lLFxuICBLZXlmcmFtZVByb3BlcnR5LFxuICBPdmVybGF5LFxuICBQb3NpdGlvbktleWZyYW1lLFxuICBTY2VuZSxcbiAgU2NlbmVUcmFuc2l0aW9uLFxuICBTaGFwZSxcbiAgU2hhcGVLZXlmcmFtZVByb3BlcnR5LFxuICBTaGFwZUtleWZyYW1lcyxcbiAgVGltZWxpbmUsXG4gIFZlYzIsXG4gIFdvcmQsXG4gIFdvcmRLZXlmcmFtZXMsXG59IGZyb20gXCJAZW5naW5lL3R5cGVzXCI7XG5cbi8vIC0tLS0tIEtleWZyYW1lIHNlcmlhbGl6YXRpb24gKENPTlRSQUNUIFx1MDBBNzQpIC0tLS0tXG4vLyBEZWVwLCBrZXktb3JkZXItc3RhYmxlLCBQUkVTRU5ULU9OTFk6IG9wdGlvbmFsIGZpZWxkcyAoZWFzaW5nLCBzcGF0aWFsIHRhbmdlbnRzKVxuLy8gZW1pdCBvbmx5IHdoZW4gcHJlc2VudCwgZW1wdHkgdHJhY2tzIGFyZSBkcm9wcGVkLCBhbmQgYGtleWZyYW1lc2AgaXMgZW1pdHRlZFxuLy8gb25seSB3aGVuIFx1MjI2NTEgbm9uLWVtcHR5IHRyYWNrIHJlbWFpbnMgXHUyMDE0IHNvIGEga2V5ZnJhbWVsZXNzIHdvcmQgcm91bmQtdHJpcHMgd2l0aFxuLy8gTk8gYGtleWZyYW1lc2Aga2V5LCBhbmQgYW4gYXV0aG9yZWQgd29yZCByb3VuZC10cmlwcyBkZWVwLWVxdWFsLlxuXG5mdW5jdGlvbiBzZXJpYWxpemVFYXNpbmcoZTogRWFzaW5nIHwgdW5kZWZpbmVkKTogRWFzaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKGUgPT09IHVuZGVmaW5lZCB8fCBlID09PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkO1xuICBpZiAodHlwZW9mIGUgPT09IFwic3RyaW5nXCIpIHJldHVybiBlO1xuICBjb25zdCBiID0gZS5iZXppZXI7XG4gIHJldHVybiB7IGJlemllcjogW2JbMF0sIGJbMV0sIGJbMl0sIGJbM11dIH07XG59XG5cbmNvbnN0IHNlcmlhbGl6ZVZlYzIgPSAodjogVmVjMik6IFZlYzIgPT4gKHsgeDogdi54LCB5OiB2LnkgfSk7XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVNjYWxhcktmPFQ+KGs6IEtleWZyYW1lPFQ+KTogS2V5ZnJhbWU8VD4ge1xuICBjb25zdCBvID0geyBmcmFtZTogay5mcmFtZSwgdmFsdWU6IGsudmFsdWUgfSBhcyBLZXlmcmFtZTxUPjtcbiAgY29uc3QgZSA9IHNlcmlhbGl6ZUVhc2luZyhrLmVhc2luZyk7XG4gIGlmIChlICE9PSB1bmRlZmluZWQpIG8uZWFzaW5nID0gZTtcbiAgcmV0dXJuIG87XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVBvc2l0aW9uS2YoazogUG9zaXRpb25LZXlmcmFtZSk6IFBvc2l0aW9uS2V5ZnJhbWUge1xuICBjb25zdCBvOiBQb3NpdGlvbktleWZyYW1lID0geyBmcmFtZTogay5mcmFtZSwgdmFsdWU6IHNlcmlhbGl6ZVZlYzIoay52YWx1ZSkgfTtcbiAgY29uc3QgZSA9IHNlcmlhbGl6ZUVhc2luZyhrLmVhc2luZyk7XG4gIGlmIChlICE9PSB1bmRlZmluZWQpIG8uZWFzaW5nID0gZTtcbiAgaWYgKGsuc3BhdGlhbEluKSBvLnNwYXRpYWxJbiA9IHNlcmlhbGl6ZVZlYzIoay5zcGF0aWFsSW4pO1xuICBpZiAoay5zcGF0aWFsT3V0KSBvLnNwYXRpYWxPdXQgPSBzZXJpYWxpemVWZWMyKGsuc3BhdGlhbE91dCk7XG4gIHJldHVybiBvO1xufVxuXG4vLyBOb24tcG9zaXRpb24gdHJhY2tzIGluIENPTlRSQUNUIFx1MDBBNzQgb3JkZXIuIFNjYWxhci9jb2xvci9kaXNjcmV0ZSBzaGFyZSBhIHNoYXBlLlxuY29uc3QgRkxBVF9UUkFDS1M6IEtleWZyYW1lUHJvcGVydHlbXSA9IFtcbiAgXCJzaXplXCIsXG4gIFwid2VpZ2h0XCIsXG4gIFwiZm9udEZhbWlseVwiLFxuICBcImxldHRlclNwYWNpbmdcIixcbiAgXCJjb2xvclwiLFxuICBcIm9wYWNpdHlcIixcbiAgXCJyb3RhdGlvblwiLFxuICBcImJsdXJcIixcbiAgXCJjbGlwUmV2ZWFsXCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplS2V5ZnJhbWVzKGtmOiBXb3JkS2V5ZnJhbWVzKTogV29yZEtleWZyYW1lcyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IG86IFdvcmRLZXlmcmFtZXMgPSB7fTtcbiAgLy8gcG9zaXRpb24gZmlyc3QgKHdpdGggc3BhdGlhbCB0YW5nZW50cykuXG4gIGlmIChBcnJheS5pc0FycmF5KGtmLnBvc2l0aW9uKSAmJiBrZi5wb3NpdGlvbi5sZW5ndGggPiAwKSB7XG4gICAgby5wb3NpdGlvbiA9IGtmLnBvc2l0aW9uLm1hcChzZXJpYWxpemVQb3NpdGlvbktmKTtcbiAgfVxuICBmb3IgKGNvbnN0IGtleSBvZiBGTEFUX1RSQUNLUykge1xuICAgIGNvbnN0IHRyYWNrID0ga2Zba2V5XSBhcyBLZXlmcmFtZTx1bmtub3duPltdIHwgdW5kZWZpbmVkO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRyYWNrKSAmJiB0cmFjay5sZW5ndGggPiAwKSB7XG4gICAgICAob1trZXldIGFzIHVua25vd24pID0gdHJhY2subWFwKHNlcmlhbGl6ZVNjYWxhcktmKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5rZXlzKG8pLmxlbmd0aCA+IDAgPyBvIDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplV29yZCh3OiBXb3JkKTogV29yZCB7XG4gIGNvbnN0IG8gPSB7fSBhcyBXb3JkO1xuICBvLnRleHQgPSB3LnRleHQ7XG4gIG8uc3RhcnQgPSB3LnN0YXJ0O1xuICBvLmVuZCA9IHcuZW5kO1xuICBvLnggPSB3Lng7XG4gIG8ueSA9IHcueTtcbiAgby5mb250ID0gdy5mb250O1xuICBvLnNpemUgPSB3LnNpemU7XG4gIG8ud2VpZ2h0ID0gdy53ZWlnaHQ7XG4gIG8uY29sb3IgPSB3LmNvbG9yO1xuICBvLmVudGVyRnJvbSA9IHcuZW50ZXJGcm9tO1xuICBpZiAody5jYXNlICE9PSB1bmRlZmluZWQgJiYgdy5jYXNlICE9PSBudWxsKSBvLmNhc2UgPSB3LmNhc2U7XG4gIC8vIHN0cm9rZS9zaGFkb3cgKENPTlRSQUNUIFx1MDBBNzQpIFx1MjAxNCBwcmVzZW50LW9ubHkgc28gYSBuby1hY2NlbnQgd29yZCByb3VuZC10cmlwc1xuICAvLyBkZWVwLWVxdWFsIChwaXhlbC1nYXRlIHNhZmUpLiBTYW1lIGtleS13aGl0ZWxpc3QgcGF0dGVybiBhcyBvdmVybGF5cy5cbiAgaWYgKHcuc3Ryb2tlICE9PSB1bmRlZmluZWQgJiYgdy5zdHJva2UgIT09IG51bGwpIHtcbiAgICBvLnN0cm9rZSA9IHsgY29sb3I6IHcuc3Ryb2tlLmNvbG9yLCB3aWR0aDogdy5zdHJva2Uud2lkdGggfTtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheSh3LnNoYWRvdykpIHtcbiAgICBvLnNoYWRvdyA9IHcuc2hhZG93Lm1hcCgoc2gpID0+IHtcbiAgICAgIGNvbnN0IHNvID0ge30gYXMgTm9uTnVsbGFibGU8V29yZFtcInNoYWRvd1wiXT5bbnVtYmVyXTtcbiAgICAgIGlmIChzaC54ICE9PSB1bmRlZmluZWQgJiYgc2gueCAhPT0gbnVsbCkgc28ueCA9IHNoLng7XG4gICAgICBpZiAoc2gueSAhPT0gdW5kZWZpbmVkICYmIHNoLnkgIT09IG51bGwpIHNvLnkgPSBzaC55O1xuICAgICAgc28uYmx1ciA9IHNoLmJsdXI7XG4gICAgICBzby5jb2xvciA9IHNoLmNvbG9yO1xuICAgICAgcmV0dXJuIHNvO1xuICAgIH0pO1xuICB9XG4gIGlmICh3LmtleWZyYW1lcykge1xuICAgIGNvbnN0IGtmID0gc2VyaWFsaXplS2V5ZnJhbWVzKHcua2V5ZnJhbWVzKTtcbiAgICBpZiAoa2YpIG8ua2V5ZnJhbWVzID0ga2Y7XG4gIH1cbiAgcmV0dXJuIG87XG59XG5cbi8vIC0tLS0tIEJhY2tncm91bmQgKENPTlRSQUNUIFx1MDBBNzQgZGlzY3JpbWluYXRlZCB1bmlvbikgLS0tLS1cbi8vIGB0eXBlYCBmaXJzdDsgcGVyLXZhcmlhbnQgZmllbGRzIGluIENPTlRSQUNUIG9yZGVyOyBvcHRpb25hbCBmaWVsZHMgcHJlc2VudC1vbmx5XG4vLyBzbyBhIG1pbmltYWwgYmFja2dyb3VuZCByb3VuZC10cmlwcyBkZWVwLWVxdWFsLlxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUJhY2tncm91bmQoYjogQmFja2dyb3VuZCk6IEJhY2tncm91bmQge1xuICBzd2l0Y2ggKGIudHlwZSkge1xuICAgIGNhc2UgXCJjb2xvclwiOlxuICAgICAgcmV0dXJuIHsgdHlwZTogXCJjb2xvclwiLCBjb2xvcjogYi5jb2xvciB9O1xuICAgIGNhc2UgXCJpbWFnZVwiOiB7XG4gICAgICBjb25zdCBvOiBCYWNrZ3JvdW5kID0geyB0eXBlOiBcImltYWdlXCIsIHNyYzogYi5zcmMgPz8gXCJwbGFjZWhvbGRlclwiIH07XG4gICAgICBpZiAoYi5maXQgIT09IHVuZGVmaW5lZCAmJiBiLmZpdCAhPT0gbnVsbCkgby5maXQgPSBiLmZpdDtcbiAgICAgIHJldHVybiBvO1xuICAgIH1cbiAgICBjYXNlIFwiY292ZXJcIjoge1xuICAgICAgY29uc3QgbzogQmFja2dyb3VuZCA9IHsgdHlwZTogXCJjb3ZlclwiLCBzcmM6IGIuc3JjID8/IFwicGxhY2Vob2xkZXJcIiB9O1xuICAgICAgaWYgKGIuc3RhcnRGcm9tICE9PSB1bmRlZmluZWQgJiYgYi5zdGFydEZyb20gIT09IG51bGwpIG8uc3RhcnRGcm9tID0gYi5zdGFydEZyb207XG4gICAgICBpZiAoYi52b2x1bWUgIT09IHVuZGVmaW5lZCAmJiBiLnZvbHVtZSAhPT0gbnVsbCkgby52b2x1bWUgPSBiLnZvbHVtZTtcbiAgICAgIGlmIChiLm11dGVkICE9PSB1bmRlZmluZWQgJiYgYi5tdXRlZCAhPT0gbnVsbCkgby5tdXRlZCA9IGIubXV0ZWQ7XG4gICAgICAvLyBzcGVlY2hSZWdpb25zIEZST1pFTiAoQVNSKSBcdTIwMTQgcGFzcyB0aHJvdWdoIHZlcmJhdGltLCBuZXZlciBlZGl0ZWQuXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShiLnNwZWVjaFJlZ2lvbnMpKSB7XG4gICAgICAgIG8uc3BlZWNoUmVnaW9ucyA9IGIuc3BlZWNoUmVnaW9ucy5tYXAoKHIpID0+ICh7XG4gICAgICAgICAgc3RhcnRGcmFtZTogci5zdGFydEZyYW1lLFxuICAgICAgICAgIGVuZEZyYW1lOiByLmVuZEZyYW1lLFxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbztcbiAgICB9XG4gICAgY2FzZSBcImJveFwiOiB7XG4gICAgICBjb25zdCBvOiBCYWNrZ3JvdW5kID0ge1xuICAgICAgICB0eXBlOiBcImJveFwiLFxuICAgICAgICBzcmM6IGIuc3JjID8/IFwicGxhY2Vob2xkZXJcIixcbiAgICAgICAgeDogYi54LFxuICAgICAgICB5OiBiLnksXG4gICAgICAgIHdpZHRoOiBiLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IGIuaGVpZ2h0LFxuICAgICAgICBib3JkZXJSYWRpdXM6IGIuYm9yZGVyUmFkaXVzID8/IDAsXG4gICAgICAgIGJhY2tDb2xvcjogYi5iYWNrQ29sb3IsXG4gICAgICB9O1xuICAgICAgaWYgKGIuZml0ICE9PSB1bmRlZmluZWQgJiYgYi5maXQgIT09IG51bGwpIG8uZml0ID0gYi5maXQ7XG4gICAgICBpZiAoYi5zdGFydEZyb20gIT09IHVuZGVmaW5lZCAmJiBiLnN0YXJ0RnJvbSAhPT0gbnVsbCkgby5zdGFydEZyb20gPSBiLnN0YXJ0RnJvbTtcbiAgICAgIGlmIChiLnZvbHVtZSAhPT0gdW5kZWZpbmVkICYmIGIudm9sdW1lICE9PSBudWxsKSBvLnZvbHVtZSA9IGIudm9sdW1lO1xuICAgICAgaWYgKGIubXV0ZWQgIT09IHVuZGVmaW5lZCAmJiBiLm11dGVkICE9PSBudWxsKSBvLm11dGVkID0gYi5tdXRlZDtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGIuc3BlZWNoUmVnaW9ucykpIHtcbiAgICAgICAgby5zcGVlY2hSZWdpb25zID0gYi5zcGVlY2hSZWdpb25zLm1hcCgocikgPT4gKHtcbiAgICAgICAgICBzdGFydEZyYW1lOiByLnN0YXJ0RnJhbWUsXG4gICAgICAgICAgZW5kRnJhbWU6IHIuZW5kRnJhbWUsXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvO1xuICAgIH1cbiAgICBkZWZhdWx0OlxuICAgICAgLy8gRGVmZW5zaXZlOiBhbiB1bmtub3duL2Fic2VudCBiYWNrZ3JvdW5kIFx1MjE5MiBibGFjayBjb2xvciBmaWxsLlxuICAgICAgcmV0dXJuIHsgdHlwZTogXCJjb2xvclwiLCBjb2xvcjogXCIjMDAwMDAwXCIgfTtcbiAgfVxufVxuXG4vLyAtLS0tLSBTaGFwZSAoQ09OVFJBQ1QgXHUwMEE3NCBcdTIwMTQgcmV1c2VzIHRoZSBTQU1FIGtleWZyYW1lIHNlcmlhbGl6YXRpb24gYXMgd29yZHMpIC0tLS0tXG5jb25zdCBTSEFQRV9GTEFUX1RSQUNLUzogU2hhcGVLZXlmcmFtZVByb3BlcnR5W10gPSBbXG4gIFwid2lkdGhcIixcbiAgXCJoZWlnaHRcIixcbiAgXCJjb2xvclwiLFxuICBcIm9wYWNpdHlcIixcbiAgXCJyb3RhdGlvblwiLFxuICBcImJvcmRlclJhZGl1c1wiLFxuICBcImJsdXJcIixcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVTaGFwZUtleWZyYW1lcyhrZjogU2hhcGVLZXlmcmFtZXMpOiBTaGFwZUtleWZyYW1lcyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IG86IFNoYXBlS2V5ZnJhbWVzID0ge307XG4gIGlmIChBcnJheS5pc0FycmF5KGtmLnBvc2l0aW9uKSAmJiBrZi5wb3NpdGlvbi5sZW5ndGggPiAwKSB7XG4gICAgby5wb3NpdGlvbiA9IGtmLnBvc2l0aW9uLm1hcChzZXJpYWxpemVQb3NpdGlvbktmKTtcbiAgfVxuICBmb3IgKGNvbnN0IGtleSBvZiBTSEFQRV9GTEFUX1RSQUNLUykge1xuICAgIGNvbnN0IHRyYWNrID0ga2Zba2V5XSBhcyBLZXlmcmFtZTx1bmtub3duPltdIHwgdW5kZWZpbmVkO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHRyYWNrKSAmJiB0cmFjay5sZW5ndGggPiAwKSB7XG4gICAgICAob1trZXldIGFzIHVua25vd24pID0gdHJhY2subWFwKHNlcmlhbGl6ZVNjYWxhcktmKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5rZXlzKG8pLmxlbmd0aCA+IDAgPyBvIDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2hhcGUoczogU2hhcGUpOiBTaGFwZSB7XG4gIGNvbnN0IG8gPSB7fSBhcyBTaGFwZTtcbiAgby5pZCA9IHMuaWQ7XG4gIG8uc2hhcGUgPSBzLnNoYXBlO1xuICBvLnN0YXJ0ID0gcy5zdGFydDtcbiAgby5lbmQgPSBzLmVuZDtcbiAgby54ID0gcy54O1xuICBvLnkgPSBzLnk7XG4gIG8ud2lkdGggPSBzLndpZHRoO1xuICBvLmhlaWdodCA9IHMuaGVpZ2h0O1xuICBvLmNvbG9yID0gcy5jb2xvcjtcbiAgaWYgKHMuYm9yZGVyUmFkaXVzICE9PSB1bmRlZmluZWQgJiYgcy5ib3JkZXJSYWRpdXMgIT09IG51bGwpIG8uYm9yZGVyUmFkaXVzID0gcy5ib3JkZXJSYWRpdXM7XG4gIGlmIChzLnN0cm9rZSAhPT0gdW5kZWZpbmVkICYmIHMuc3Ryb2tlICE9PSBudWxsKSB7XG4gICAgby5zdHJva2UgPSB7IGNvbG9yOiBzLnN0cm9rZS5jb2xvciwgd2lkdGg6IHMuc3Ryb2tlLndpZHRoIH07XG4gIH1cbiAgaWYgKHMub3BhY2l0eSAhPT0gdW5kZWZpbmVkICYmIHMub3BhY2l0eSAhPT0gbnVsbCkgby5vcGFjaXR5ID0gcy5vcGFjaXR5O1xuICBpZiAocy5yb3RhdGlvbiAhPT0gdW5kZWZpbmVkICYmIHMucm90YXRpb24gIT09IG51bGwpIG8ucm90YXRpb24gPSBzLnJvdGF0aW9uO1xuICBpZiAocy5rZXlmcmFtZXMpIHtcbiAgICBjb25zdCBrZiA9IHNlcmlhbGl6ZVNoYXBlS2V5ZnJhbWVzKHMua2V5ZnJhbWVzKTtcbiAgICBpZiAoa2YpIG8ua2V5ZnJhbWVzID0ga2Y7XG4gIH1cbiAgcmV0dXJuIG87XG59XG5cbi8vIE92ZXJsYXkgKENPTlRSQUNUIFx1MDBBNzQgXHUyMDE0IGEgZm9yZWdyb3VuZCBJbWFnZUNsaXAtc2hhcGVkIGltYWdlLCBhdXRob3JlZCBvbiBhIHYyXG4vLyBzY2VuZTsgbWlncmF0aW9uIGxhbmRzIGl0IG9uIGl0cyBvd24gaW1hZ2UgdHJhY2spLiBLZXlzIGluIHR5cGUgb3JkZXI7IG9wdGlvbmFsXG4vLyBmaWVsZHMgcHJlc2VudC1vbmx5IHNvIGEgbWluaW1hbCBvdmVybGF5IHJvdW5kLXRyaXBzIGRlZXAtZXF1YWwuIFJldXNlcyB0aGUgU0FNRVxuLy8ga2V5ZnJhbWUgc2VyaWFsaXphdGlvbiBhcyBzaGFwZXMgKGl0IGFuaW1hdGVzIGxpa2UgYW4gSW1hZ2VDbGlwKS5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVPdmVybGF5KG92OiBPdmVybGF5KTogT3ZlcmxheSB7XG4gIGNvbnN0IG8gPSB7fSBhcyBPdmVybGF5O1xuICBvLnNyYyA9IG92LnNyYztcbiAgby5zdGFydCA9IG92LnN0YXJ0O1xuICBvLmVuZCA9IG92LmVuZDtcbiAgby54ID0gb3YueDtcbiAgby55ID0gb3YueTtcbiAgby53aWR0aCA9IG92LndpZHRoO1xuICBvLmhlaWdodCA9IG92LmhlaWdodDtcbiAgaWYgKG92LmZpdCAhPT0gdW5kZWZpbmVkICYmIG92LmZpdCAhPT0gbnVsbCkgby5maXQgPSBvdi5maXQ7XG4gIGlmIChvdi5ib3JkZXJSYWRpdXMgIT09IHVuZGVmaW5lZCAmJiBvdi5ib3JkZXJSYWRpdXMgIT09IG51bGwpIG8uYm9yZGVyUmFkaXVzID0gb3YuYm9yZGVyUmFkaXVzO1xuICBpZiAob3Yub3BhY2l0eSAhPT0gdW5kZWZpbmVkICYmIG92Lm9wYWNpdHkgIT09IG51bGwpIG8ub3BhY2l0eSA9IG92Lm9wYWNpdHk7XG4gIGlmIChvdi5yb3RhdGlvbiAhPT0gdW5kZWZpbmVkICYmIG92LnJvdGF0aW9uICE9PSBudWxsKSBvLnJvdGF0aW9uID0gb3Yucm90YXRpb247XG4gIGlmIChvdi5rZXlmcmFtZXMpIHtcbiAgICBjb25zdCBrZiA9IHNlcmlhbGl6ZVNoYXBlS2V5ZnJhbWVzKG92LmtleWZyYW1lcyk7XG4gICAgaWYgKGtmKSBvLmtleWZyYW1lcyA9IGtmO1xuICB9XG4gIHJldHVybiBvO1xufVxuXG4vLyBBdWRpb1RyYWNrIHdpdGggQ09OVFJBQ1Qga2V5IG9yZGVyOyBvcHRpb25hbCBmaWVsZHMgb25seSB3aGVuIHByZXNlbnQuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQXVkaW8oYTogVGltZWxpbmVbXCJhdWRpb1wiXSk6IFRpbWVsaW5lW1wiYXVkaW9cIl0ge1xuICBpZiAoYSA9PSBudWxsKSByZXR1cm4gbnVsbDtcbiAgLy8gTGVnYWN5IGJhcmUgc3RyaW5nIHBhdGggc3RheXMgYSBzdHJpbmcgKHJvdW5kLXRyaXBzIHVuY2hhbmdlZCkuXG4gIGlmICh0eXBlb2YgYSA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIGEgYXMgdW5rbm93biBhcyBBdWRpb1RyYWNrO1xuICBjb25zdCBvOiBBdWRpb1RyYWNrID0geyBzcmM6IGEuc3JjLCB2b2x1bWU6IGEudm9sdW1lIH07XG4gIGlmIChhLmZhZGVJbkZyYW1lcyAhPT0gdW5kZWZpbmVkICYmIGEuZmFkZUluRnJhbWVzICE9PSBudWxsKSBvLmZhZGVJbkZyYW1lcyA9IGEuZmFkZUluRnJhbWVzO1xuICBpZiAoYS5mYWRlT3V0RnJhbWVzICE9PSB1bmRlZmluZWQgJiYgYS5mYWRlT3V0RnJhbWVzICE9PSBudWxsKSBvLmZhZGVPdXRGcmFtZXMgPSBhLmZhZGVPdXRGcmFtZXM7XG4gIGlmIChhLmR1Y2tpbmcgIT09IHVuZGVmaW5lZCAmJiBhLmR1Y2tpbmcgIT09IG51bGwpIHtcbiAgICBvLmR1Y2tpbmcgPSB7XG4gICAgICBlbmFibGVkOiBhLmR1Y2tpbmcuZW5hYmxlZCxcbiAgICAgIGR1Y2tlZFZvbHVtZTogYS5kdWNraW5nLmR1Y2tlZFZvbHVtZSxcbiAgICAgIGF0dGFja0ZyYW1lczogYS5kdWNraW5nLmF0dGFja0ZyYW1lcyxcbiAgICAgIHJlbGVhc2VGcmFtZXM6IGEuZHVja2luZy5yZWxlYXNlRnJhbWVzLFxuICAgIH07XG4gIH1cbiAgcmV0dXJuIG87XG59XG5cbi8vIENPTlRSQUNUIFx1MDBBNzQuMSBrZXkgb3JkZXI7IG9wdGlvbmFsIGZpZWxkcyBvbmx5IHdoZW4gcHJlc2VudC5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVUcmFuc2l0aW9uKHQ6IFNjZW5lVHJhbnNpdGlvbik6IFNjZW5lVHJhbnNpdGlvbiB7XG4gIGNvbnN0IG8gPSB7fSBhcyBTY2VuZVRyYW5zaXRpb247XG4gIG8udHlwZSA9IHQudHlwZTtcbiAgby5kdXJhdGlvbkluRnJhbWVzID0gdC5kdXJhdGlvbkluRnJhbWVzO1xuICBpZiAodC5kaXJlY3Rpb24gIT09IHVuZGVmaW5lZCAmJiB0LmRpcmVjdGlvbiAhPT0gbnVsbCkgby5kaXJlY3Rpb24gPSB0LmRpcmVjdGlvbjtcbiAgaWYgKHQudGltaW5nICE9PSB1bmRlZmluZWQgJiYgdC50aW1pbmcgIT09IG51bGwpIG8udGltaW5nID0gdC50aW1pbmc7XG4gIHJldHVybiBvO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplU2NlbmUoczogU2NlbmUpOiBTY2VuZSB7XG4gIC8vIENPTlRSQUNUIGtleSBvcmRlcjogaWQsIGR1cmF0aW9uSW5GcmFtZXMsIGJhY2tncm91bmQsIHNoYXBlcz8sIHdvcmRzLCBvdmVybGF5cz8sIHRyYW5zaXRpb25Ub05leHQ/XG4gIGNvbnN0IG8gPSB7fSBhcyBTY2VuZTtcbiAgby5pZCA9IHMuaWQ7XG4gIG8uZHVyYXRpb25JbkZyYW1lcyA9IHMuZHVyYXRpb25JbkZyYW1lcztcbiAgLy8gRGVmYXVsdCB0byBhIGJsYWNrIGNvbG9yIGZpbGwgaWYgYSBzY2VuZSBzb21laG93IGxhY2tzIGEgYmFja2dyb3VuZFxuICAvLyAodW4tbWlncmF0ZWQgaW5wdXQpIFx1MjAxNCBzZXJpYWxpemUgbmV2ZXIgZW1pdHMgdGhlIGxlZ2FjeSBgdmlkZW9gIGZpZWxkLlxuICBvLmJhY2tncm91bmQgPSBzZXJpYWxpemVCYWNrZ3JvdW5kKHMuYmFja2dyb3VuZCA/PyB7IHR5cGU6IFwiY29sb3JcIiwgY29sb3I6IFwiIzAwMDAwMFwiIH0pO1xuICAvLyBzaGFwZXMgZW1pdHRlZCBPTkxZIHdoZW4gcHJlc2VudCAoZGVmYXVsdCBbXSBzdGF5cyBhYnNlbnQpIHNvIGEgc2hhcGVsZXNzXG4gIC8vIHNjZW5lIHJvdW5kLXRyaXBzIGRlZXAtZXF1YWwuXG4gIGlmIChBcnJheS5pc0FycmF5KHMuc2hhcGVzKSAmJiBzLnNoYXBlcy5sZW5ndGggPiAwKSB7XG4gICAgby5zaGFwZXMgPSBzLnNoYXBlcy5tYXAoc2VyaWFsaXplU2hhcGUpO1xuICB9XG4gIG8ud29yZHMgPSAocy53b3JkcyB8fCBbXSkubWFwKHNlcmlhbGl6ZVdvcmQpO1xuICAvLyBvdmVybGF5cyBlbWl0dGVkIE9OTFkgd2hlbiBwcmVzZW50IChkZWZhdWx0IFtdIHN0YXlzIGFic2VudCkgc28gYW4gb3ZlcmxheS1sZXNzXG4gIC8vIHNjZW5lIHJvdW5kLXRyaXBzIGRlZXAtZXF1YWwgKHBpeGVsLWdhdGUgc2FmZSkuXG4gIGlmIChBcnJheS5pc0FycmF5KHMub3ZlcmxheXMpICYmIHMub3ZlcmxheXMubGVuZ3RoID4gMCkge1xuICAgIG8ub3ZlcmxheXMgPSBzLm92ZXJsYXlzLm1hcChzZXJpYWxpemVPdmVybGF5KTtcbiAgfVxuICBpZiAocy50cmFuc2l0aW9uVG9OZXh0ICE9PSB1bmRlZmluZWQgJiYgcy50cmFuc2l0aW9uVG9OZXh0ICE9PSBudWxsKSB7XG4gICAgby50cmFuc2l0aW9uVG9OZXh0ID0gc2VyaWFsaXplVHJhbnNpdGlvbihzLnRyYW5zaXRpb25Ub05leHQpO1xuICB9XG4gIHJldHVybiBvO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplVGltZWxpbmUodDogVGltZWxpbmUpOiBUaW1lbGluZSB7XG4gIHJldHVybiB7XG4gICAgZnBzOiB0LmZwcyxcbiAgICB3aWR0aDogdC53aWR0aCxcbiAgICBoZWlnaHQ6IHQuaGVpZ2h0LFxuICAgIGF1ZGlvOiBzZXJpYWxpemVBdWRpbyh0LmF1ZGlvKSxcbiAgICBzY2VuZXM6ICh0LnNjZW5lcyB8fCBbXSkubWFwKHNlcmlhbGl6ZVNjZW5lKSxcbiAgfTtcbn1cblxuLy8gTWluaW1hbCBzdHJ1Y3R1cmFsIHZhbGlkYXRpb24gb24gaW1wb3J0LiBSZXR1cm5zIGFycmF5IG9mIGVycm9yIHN0cmluZ3Ncbi8vIChlbXB0eSA9IHZhbGlkKS4gV2UgbmV2ZXIgY29lcmNlIG9yIHJld3JpdGUgYW55dGhpbmcuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUaW1lbGluZSh0OiB1bmtub3duKTogc3RyaW5nW10ge1xuICBjb25zdCBlcnJzOiBzdHJpbmdbXSA9IFtdO1xuICBpZiAoIXQgfHwgdHlwZW9mIHQgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh0KSkge1xuICAgIGVycnMucHVzaChcInJvb3QgaXMgbm90IGEgVGltZWxpbmUgb2JqZWN0XCIpO1xuICAgIHJldHVybiBlcnJzO1xuICB9XG4gIGNvbnN0IG8gPSB0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBmb3IgKGNvbnN0IGsgb2YgW1wiZnBzXCIsIFwid2lkdGhcIiwgXCJoZWlnaHRcIl0pIHtcbiAgICBpZiAodHlwZW9mIG9ba10gIT09IFwibnVtYmVyXCIpIGVycnMucHVzaChrICsgXCIgbXVzdCBiZSBhIG51bWJlclwiKTtcbiAgfVxuICAvLyBiYWNrZ3JvdW5kIGlzIExFTklFTlQgKHYyLjIpOiB0aGUgbmV3IG1vZGVsIGhhcyBOTyB0b3AtbGV2ZWwgYmFja2dyb3VuZCAoZWFjaFxuICAvLyBzY2VuZSBjYXJyaWVzIGl0cyBvd24pLiBBIGxlZ2FjeSB0b3AtbGV2ZWwgYGJhY2tncm91bmRgIChoZXggc3RyaW5nKSBpcyBzdGlsbFxuICAvLyBhY2NlcHRlZCBcdTIwMTQgbWlncmF0aW9uIGNvbnZlcnRzIGl0IG9uIGltcG9ydC4gSWYgcHJlc2VudCwgaXQgbXVzdCBiZSBhIHN0cmluZy5cbiAgaWYgKFwiYmFja2dyb3VuZFwiIGluIG8gJiYgdHlwZW9mIG8uYmFja2dyb3VuZCAhPT0gXCJzdHJpbmdcIikge1xuICAgIGVycnMucHVzaChcImJhY2tncm91bmQsIGlmIHByZXNlbnQgKGxlZ2FjeSksIG11c3QgYmUgYSBzdHJpbmdcIik7XG4gIH1cbiAgaWYgKCEoXCJhdWRpb1wiIGluIG8pKSBlcnJzLnB1c2goXCJhdWRpbyBmaWVsZCBtaXNzaW5nICh1c2UgbnVsbClcIik7XG4gIGlmICghQXJyYXkuaXNBcnJheShvLnNjZW5lcykpIHtcbiAgICBlcnJzLnB1c2goXCJzY2VuZXMgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICByZXR1cm4gZXJycztcbiAgfVxuICAoby5zY2VuZXMgYXMgdW5rbm93bltdKS5mb3JFYWNoKChzVW5rbm93biwgaSkgPT4ge1xuICAgIGNvbnN0IHMgPSBzVW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcbiAgICBpZiAodHlwZW9mIHMuaWQgIT09IFwic3RyaW5nXCIpIGVycnMucHVzaChgc2NlbmVzWyR7aX1dLmlkIG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICBpZiAodHlwZW9mIHMuZHVyYXRpb25JbkZyYW1lcyAhPT0gXCJudW1iZXJcIilcbiAgICAgIGVycnMucHVzaChgc2NlbmVzWyR7aX1dLmR1cmF0aW9uSW5GcmFtZXMgbXVzdCBiZSBhIG51bWJlcmApO1xuICAgIGlmICghQXJyYXkuaXNBcnJheShzLndvcmRzKSkgZXJycy5wdXNoKGBzY2VuZXNbJHtpfV0ud29yZHMgbXVzdCBiZSBhbiBhcnJheWApO1xuICAgICgocy53b3JkcyBhcyB1bmtub3duW10pIHx8IFtdKS5mb3JFYWNoKCh3VW5rbm93biwgaikgPT4ge1xuICAgICAgY29uc3QgdyA9IHdVbmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgICAgZm9yIChjb25zdCBrIG9mIFtcInN0YXJ0XCIsIFwiZW5kXCIsIFwieFwiLCBcInlcIiwgXCJzaXplXCIsIFwid2VpZ2h0XCJdKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd1trXSAhPT0gXCJudW1iZXJcIilcbiAgICAgICAgICBlcnJzLnB1c2goYHNjZW5lc1ske2l9XS53b3Jkc1ske2p9XS4ke2t9IG11c3QgYmUgYSBudW1iZXJgKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygdy50ZXh0ICE9PSBcInN0cmluZ1wiKVxuICAgICAgICBlcnJzLnB1c2goYHNjZW5lc1ske2l9XS53b3Jkc1ske2p9XS50ZXh0IG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICB9KTtcbiAgfSk7XG4gIHJldHVybiBlcnJzO1xufVxuXG4vLyBEZWVwIGNsb25lIHZpYSBKU09OIFx1MjAxNCB0aW1lbGluZXMgYXJlIHB1cmUgSlNPTiwgc28gdGhpcyBpcyBleGFjdCBhbmQgZGVjb3VwbGVzXG4vLyB0aGUgaW4tbWVtb3J5IG1hc3RlciBmcm9tIHRoZSBwYXJzZWQgaW5wdXQgb2JqZWN0LlxuZXhwb3J0IGZ1bmN0aW9uIGNsb25lVGltZWxpbmUodDogVGltZWxpbmUpOiBUaW1lbGluZSB7XG4gIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHQpKTtcbn1cblxuLy8gV3JhcCBhIFRpbWVsaW5lIGFzIHJlbmRlci1yZWFkeSBwcm9wcyBmb3IgYG5weCByZW1vdGlvbiByZW5kZXIgUmVlbHMgLS1wcm9wc2AuXG5leHBvcnQgZnVuY3Rpb24gdG9SZW5kZXJQcm9wcyh0OiBUaW1lbGluZSk6IHsgc2hvd0dyaWQ6IGJvb2xlYW47IHRpbWVsaW5lOiBUaW1lbGluZSB9IHtcbiAgcmV0dXJuIHsgc2hvd0dyaWQ6IGZhbHNlLCB0aW1lbGluZTogc2VyaWFsaXplVGltZWxpbmUodCkgfTtcbn1cblxuLy8gPT09PT0gdjMgKHRyYWNrcykgaW1wb3J0L2V4cG9ydCA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBUaGUgZWRpdG9yIGF1dGhvcnMgdjMuIE9uIGltcG9ydCB3ZSBhY2NlcHQgYSBsZWdhY3kgdjIgKHNjZW5lcykgZmlsZSBcdTIwMTQgbWlncmF0ZWRcbi8vIHRvIHYzIFx1MjAxNCBPUiBhIHYzICh0cmFja3MpIGZpbGUgZGlyZWN0bHkuIE9uIGV4cG9ydCB3ZSBlbWl0IHRoZSB2MyB0cmFjayBzY2hlbWEgd2l0aFxuLy8gdGhlIG1pZ3JhdGlvbi1vbmx5IGBfc2NlbmVgIHRhZ3Mgc3RyaXBwZWQgKHRoZXkgYXJlIE5PVCBwYXJ0IG9mIHRoZSBDT05UUkFDVCkuXG5cbmltcG9ydCB0eXBlIHsgVGltZWxpbmVWMyB9IGZyb20gXCJAZW5naW5lL3R5cGVzLnYzXCI7XG5pbXBvcnQgeyBpc1YzIH0gZnJvbSBcIkBlbmdpbmUvdHlwZXMudjNcIjtcbmltcG9ydCB7IG1pZ3JhdGVWMnRvVjMgfSBmcm9tIFwiQGVuZ2luZS9taWdyYXRlVjNcIjtcbmltcG9ydCB7IHN0cmlwU2NlbmVUYWdzIH0gZnJvbSBcIi4vdjN1dGlsXCI7XG5cbi8qKiBMaWdodCBzdHJ1Y3R1cmFsIHZhbGlkYXRpb24gZm9yIGEgdjMgdGltZWxpbmUuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVUaW1lbGluZVYzKHQ6IHVua25vd24pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGVycnM6IHN0cmluZ1tdID0gW107XG4gIGlmICghdCB8fCB0eXBlb2YgdCAhPT0gXCJvYmplY3RcIiB8fCBBcnJheS5pc0FycmF5KHQpKSByZXR1cm4gW1wicm9vdCBpcyBub3QgYSBUaW1lbGluZSBvYmplY3RcIl07XG4gIGNvbnN0IG8gPSB0IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICBmb3IgKGNvbnN0IGsgb2YgW1wiZnBzXCIsIFwid2lkdGhcIiwgXCJoZWlnaHRcIl0pIGlmICh0eXBlb2Ygb1trXSAhPT0gXCJudW1iZXJcIikgZXJycy5wdXNoKGAke2t9IG11c3QgYmUgYSBudW1iZXJgKTtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG8udHJhY2tzKSkgZXJycy5wdXNoKFwidHJhY2tzIG11c3QgYmUgYW4gYXJyYXlcIik7XG4gIHJldHVybiBlcnJzO1xufVxuXG4vKiogUGFyc2UgXHUyMTkyIHYzLiBNaWdyYXRlcyBhIGxlZ2FjeSB2MiAoc2NlbmVzKSBmaWxlOyBwYXNzZXMgYSB2MyAodHJhY2tzKSBmaWxlXG4gKiAgdGhyb3VnaC4gUmV0dXJucyB7IGVycnMgfSBvbiBmYWlsdXJlLCBlbHNlIHsgdGltZWxpbmUgfS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbXBvcnRUb1YzKHBhcnNlZDogdW5rbm93bik6IHsgZXJyczogc3RyaW5nW107IHRpbWVsaW5lPzogVGltZWxpbmVWMyB9IHtcbiAgaWYgKGlzVjMocGFyc2VkKSkge1xuICAgIGNvbnN0IGVycnMgPSB2YWxpZGF0ZVRpbWVsaW5lVjMocGFyc2VkKTtcbiAgICByZXR1cm4gZXJycy5sZW5ndGggPyB7IGVycnMgfSA6IHsgZXJyczogW10sIHRpbWVsaW5lOiBwYXJzZWQgYXMgVGltZWxpbmVWMyB9O1xuICB9XG4gIGNvbnN0IGVycnMgPSB2YWxpZGF0ZVRpbWVsaW5lKHBhcnNlZCk7XG4gIGlmIChlcnJzLmxlbmd0aCkgcmV0dXJuIHsgZXJycyB9O1xuICByZXR1cm4geyBlcnJzOiBbXSwgdGltZWxpbmU6IG1pZ3JhdGVWMnRvVjMocGFyc2VkIGFzIFRpbWVsaW5lKSB9O1xufVxuXG4vKiogT24tZGlzayB2MyBmb3JtOiBkZWVwIGNsb25lIHdpdGggYF9zY2VuZWAgdGFncyBzdHJpcHBlZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVUaW1lbGluZVYzKHQ6IFRpbWVsaW5lVjMpOiBUaW1lbGluZVYzIHtcbiAgcmV0dXJuIHN0cmlwU2NlbmVUYWdzKHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9SZW5kZXJQcm9wc1YzKHQ6IFRpbWVsaW5lVjMpOiB7IHNob3dHcmlkOiBib29sZWFuOyB0aW1lbGluZTogVGltZWxpbmVWMyB9IHtcbiAgcmV0dXJuIHsgc2hvd0dyaWQ6IGZhbHNlLCB0aW1lbGluZTogc2VyaWFsaXplVGltZWxpbmVWMyh0KSB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQU9BLFNBQVMscUJBQXFCO0FBQzlCLFlBQVksUUFBUTtBQUNwQixZQUFZLFVBQVU7OztBQzRLZixJQUFNLE9BQU8sQ0FBQyxNQUNuQixDQUFDLENBQUMsS0FBSyxNQUFNLFFBQVMsRUFBaUIsTUFBTTs7O0FDbkR4QyxJQUFNLGlCQUFpQixDQUFDLE9BQStCO0FBQzVELFFBQU0sT0FBbUIsS0FBSyxNQUFNLEtBQUssVUFBVSxFQUFFLENBQUM7QUFDdEQsYUFBVyxNQUFNLEtBQUssUUFBUTtBQUM1QixRQUFJLEdBQUcsU0FBUyxPQUFRLElBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxPQUFRLEVBQTBCLE1BQU07QUFDeEYsUUFBSSxHQUFHLFNBQVMsUUFBUyxJQUFHLE9BQU8sUUFBUSxDQUFDLE1BQU0sT0FBUSxFQUEwQixNQUFNO0FBQUEsRUFDNUY7QUFDQSxTQUFPO0FBQ1Q7OztBQ3RHQSxTQUFTLGdCQUFnQixHQUEyQztBQUNsRSxNQUFJLE1BQU0sVUFBYSxNQUFNLEtBQU0sUUFBTztBQUMxQyxNQUFJLE9BQU8sTUFBTSxTQUFVLFFBQU87QUFDbEMsUUFBTSxJQUFJLEVBQUU7QUFDWixTQUFPLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDNUM7QUFFQSxJQUFNLGdCQUFnQixDQUFDLE9BQW1CLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxFQUFFLEVBQUU7QUFFM0QsU0FBUyxrQkFBcUIsR0FBNkI7QUFDekQsUUFBTSxJQUFJLEVBQUUsT0FBTyxFQUFFLE9BQU8sT0FBTyxFQUFFLE1BQU07QUFDM0MsUUFBTSxJQUFJLGdCQUFnQixFQUFFLE1BQU07QUFDbEMsTUFBSSxNQUFNLE9BQVcsR0FBRSxTQUFTO0FBQ2hDLFNBQU87QUFDVDtBQUVBLFNBQVMsb0JBQW9CLEdBQXVDO0FBQ2xFLFFBQU0sSUFBc0IsRUFBRSxPQUFPLEVBQUUsT0FBTyxPQUFPLGNBQWMsRUFBRSxLQUFLLEVBQUU7QUFDNUUsUUFBTSxJQUFJLGdCQUFnQixFQUFFLE1BQU07QUFDbEMsTUFBSSxNQUFNLE9BQVcsR0FBRSxTQUFTO0FBQ2hDLE1BQUksRUFBRSxVQUFXLEdBQUUsWUFBWSxjQUFjLEVBQUUsU0FBUztBQUN4RCxNQUFJLEVBQUUsV0FBWSxHQUFFLGFBQWEsY0FBYyxFQUFFLFVBQVU7QUFDM0QsU0FBTztBQUNUO0FBR0EsSUFBTSxjQUFrQztBQUFBLEVBQ3RDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUVPLFNBQVMsbUJBQW1CLElBQThDO0FBQy9FLFFBQU0sSUFBbUIsQ0FBQztBQUUxQixNQUFJLE1BQU0sUUFBUSxHQUFHLFFBQVEsS0FBSyxHQUFHLFNBQVMsU0FBUyxHQUFHO0FBQ3hELE1BQUUsV0FBVyxHQUFHLFNBQVMsSUFBSSxtQkFBbUI7QUFBQSxFQUNsRDtBQUNBLGFBQVcsT0FBTyxhQUFhO0FBQzdCLFVBQU0sUUFBUSxHQUFHLEdBQUc7QUFDcEIsUUFBSSxNQUFNLFFBQVEsS0FBSyxLQUFLLE1BQU0sU0FBUyxHQUFHO0FBQzVDLE1BQUMsRUFBRSxHQUFHLElBQWdCLE1BQU0sSUFBSSxpQkFBaUI7QUFBQSxJQUNuRDtBQUFBLEVBQ0Y7QUFDQSxTQUFPLE9BQU8sS0FBSyxDQUFDLEVBQUUsU0FBUyxJQUFJLElBQUk7QUFDekM7QUFFTyxTQUFTLGNBQWMsR0FBZTtBQUMzQyxRQUFNLElBQUksQ0FBQztBQUNYLElBQUUsT0FBTyxFQUFFO0FBQ1gsSUFBRSxRQUFRLEVBQUU7QUFDWixJQUFFLE1BQU0sRUFBRTtBQUNWLElBQUUsSUFBSSxFQUFFO0FBQ1IsSUFBRSxJQUFJLEVBQUU7QUFDUixJQUFFLE9BQU8sRUFBRTtBQUNYLElBQUUsT0FBTyxFQUFFO0FBQ1gsSUFBRSxTQUFTLEVBQUU7QUFDYixJQUFFLFFBQVEsRUFBRTtBQUNaLElBQUUsWUFBWSxFQUFFO0FBQ2hCLE1BQUksRUFBRSxTQUFTLFVBQWEsRUFBRSxTQUFTLEtBQU0sR0FBRSxPQUFPLEVBQUU7QUFHeEQsTUFBSSxFQUFFLFdBQVcsVUFBYSxFQUFFLFdBQVcsTUFBTTtBQUMvQyxNQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsT0FBTyxPQUFPLE9BQU8sRUFBRSxPQUFPLE1BQU07QUFBQSxFQUM1RDtBQUNBLE1BQUksTUFBTSxRQUFRLEVBQUUsTUFBTSxHQUFHO0FBQzNCLE1BQUUsU0FBUyxFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU87QUFDOUIsWUFBTSxLQUFLLENBQUM7QUFDWixVQUFJLEdBQUcsTUFBTSxVQUFhLEdBQUcsTUFBTSxLQUFNLElBQUcsSUFBSSxHQUFHO0FBQ25ELFVBQUksR0FBRyxNQUFNLFVBQWEsR0FBRyxNQUFNLEtBQU0sSUFBRyxJQUFJLEdBQUc7QUFDbkQsU0FBRyxPQUFPLEdBQUc7QUFDYixTQUFHLFFBQVEsR0FBRztBQUNkLGFBQU87QUFBQSxJQUNULENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxFQUFFLFdBQVc7QUFDZixVQUFNLEtBQUssbUJBQW1CLEVBQUUsU0FBUztBQUN6QyxRQUFJLEdBQUksR0FBRSxZQUFZO0FBQUEsRUFDeEI7QUFDQSxTQUFPO0FBQ1Q7QUFLTyxTQUFTLG9CQUFvQixHQUEyQjtBQUM3RCxVQUFRLEVBQUUsTUFBTTtBQUFBLElBQ2QsS0FBSztBQUNILGFBQU8sRUFBRSxNQUFNLFNBQVMsT0FBTyxFQUFFLE1BQU07QUFBQSxJQUN6QyxLQUFLLFNBQVM7QUFDWixZQUFNLElBQWdCLEVBQUUsTUFBTSxTQUFTLEtBQUssRUFBRSxPQUFPLGNBQWM7QUFDbkUsVUFBSSxFQUFFLFFBQVEsVUFBYSxFQUFFLFFBQVEsS0FBTSxHQUFFLE1BQU0sRUFBRTtBQUNyRCxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsS0FBSyxTQUFTO0FBQ1osWUFBTSxJQUFnQixFQUFFLE1BQU0sU0FBUyxLQUFLLEVBQUUsT0FBTyxjQUFjO0FBQ25FLFVBQUksRUFBRSxjQUFjLFVBQWEsRUFBRSxjQUFjLEtBQU0sR0FBRSxZQUFZLEVBQUU7QUFDdkUsVUFBSSxFQUFFLFdBQVcsVUFBYSxFQUFFLFdBQVcsS0FBTSxHQUFFLFNBQVMsRUFBRTtBQUM5RCxVQUFJLEVBQUUsVUFBVSxVQUFhLEVBQUUsVUFBVSxLQUFNLEdBQUUsUUFBUSxFQUFFO0FBRTNELFVBQUksTUFBTSxRQUFRLEVBQUUsYUFBYSxHQUFHO0FBQ2xDLFVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxJQUFJLENBQUMsT0FBTztBQUFBLFVBQzVDLFlBQVksRUFBRTtBQUFBLFVBQ2QsVUFBVSxFQUFFO0FBQUEsUUFDZCxFQUFFO0FBQUEsTUFDSjtBQUNBLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxLQUFLLE9BQU87QUFDVixZQUFNLElBQWdCO0FBQUEsUUFDcEIsTUFBTTtBQUFBLFFBQ04sS0FBSyxFQUFFLE9BQU87QUFBQSxRQUNkLEdBQUcsRUFBRTtBQUFBLFFBQ0wsR0FBRyxFQUFFO0FBQUEsUUFDTCxPQUFPLEVBQUU7QUFBQSxRQUNULFFBQVEsRUFBRTtBQUFBLFFBQ1YsY0FBYyxFQUFFLGdCQUFnQjtBQUFBLFFBQ2hDLFdBQVcsRUFBRTtBQUFBLE1BQ2Y7QUFDQSxVQUFJLEVBQUUsUUFBUSxVQUFhLEVBQUUsUUFBUSxLQUFNLEdBQUUsTUFBTSxFQUFFO0FBQ3JELFVBQUksRUFBRSxjQUFjLFVBQWEsRUFBRSxjQUFjLEtBQU0sR0FBRSxZQUFZLEVBQUU7QUFDdkUsVUFBSSxFQUFFLFdBQVcsVUFBYSxFQUFFLFdBQVcsS0FBTSxHQUFFLFNBQVMsRUFBRTtBQUM5RCxVQUFJLEVBQUUsVUFBVSxVQUFhLEVBQUUsVUFBVSxLQUFNLEdBQUUsUUFBUSxFQUFFO0FBQzNELFVBQUksTUFBTSxRQUFRLEVBQUUsYUFBYSxHQUFHO0FBQ2xDLFVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxJQUFJLENBQUMsT0FBTztBQUFBLFVBQzVDLFlBQVksRUFBRTtBQUFBLFVBQ2QsVUFBVSxFQUFFO0FBQUEsUUFDZCxFQUFFO0FBQUEsTUFDSjtBQUNBLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQTtBQUVFLGFBQU8sRUFBRSxNQUFNLFNBQVMsT0FBTyxVQUFVO0FBQUEsRUFDN0M7QUFDRjtBQUdBLElBQU0sb0JBQTZDO0FBQUEsRUFDakQ7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRjtBQUVPLFNBQVMsd0JBQXdCLElBQWdEO0FBQ3RGLFFBQU0sSUFBb0IsQ0FBQztBQUMzQixNQUFJLE1BQU0sUUFBUSxHQUFHLFFBQVEsS0FBSyxHQUFHLFNBQVMsU0FBUyxHQUFHO0FBQ3hELE1BQUUsV0FBVyxHQUFHLFNBQVMsSUFBSSxtQkFBbUI7QUFBQSxFQUNsRDtBQUNBLGFBQVcsT0FBTyxtQkFBbUI7QUFDbkMsVUFBTSxRQUFRLEdBQUcsR0FBRztBQUNwQixRQUFJLE1BQU0sUUFBUSxLQUFLLEtBQUssTUFBTSxTQUFTLEdBQUc7QUFDNUMsTUFBQyxFQUFFLEdBQUcsSUFBZ0IsTUFBTSxJQUFJLGlCQUFpQjtBQUFBLElBQ25EO0FBQUEsRUFDRjtBQUNBLFNBQU8sT0FBTyxLQUFLLENBQUMsRUFBRSxTQUFTLElBQUksSUFBSTtBQUN6QztBQUVPLFNBQVMsZUFBZSxHQUFpQjtBQUM5QyxRQUFNLElBQUksQ0FBQztBQUNYLElBQUUsS0FBSyxFQUFFO0FBQ1QsSUFBRSxRQUFRLEVBQUU7QUFDWixJQUFFLFFBQVEsRUFBRTtBQUNaLElBQUUsTUFBTSxFQUFFO0FBQ1YsSUFBRSxJQUFJLEVBQUU7QUFDUixJQUFFLElBQUksRUFBRTtBQUNSLElBQUUsUUFBUSxFQUFFO0FBQ1osSUFBRSxTQUFTLEVBQUU7QUFDYixJQUFFLFFBQVEsRUFBRTtBQUNaLE1BQUksRUFBRSxpQkFBaUIsVUFBYSxFQUFFLGlCQUFpQixLQUFNLEdBQUUsZUFBZSxFQUFFO0FBQ2hGLE1BQUksRUFBRSxXQUFXLFVBQWEsRUFBRSxXQUFXLE1BQU07QUFDL0MsTUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLE9BQU8sT0FBTyxPQUFPLEVBQUUsT0FBTyxNQUFNO0FBQUEsRUFDNUQ7QUFDQSxNQUFJLEVBQUUsWUFBWSxVQUFhLEVBQUUsWUFBWSxLQUFNLEdBQUUsVUFBVSxFQUFFO0FBQ2pFLE1BQUksRUFBRSxhQUFhLFVBQWEsRUFBRSxhQUFhLEtBQU0sR0FBRSxXQUFXLEVBQUU7QUFDcEUsTUFBSSxFQUFFLFdBQVc7QUFDZixVQUFNLEtBQUssd0JBQXdCLEVBQUUsU0FBUztBQUM5QyxRQUFJLEdBQUksR0FBRSxZQUFZO0FBQUEsRUFDeEI7QUFDQSxTQUFPO0FBQ1Q7QUFNTyxTQUFTLGlCQUFpQixJQUFzQjtBQUNyRCxRQUFNLElBQUksQ0FBQztBQUNYLElBQUUsTUFBTSxHQUFHO0FBQ1gsSUFBRSxRQUFRLEdBQUc7QUFDYixJQUFFLE1BQU0sR0FBRztBQUNYLElBQUUsSUFBSSxHQUFHO0FBQ1QsSUFBRSxJQUFJLEdBQUc7QUFDVCxJQUFFLFFBQVEsR0FBRztBQUNiLElBQUUsU0FBUyxHQUFHO0FBQ2QsTUFBSSxHQUFHLFFBQVEsVUFBYSxHQUFHLFFBQVEsS0FBTSxHQUFFLE1BQU0sR0FBRztBQUN4RCxNQUFJLEdBQUcsaUJBQWlCLFVBQWEsR0FBRyxpQkFBaUIsS0FBTSxHQUFFLGVBQWUsR0FBRztBQUNuRixNQUFJLEdBQUcsWUFBWSxVQUFhLEdBQUcsWUFBWSxLQUFNLEdBQUUsVUFBVSxHQUFHO0FBQ3BFLE1BQUksR0FBRyxhQUFhLFVBQWEsR0FBRyxhQUFhLEtBQU0sR0FBRSxXQUFXLEdBQUc7QUFDdkUsTUFBSSxHQUFHLFdBQVc7QUFDaEIsVUFBTSxLQUFLLHdCQUF3QixHQUFHLFNBQVM7QUFDL0MsUUFBSSxHQUFJLEdBQUUsWUFBWTtBQUFBLEVBQ3hCO0FBQ0EsU0FBTztBQUNUO0FBR08sU0FBUyxlQUFlLEdBQXlDO0FBQ3RFLE1BQUksS0FBSyxLQUFNLFFBQU87QUFFdEIsTUFBSSxPQUFPLE1BQU0sU0FBVSxRQUFPO0FBQ2xDLFFBQU0sSUFBZ0IsRUFBRSxLQUFLLEVBQUUsS0FBSyxRQUFRLEVBQUUsT0FBTztBQUNyRCxNQUFJLEVBQUUsaUJBQWlCLFVBQWEsRUFBRSxpQkFBaUIsS0FBTSxHQUFFLGVBQWUsRUFBRTtBQUNoRixNQUFJLEVBQUUsa0JBQWtCLFVBQWEsRUFBRSxrQkFBa0IsS0FBTSxHQUFFLGdCQUFnQixFQUFFO0FBQ25GLE1BQUksRUFBRSxZQUFZLFVBQWEsRUFBRSxZQUFZLE1BQU07QUFDakQsTUFBRSxVQUFVO0FBQUEsTUFDVixTQUFTLEVBQUUsUUFBUTtBQUFBLE1BQ25CLGNBQWMsRUFBRSxRQUFRO0FBQUEsTUFDeEIsY0FBYyxFQUFFLFFBQVE7QUFBQSxNQUN4QixlQUFlLEVBQUUsUUFBUTtBQUFBLElBQzNCO0FBQUEsRUFDRjtBQUNBLFNBQU87QUFDVDtBQUdPLFNBQVMsb0JBQW9CLEdBQXFDO0FBQ3ZFLFFBQU0sSUFBSSxDQUFDO0FBQ1gsSUFBRSxPQUFPLEVBQUU7QUFDWCxJQUFFLG1CQUFtQixFQUFFO0FBQ3ZCLE1BQUksRUFBRSxjQUFjLFVBQWEsRUFBRSxjQUFjLEtBQU0sR0FBRSxZQUFZLEVBQUU7QUFDdkUsTUFBSSxFQUFFLFdBQVcsVUFBYSxFQUFFLFdBQVcsS0FBTSxHQUFFLFNBQVMsRUFBRTtBQUM5RCxTQUFPO0FBQ1Q7QUFFTyxTQUFTLGVBQWUsR0FBaUI7QUFFOUMsUUFBTSxJQUFJLENBQUM7QUFDWCxJQUFFLEtBQUssRUFBRTtBQUNULElBQUUsbUJBQW1CLEVBQUU7QUFHdkIsSUFBRSxhQUFhLG9CQUFvQixFQUFFLGNBQWMsRUFBRSxNQUFNLFNBQVMsT0FBTyxVQUFVLENBQUM7QUFHdEYsTUFBSSxNQUFNLFFBQVEsRUFBRSxNQUFNLEtBQUssRUFBRSxPQUFPLFNBQVMsR0FBRztBQUNsRCxNQUFFLFNBQVMsRUFBRSxPQUFPLElBQUksY0FBYztBQUFBLEVBQ3hDO0FBQ0EsSUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLEdBQUcsSUFBSSxhQUFhO0FBRzNDLE1BQUksTUFBTSxRQUFRLEVBQUUsUUFBUSxLQUFLLEVBQUUsU0FBUyxTQUFTLEdBQUc7QUFDdEQsTUFBRSxXQUFXLEVBQUUsU0FBUyxJQUFJLGdCQUFnQjtBQUFBLEVBQzlDO0FBQ0EsTUFBSSxFQUFFLHFCQUFxQixVQUFhLEVBQUUscUJBQXFCLE1BQU07QUFDbkUsTUFBRSxtQkFBbUIsb0JBQW9CLEVBQUUsZ0JBQWdCO0FBQUEsRUFDN0Q7QUFDQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLGtCQUFrQixHQUF1QjtBQUN2RCxTQUFPO0FBQUEsSUFDTCxLQUFLLEVBQUU7QUFBQSxJQUNQLE9BQU8sRUFBRTtBQUFBLElBQ1QsUUFBUSxFQUFFO0FBQUEsSUFDVixPQUFPLGVBQWUsRUFBRSxLQUFLO0FBQUEsSUFDN0IsU0FBUyxFQUFFLFVBQVUsQ0FBQyxHQUFHLElBQUksY0FBYztBQUFBLEVBQzdDO0FBQ0Y7QUFJTyxTQUFTLGlCQUFpQixHQUFzQjtBQUNyRCxRQUFNLE9BQWlCLENBQUM7QUFDeEIsTUFBSSxDQUFDLEtBQUssT0FBTyxNQUFNLFlBQVksTUFBTSxRQUFRLENBQUMsR0FBRztBQUNuRCxTQUFLLEtBQUssK0JBQStCO0FBQ3pDLFdBQU87QUFBQSxFQUNUO0FBQ0EsUUFBTSxJQUFJO0FBQ1YsYUFBVyxLQUFLLENBQUMsT0FBTyxTQUFTLFFBQVEsR0FBRztBQUMxQyxRQUFJLE9BQU8sRUFBRSxDQUFDLE1BQU0sU0FBVSxNQUFLLEtBQUssSUFBSSxtQkFBbUI7QUFBQSxFQUNqRTtBQUlBLE1BQUksZ0JBQWdCLEtBQUssT0FBTyxFQUFFLGVBQWUsVUFBVTtBQUN6RCxTQUFLLEtBQUssbURBQW1EO0FBQUEsRUFDL0Q7QUFDQSxNQUFJLEVBQUUsV0FBVyxHQUFJLE1BQUssS0FBSyxnQ0FBZ0M7QUFDL0QsTUFBSSxDQUFDLE1BQU0sUUFBUSxFQUFFLE1BQU0sR0FBRztBQUM1QixTQUFLLEtBQUsseUJBQXlCO0FBQ25DLFdBQU87QUFBQSxFQUNUO0FBQ0EsRUFBQyxFQUFFLE9BQXFCLFFBQVEsQ0FBQyxVQUFVLE1BQU07QUFDL0MsVUFBTSxJQUFJO0FBQ1YsUUFBSSxPQUFPLEVBQUUsT0FBTyxTQUFVLE1BQUssS0FBSyxVQUFVLENBQUMsdUJBQXVCO0FBQzFFLFFBQUksT0FBTyxFQUFFLHFCQUFxQjtBQUNoQyxXQUFLLEtBQUssVUFBVSxDQUFDLHFDQUFxQztBQUM1RCxRQUFJLENBQUMsTUFBTSxRQUFRLEVBQUUsS0FBSyxFQUFHLE1BQUssS0FBSyxVQUFVLENBQUMsMEJBQTBCO0FBQzVFLEtBQUUsRUFBRSxTQUF1QixDQUFDLEdBQUcsUUFBUSxDQUFDLFVBQVUsTUFBTTtBQUN0RCxZQUFNLElBQUk7QUFDVixpQkFBVyxLQUFLLENBQUMsU0FBUyxPQUFPLEtBQUssS0FBSyxRQUFRLFFBQVEsR0FBRztBQUM1RCxZQUFJLE9BQU8sRUFBRSxDQUFDLE1BQU07QUFDbEIsZUFBSyxLQUFLLFVBQVUsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLG1CQUFtQjtBQUFBLE1BQzlEO0FBQ0EsVUFBSSxPQUFPLEVBQUUsU0FBUztBQUNwQixhQUFLLEtBQUssVUFBVSxDQUFDLFdBQVcsQ0FBQyx5QkFBeUI7QUFBQSxJQUM5RCxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBQ0QsU0FBTztBQUNUO0FBd0JPLFNBQVMsbUJBQW1CLEdBQXNCO0FBQ3ZELFFBQU0sT0FBaUIsQ0FBQztBQUN4QixNQUFJLENBQUMsS0FBSyxPQUFPLE1BQU0sWUFBWSxNQUFNLFFBQVEsQ0FBQyxFQUFHLFFBQU8sQ0FBQywrQkFBK0I7QUFDNUYsUUFBTSxJQUFJO0FBQ1YsYUFBVyxLQUFLLENBQUMsT0FBTyxTQUFTLFFBQVEsRUFBRyxLQUFJLE9BQU8sRUFBRSxDQUFDLE1BQU0sU0FBVSxNQUFLLEtBQUssR0FBRyxDQUFDLG1CQUFtQjtBQUMzRyxNQUFJLENBQUMsTUFBTSxRQUFRLEVBQUUsTUFBTSxFQUFHLE1BQUssS0FBSyx5QkFBeUI7QUFDakUsU0FBTztBQUNUO0FBZU8sU0FBUyxvQkFBb0IsR0FBMkI7QUFDN0QsU0FBTyxlQUFlLENBQUM7QUFDekI7OztBSGhZQSxJQUFNQSxXQUFVLGNBQWMsWUFBWSxHQUFHO0FBQzdDLElBQU0sRUFBRSxPQUFPLElBQUlBLFNBQVEsbUJBQW1CO0FBQzlDLElBQU0sRUFBRSxtQkFBbUIsYUFBYSxjQUFjLElBQ3BEQSxTQUFRLG9CQUFvQjtBQUU5QixJQUFNLE9BQU8sUUFBUSxJQUFJO0FBQ3pCLElBQU0sU0FBUyxRQUFRLEtBQUssQ0FBQyxLQUFLO0FBQ2xDLElBQU0sVUFBZSxhQUFRLFFBQVEsS0FBSyxDQUFDLEtBQUssY0FBYztBQUFBLENBRTdELFlBQVk7QUFDWCxRQUFNLE1BQU0sS0FBSyxNQUFTLGdCQUFhLFFBQVEsTUFBTSxDQUFDO0FBQ3RELFFBQU0sV0FBVyxLQUFLLEdBQUcsSUFBSSxvQkFBb0IsR0FBRyxJQUFJLGtCQUFrQixHQUFHO0FBQzdFLFFBQU0sT0FBTyxLQUFLLFFBQVEsSUFDdEIsbUJBQW1CLFFBQVEsSUFDM0IsaUJBQWlCLFFBQVE7QUFDN0IsTUFBSSxLQUFLLE9BQVEsT0FBTSxJQUFJLE1BQU07QUFBQSxJQUF3QixLQUFLLEtBQUssTUFBTSxDQUFDLEVBQUU7QUFFNUUsUUFBTSxpQkFBaUIsUUFBUSxJQUFJLDJCQUEyQjtBQUM5RCxRQUFNLGNBQWMsS0FBSyxJQUFJLEdBQUcsT0FBTyxRQUFRLElBQUksc0JBQXNCLENBQUMsQ0FBQztBQUMzRSxRQUFNLGFBQWEsRUFBRSxVQUFVLFVBQVUsT0FBTyxlQUFlO0FBQy9ELFFBQU0sY0FBYztBQUNwQixVQUFRLElBQUksZ0JBQVc7QUFDdkIsUUFBTSxXQUFXLE1BQU0sT0FBTztBQUFBLElBQzVCLFlBQWlCLFVBQUssTUFBTSxPQUFPLFVBQVU7QUFBQTtBQUFBO0FBQUEsSUFHN0MsV0FBVyxRQUFRLElBQUksa0JBQ2QsYUFBUSxRQUFRLElBQUksZUFBZSxJQUNuQyxVQUFLLE1BQU0sUUFBUTtBQUFBLElBQzVCLFlBQVksTUFBTTtBQUFBLElBQUM7QUFBQSxFQUNyQixDQUFDO0FBQ0QsUUFBTSxjQUFjLE1BQU0sa0JBQWtCLEVBQUUsVUFBVSxJQUFJLFNBQVMsV0FBVyxDQUFDO0FBQ2pGLFFBQU0sY0FBYyxZQUFZO0FBQ2hDLFVBQVEsSUFBSSxhQUFhLFdBQVcsa0JBQWEsT0FBTyxFQUFFO0FBQzFELFVBQVEsSUFBSSxlQUFlLFdBQVcsbUJBQW1CLGNBQWMsRUFBRTtBQUN6RSxNQUFJLE9BQU87QUFDWCxRQUFNLFlBQVk7QUFBQSxJQUNoQjtBQUFBLElBQ0E7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQLEtBQUs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0wsYUFBYTtBQUFBLElBQ2IsYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osZ0JBQWdCO0FBQUEsSUFDaEI7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXO0FBQUEsSUFDWCxZQUFZLENBQUMsRUFBRSxlQUFlLE1BQU07QUFDbEMsWUFBTSxNQUFNLEtBQUssTUFBTyxpQkFBaUIsY0FBZSxHQUFHO0FBQzNELFVBQUksT0FBTyxPQUFPLElBQUk7QUFDcEIsZUFBTztBQUNQLGdCQUFRLElBQUksS0FBSyxHQUFHLE1BQU0sY0FBYyxJQUFJLFdBQVcsR0FBRztBQUFBLE1BQzVEO0FBQUEsSUFDRjtBQUFBLEVBQ0YsQ0FBQztBQUNELFVBQVEsSUFBSSxTQUFTLE9BQU8sRUFBRTtBQUM5QixVQUFRLEtBQUssQ0FBQztBQUNoQixHQUFHLEVBQUUsTUFBTSxDQUFDLE1BQU07QUFDaEIsVUFBUSxNQUFNLENBQUM7QUFDZixVQUFRLEtBQUssQ0FBQztBQUNoQixDQUFDOyIsCiAgIm5hbWVzIjogWyJyZXF1aXJlIl0KfQo=
