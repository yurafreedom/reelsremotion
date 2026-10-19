// Thin re-export of the existing TimelineIO (editor/src/io.ts). The SDK does NOT
// reimplement serialization/validation — it reuses the one authority so a reel the
// SDK writes is byte-identical in shape to one the editor writes (same key order,
// present-only optional fields, round-trips deep-equal).
//
// `@engine/*` inside io.ts resolves via compose/run.mjs's alias (and compose/tsconfig.json).

import * as fs from "node:fs";
import type { Timeline } from "@engine/types";
import {
  serializeTimeline,
  validateTimeline,
  cloneTimeline,
  serializeTimelineV3,
  validateTimelineV3,
} from "../editor/src/io";

export {
  serializeTimeline,
  validateTimeline,
  cloneTimeline,
  serializeTimelineV3,
  validateTimelineV3,
};

/** Load a timeline from disk (an ASR draft, or a reel from the editor/SDK).
 *  Validates structurally — throws on a malformed file rather than silently
 *  producing a broken reel. Returns a detached, mutable working copy. */
export const importTimeline = (filePath: string): Timeline => {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const errs = validateTimeline(parsed);
  if (errs.length) {
    throw new Error(
      `importTimeline(${filePath}): invalid timeline:\n  ${errs.join("\n  ")}`
    );
  }
  // Round-trip through the serializer so we hold a normalized, detached copy.
  return cloneTimeline(parsed as Timeline);
};

/** Serialize (CONTRACT key order, present-only optionals), validate, and write.
 *  Throws if the SDK produced anything the validator rejects — the SDK never
 *  emits an invalid timeline.json. */
export const writeTimeline = (t: Timeline, filePath: string): string => {
  const serialized = serializeTimeline(t);
  const errs = validateTimeline(serialized);
  if (errs.length) {
    throw new Error(
      `writeTimeline(${filePath}): SDK produced an invalid timeline:\n  ${errs.join(
        "\n  "
      )}`
    );
  }
  fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2) + "\n", "utf8");
  return filePath;
};
