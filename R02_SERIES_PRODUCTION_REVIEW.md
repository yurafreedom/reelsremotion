# R02 Series Production Review

OUTPUT=`out/r02-connection-without-future-series-candidate.mp4`
RENDER_COUNT=1
SPEECH_RATE=1.0X
SOURCE_SEQUENCE=QUESTION, CONTEXT_A, PAYOFF_C
CONTEXT_ENDPOINT=01:19:12.320
PAYOFF_ENDPOINT=01:21:06.060

## Opening

The editorial hook makes the question immediately understandable, but the cumulative opening line exceeds the horizontal safe area while it is revealing. The opening therefore fails visual QC despite preserving the approved source question.

## Source / joins

The approved Context A and Payoff C endpoints are applied. Validation, decode sanity, stream presence, duration, and audio continuity checks passed. No cut word, click, broken breath, or accidental internal silence was detected by the lightweight technical checks.

## Subtitles

Programmatic checks passed for cumulative metadata, monotonic reveal timing, derived visual timing on translated text, and attached accent text. Visual frame review failed: long Russian display lines are clipped at the left and/or right frame edges at approximately 00:01.2, 00:21.5, 00:28.4, and 01:03.5–01:05.7. The shorter line at 00:50.0 is safe. This candidate needs line wrapping or width-aware fitting before approval.

CUMULATIVE_REVEAL=YES
TRANSLATED_TIMING=DERIVED_VISUAL_REVEAL_NOT_ACOUSTIC
ORPHANED_ACCENT_CHECK=PASS
R02_QC=FAIL_SUBTITLE_SAFE_WIDTH

## B-roll

Two inserts are present. BR020 supports the value/pleasure beat with authentic shared laughter; BR012 supports the “enter lightly” beat with forward movement. Both improve rhythm and meaning, but subtitles over both inserts remain subject to the safe-width failure.

BROLL_COUNT=2
BROLL_UNIQUE_RANGES=YES

## Music

`Connection — Wayne Jones` is unique within the rendered series set, instrumental, restrained, and appropriately ducked. Speech remains dominant; no vocals or obvious pumping were detected.

MUSIC_VOCALS=NO
MUSIC_DUPLICATE=NO

## Visual system

The Nikulina 2026 split-frame, typography, B-roll, and final-card language are preserved. The final editorial card is readable and within bounds. No orphan graphic state was found. The long-line width defect prevents visual approval.

## Full Reel

- [ ] APPROVE
- [ ] NEEDS CHANGES

HUMAN_REVIEW=PENDING
AUTOMATIC_SECOND_RENDER=NO
RENDER_BLOCKER_FOR_APPROVAL=SUBTITLE_SAFE_WIDTH

## Technical QC

VIDEO=H.264 High, 1080x1920, 30 fps, yuv420p
AUDIO=AAC-LC, 48 kHz, stereo
DURATION=66.240 s container; 66.133 s video
FILE_SIZE=20,425,368 bytes
FFPROBE=PASS
DECODE_SANITY=PASS
AUDIO_STREAM=PASS
VIDEO_STREAM=PASS
ACCIDENTAL_INTERNAL_SILENCE=NOT_DETECTED

QC_FRAMES=`scratch_check/nikulina_2026/r02_series_qc/`
