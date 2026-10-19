# R02 subtitle-width repaired candidate

OUTPUT=`out/r02-connection-without-future-series-candidate-v2.mp4`
DURATION=66.240 s
R02_SECOND_RENDER_AUTHORIZED=YES
R02_SECOND_CANDIDATE_RENDERED=YES

## Safe width

The official 96 px left/right safe area is tightened by a 24 px internal margin. Effective bounds are `120 <= x <= 960`.

| Previously failing range | Layout group | LINE_COUNT | FONT_SIZE | LEFT_BOUND | RIGHT_BOUND | SAFE_LEFT | SAFE_RIGHT | RESULT |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 00:01.2 | `question:q-g1:page:1` | 2 | 45 | 322.0 | 758.0 | 120 | 960 | PASS |
| 00:21.5 | `question:q-g2:page:1` | 3 | 56 | 175.5 | 904.5 | 120 | 960 | PASS |
| 00:28.4 | `context:c-g1:page:2` | 3 | 52 | 233.0 | 847.0 | 120 | 960 | PASS |
| 01:03.5–01:05.7 | `payoff:p-g3:page:1` | 4 | 54 | 223.5 | 856.5 | 120 | 960 | PASS |

The widest generated layout page is `question:q-g1:page:3`, with measured bounds `127.0..953.0`; it also passes the internal-margin validator.

PRE_RENDER_SUBTITLE_SAFE_WIDTH=PASS
HORIZONTAL_CLIPPING=NO
MAX_SUBTITLE_LINES=4
MINIMUM_USED_FONT_SIZE=45

## Cumulative reveal

- [x] no horizontal reflow
- [x] no vertical reflow
- [x] previous words remain fixed
- [x] no clipping

All speech lines have frozen final coordinates and no position keyframes. Reveal frames are monotonic. Overlong authority groups use sequential fixed-layout pages without changing their token reveal frames.

## Visual readability

- [x] 3/4-line groups feel natural
- [x] no unnecessarily tiny text
- [x] line breaks feel semantic

Four layout-only prechecks and six frames extracted from the completed MP4 were inspected. The former left/right clipping is absent in the rendered pixels.

## Existing production layers

- [x] B-roll preserved
- [x] Connection music preserved
- [x] speech 1.0x
- [x] endpoints A/C preserved

BROLL_COUNT=2
MUSIC=`Connection — Wayne Jones`
CONTEXT_ENDPOINT=01:19:12.320
PAYOFF_ENDPOINT=01:21:06.060

## Technical QC

FFPROBE_QC=PASS
DECODE_QC=PASS
AUDIO_QC=PASS
VIDEO=H.264 High, 1080x1920, 30 fps, yuv420p, BT.709
AUDIO=AAC-LC, 48 kHz, stereo
VIDEO_DURATION=66.133333 s
CONTAINER_DURATION=66.240000 s
FILE_SIZE=20,552,117 bytes
AUDIO_MEAN_VOLUME=-31.1 dB
AUDIO_MAX_VOLUME=-6.8 dB
ACCIDENTAL_INTERNAL_SILENCE=NOT_DETECTED

FINAL_QC_FRAMES=`scratch_check/nikulina_2026/r02_width_final_qc/`
QC_FRAME_COUNT=6

## Full Reel

- [x] R02 FINAL PRODUCTION APPROVED
- [ ] NEEDS CHANGES

R02_FINAL_HUMAN_APPROVAL=YES
R02_FINAL_HUMAN_APPROVAL_SOURCE=CURRENT_EXPLICIT_HUMAN_DECISION
READY_FOR_R02_V2_HUMAN_REVIEW=COMPLETED_APPROVED

R06_RERENDERED=NO
OTHER_REELS_RENDERED=NO
R07_RENDERED=NO
CANONICAL_ASR_MODIFIED=NO
MASTER_SOURCE_MODIFIED=NO
