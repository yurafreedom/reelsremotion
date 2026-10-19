import React from "react";
import { Composition } from "remotion";
import { ReelsVideo } from "./Video";
import type { ReelsProps } from "./types";
import { waitForReelsFonts } from "./fonts";
import { SMOKE_TEST } from "./smoke-test";
import { migrateV2toV3 } from "./migrateV3";

// Default inputProps = the smoke-test fixture + grid on. Phase 2 overrides the
// timeline via --props (e.g. --props=./public/timeline.json) with zero code edits.
const defaultProps: ReelsProps = {
  timeline: SMOKE_TEST,
  showGrid: true,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reels"
      component={ReelsVideo}
      defaultProps={defaultProps}
      // Dimensions/fps/duration are all derived from the timeline props,
      // so --props can change the whole video — size included — without code edits.
      calculateMetadata={async ({ props }) => {
        await waitForReelsFonts((props as ReelsProps & { localFontsOnly?: boolean }).localFontsOnly === true);
        // Accept a v2 (scenes) or v3 (tracks) timeline; migrate idempotently so
        // dimensions/fps/duration come from the v3 model (zero hardcoding).
        const t = migrateV2toV3((props as ReelsProps).timeline);
        return {
          width: t.width,
          height: t.height,
          fps: t.fps,
          durationInFrames: t.durationInFrames,
        };
      }}
      // Placeholder metadata; overwritten by calculateMetadata above.
      width={SMOKE_TEST.width}
      height={SMOKE_TEST.height}
      fps={SMOKE_TEST.fps}
      durationInFrames={migrateV2toV3(SMOKE_TEST).durationInFrames}
    />
  );
};
