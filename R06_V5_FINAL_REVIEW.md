# R06 V5 — targeted music and subtitle-state remediation

OUTPUT=out/r06-what-is-actually-true-v5-music-and-subtitle-fix-candidate.mp4
EDIT_PLAN=R06_V5_EDIT_PLAN.md
QC_FRAMES=scratch_check/nikulina_2026/r06_v5_transition_qc/

R06_V5_COMPLETE=YES
SPEECH_SPEED=1.0X_CONFIRMED
OPENING_REAL_QUESTION=KEPT
CUMULATIVE_REVEAL=KEPT
BROLL_COUNT=3_KEPT
FINAL_CARD=KEPT

SUBTITLE_BUG_FIXED=YES
ORPHANED_RED_BAR_REMOVED=YES
PROBLEM_TRANSITION_REPAIRED=YES

MUSIC_REPLACED=YES
MUSIC_TRACK=Meridian — National Sweetheart
MUSIC_VOCALS=NO
MUSIC_BASE_VOLUME=0.055
MUSIC_DUCKED_VOLUME=0.025
MUSIC_DUCKING=speechRegions; attack=6 frames; release=8 frames

CANONICAL_ASR_MODIFIED=NO
MASTER_SOURCE_MODIFIED=NO
OTHER_REELS_RENDERED=NO

READY_FOR_HUMAN_REVIEW=YES

## Subtitle transition review

The repaired Block 2 boundary is frame 852 / approximately 00:28.400 in the rendered file. Immediately before it, the wine plate has active visible accent text. At and after the boundary, the plate is gone and `чтобы поверить?` appears as one stable unit; there is no empty plate, isolated `чтобы`, or layout reflow.

Review frames:

- `01_before_boundary_28.300.jpg` — valid accent state with text attached to the plate;
- `02_after_boundary_28.400.jpg` — clean full trailing phrase, no plate;
- `03_trailing_phrase_28.650.jpg` — stable repaired state;
- `04_near_block_end_29.150.jpg` — stable state through the end of Block 2.

[ ] SUBTITLE TRANSITION APPROVED
[ ] SUBTITLE TRANSITION NEEDS CHANGES

## Music review

The previous `Connection — Wayne Jones` bed was replaced with the local instrumental `Meridian — National Sweetheart`. The source is hotter than the V4 music, so gain was reduced while retaining smooth speech-driven ducking.

Listen once on headphones and once on a phone speaker:

- speech remains fully intelligible;
- music creates restrained forward motion;
- no vocals or intrusive melody distract from the dialogue;
- no pumping at speech boundaries;
- final fade feels natural.

[ ] MUSIC APPROVED
[ ] MUSIC TOO LOUD
[ ] MUSIC TOO QUIET
[ ] WRONG TRACK

## Lightweight technical QC

FFPROBE_QC=PASS
VIDEO_STREAM=H.264 High; yuv420p; 1080×1920; 30 fps; 1550 frames; 51.666667 s
AUDIO_STREAM=AAC-LC; 48 kHz; stereo; 51.776 s
CONTAINER_DURATION=51.776 s
DECODE_SANITY=PASS
AUDIO_MEAN_VOLUME=-23.0 dBFS
AUDIO_MAX_VOLUME=-3.8 dBFS
AUDIO_CLIPPING=NO

[ ] R06 V5 APPROVED
[ ] R06 V5 NEEDS CHANGES
