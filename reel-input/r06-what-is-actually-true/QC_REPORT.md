# QC report — R06 What Do You Actually Know Is True?

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

- [x] r06-self-question: `reel-input/r06-what-is-actually-true/public/clips/001_hook.mp4`
- [x] r06-evidence-question: `reel-input/r06-what-is-actually-true/public/clips/002_second-question.mp4`
- [x] r06-facts: `reel-input/r06-what-is-actually-true/public/clips/003_payoff.mp4`
- [x] r06-reality: `reel-input/r06-what-is-actually-true/public/clips/004_context.mp4`

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

