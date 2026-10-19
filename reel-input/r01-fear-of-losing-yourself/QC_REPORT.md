# QC report — R01 Fear of Losing Yourself

STAGE=PREPRODUCTION
FINAL_RENDER_QC=NOT_RUN_BY_DESIGN
READY_FOR_TIMELINE=NO—EDITORIAL_APPROVAL_REQUIRED

## Automated preproduction checks

- [x] Source master declared: `video1219377731.mp4`
- [x] Native provenance authority declared: `transcripts/video1219377731/asr_video1219377731.json`
- [x] Source cuts use native segment boundaries; no cut crosses a subtitle interval.
- [x] Literal SOURCE and DISPLAY RU are stored separately.
- [x] English translation layers use deliberate phrase groups, not Russian word timestamps.
- [x] B-roll references, when present, point to existing catalogued assets.

## Clip extraction

- [ ] r01-hook-loss: `reel-input/r01-fear-of-losing-yourself/public/clips/001_hook.mp4`
- [ ] r01-clarity-ground: `reel-input/r01-fear-of-losing-yourself/public/clips/002_payoff.mp4`

## Editorial checks still required

- [ ] Listen to every selected edge; confirm no clipped first/last phoneme.
- [ ] Confirm speaker identity from video/audio (ASR is not diarized).
- [ ] Correct obvious native-ASR lexical errors against the audio and log every correction.
- [ ] Approve DISPLAY RU and phrase grouping.
- [ ] Approve filler removals and discontinuous source jumps.
- [ ] Approve or reject each optional B-roll insert.
- [ ] Approve final duration and edit plan before generating timeline.json.

## Render-stage checks (pending)

- [ ] v3 timeline validation / asset existence / no unintended gaps or primary-audio overlap.
- [ ] Headless stills: safe area, faces, subtitles, cards and layer overlap.
- [ ] Encoded MP4: 1080×1920@30, H.264 yuv420p BT.709, AAC stereo, audio present, changing frames.
- [ ] Final editorial watch-through.

