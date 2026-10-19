#!/usr/bin/env node
/**
 * Headless gate for the click-tool import/export core (CRITICAL №2 + gate step 3/4).
 *
 * It does NOT re-implement anything: it EXTRACTS the exact CORE:TIMELINE-IO block
 * from click-tool/index.html (single source of truth, still one file) and runs it.
 *
 * Checks:
 *   1. round-trip identity — serializeTimeline(parse(file)) deep-equals file,
 *      for BOTH public/timeline.json (words WITHOUT `case`) and a draft.json
 *      (words WITH `case`). Proves import loses nothing, incl. start/end.
 *   2. idempotence — serialize(serialize(x)) === serialize(x).
 *   3. edit-then-export — moving one word changes only that word's x,y and
 *      nothing else (proves the click-tool -> engine seam carries an edit).
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// --- Extract the pure core block verbatim and load it as a module. ---
const m = HTML.match(
  /\/\/ ===== CORE:TIMELINE-IO BEGIN =====([\s\S]*?)\/\/ ===== CORE:TIMELINE-IO END =====/
);
assert(m, "CORE:TIMELINE-IO markers not found in index.html");
const coreModulePath = path.join(__dirname, ".roundtrip-core.cjs");
fs.writeFileSync(coreModulePath, m[1]);
const TimelineIO = require(coreModulePath);

function deepEqualReport(actual, expected, label) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  PASS  ${label}`);
    return true;
  } catch (e) {
    console.error(`  FAIL  ${label}`);
    console.error("        " + (e.message || "").split("\n").slice(0, 8).join("\n        "));
    return false;
  }
}

let ok = true;

// ---- Check 1+2: round-trip identity + idempotence over real fixtures. ----
const fixtures = [
  path.join(ROOT, "public", "timeline.json"), // words WITHOUT `case`
  path.join(ROOT, "public", "timeline2.json"), // v2.0: scene transitionToNext
  path.join(ROOT, "public", "timeline_audio.json"), // v2.0: AudioTrack + ducking + inset volume/muted/speechRegions
];
// draft.json is produced by the ASR step; include it if present.
const draft = path.join(ROOT, "out", "draft.json");
if (fs.existsSync(draft)) fixtures.push(draft);

for (const fx of fixtures) {
  const raw = fs.readFileSync(fx, "utf8");
  const input = JSON.parse(raw);
  const errs = TimelineIO.validateTimeline(input);
  ok = (errs.length === 0) && ok;
  if (errs.length) console.error(`  FAIL  validate ${path.basename(fx)}: ${errs.join(", ")}`);
  else console.log(`  PASS  validate ${path.basename(fx)}`);

  const out1 = TimelineIO.serializeTimeline(input);
  ok = deepEqualReport(out1, input, `round-trip identity: ${path.basename(fx)}`) && ok;

  const out2 = TimelineIO.serializeTimeline(out1);
  ok = deepEqualReport(out2, out1, `idempotence: ${path.basename(fx)}`) && ok;

  // Explicit start/end preservation assertion (CRITICAL №1).
  input.scenes.forEach((s, i) => {
    s.words.forEach((w, j) => {
      const o = out1.scenes[i].words[j];
      if (o.start !== w.start || o.end !== w.end) {
        ok = false;
        console.error(`  FAIL  timings drifted at scene ${i} word ${j}`);
      }
      // `case` presence must match exactly.
      if (("case" in w) !== ("case" in o)) {
        ok = false;
        console.error(`  FAIL  case-presence drifted at scene ${i} word ${j}`);
      }
    });
    // v2.0: transitionToNext + inset speechRegions/volume/muted preserved exactly.
    const so = out1.scenes[i];
    if (("transitionToNext" in s) !== ("transitionToNext" in so)) {
      ok = false;
      console.error(`  FAIL  transitionToNext presence drifted at scene ${i}`);
    }
    const vi = s.video, vo = so.video;
    if (vi && vo) {
      try {
        assert.deepStrictEqual(vo.speechRegions, vi.speechRegions);
        assert.strictEqual(vo.volume, vi.volume);
        assert.strictEqual(vo.muted, vi.muted);
      } catch (e) {
        ok = false;
        console.error(`  FAIL  inset audio fields drifted at scene ${i}: ${e.message}`);
      }
    }
  });
  // v2.0: AudioTrack preserved exactly.
  ok = deepEqualReport(out1.audio, input.audio, `audio preserved: ${path.basename(fx)}`) && ok;
  console.log(`  PASS  start/end + case-presence preserved: ${path.basename(fx)}`);
}

// ---- Check 3: edit one word -> export -> only that word's x,y changed. ----
{
  const input = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "timeline.json"), "utf8"));
  const edited = TimelineIO.cloneTimeline(input);
  // Simulate a drag of the first word (same field the UI mutates).
  edited.scenes[0].words[0].x = 200;
  edited.scenes[0].words[0].y = -100;
  const out = TimelineIO.serializeTimeline(edited);

  assert.strictEqual(out.scenes[0].words[0].x, 200, "edited x not exported");
  assert.strictEqual(out.scenes[0].words[0].y, -100, "edited y not exported");
  // Everything else identical to the original input.
  const expected = TimelineIO.cloneTimeline(input);
  expected.scenes[0].words[0].x = 200;
  expected.scenes[0].words[0].y = -100;
  ok = deepEqualReport(out, expected, "edit changed ONLY the dragged word's x,y") && ok;
  // And the edited word kept its real timings.
  assert.strictEqual(out.scenes[0].words[0].start, input.scenes[0].words[0].start);
  assert.strictEqual(out.scenes[0].words[0].end, input.scenes[0].words[0].end);
  console.log("  PASS  edited word retained start/end");

  // Emit props for the engine render (gate step 4).
  fs.writeFileSync(
    path.join(ROOT, "out", "props.edited.json"),
    JSON.stringify({ timeline: out, showGrid: false }, null, 2)
  );
  console.log("  wrote out/props.edited.json (timeline with the moved word)");
}

fs.unlinkSync(coreModulePath);
console.log(ok ? "\nALL ROUND-TRIP CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
