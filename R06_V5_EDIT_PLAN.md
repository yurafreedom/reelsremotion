# R06 V5 targeted edit plan

BASE_CANDIDATE=out/r06-what-is-actually-true-v4-1x-broll-music-candidate.mp4
OUTPUT=out/r06-what-is-actually-true-v5-music-and-subtitle-fix-candidate.mp4

SPEECH_PLAYBACK_RATE=1.0
SPEECH_TIMING_CHANGED=NO
REAL_OPENING_QUESTION=KEPT
CUMULATIVE_REVEAL_FOUNDATION=KEPT
BROLL_COUNT=3
FINAL_CARD=KEPT
EXPECTED_FINAL_DURATION=51.667 s / 1550 frames at 30 fps

## Subtitle-state repair

PROBLEM_SEQUENCE=block-2
PROBLEM_LOCAL_BOUNDARY=00:08.420
PROBLEM_GLOBAL_BOUNDARY=00:28.387
ROOT_CAUSE=`preset2-wine-plate` continued until Block 2 end at 9.340 s while its attached accent caption group ended at 8.420 s, leaving an empty wine plate during the trailing phrase.
FIX=`preset2-wine-plate` now ends at 8.420 s with the accent text; the full-line trailing phrase `чтобы поверить?` begins at the same boundary as one stable readable unit.
ORPHANED_RED_BAR_REMOVED=YES
LAYOUT_REFLOW_INTRODUCED=NO
OTHER_CUMULATIVE_SPEECH_GROUPS_CHANGED=NO

## Replacement music

PREVIOUS_MUSIC=Connection — Wayne Jones
MUSIC_SELECTED=Meridian — National Sweetheart
MUSIC_SOURCE=public/media/Meridian - National Sweetheart.mp3
MUSIC_RENDER_ASSET=reel-input/r06-what-is-actually-true/public/media/Meridian - National Sweetheart.mp3
MUSIC_HAS_VOCALS=NO
MUSIC_DURATION=221.430 s
MUSIC_BASE_VOLUME=0.055
MUSIC_DUCKED_VOLUME=0.025
MUSIC_FADE_IN=15 frames
MUSIC_FADE_OUT=30 frames
MUSIC_DUCKING_METHOD=speechRegions; attack=6 frames; release=8 frames

`Meridian` is the only alternate local project bed previously used without the explicit sung-vocals warning attached to `No One Here Gets In Alive` and its HPF derivative. It provides a different reflective instrumental texture while remaining long enough for a continuous bed. Because its source level is approximately 6.7 dB hotter than the rejected V4 track, the base and ducked gains are reduced to preserve speech dominance rather than simply reusing the old gain values.

## Preserved V4 editorial structure

BROLL_1_POSITION=00:14.000–00:15.600
BROLL_2_POSITION=00:25.467–00:26.867
BROLL_3_POSITION=00:36.700–00:38.100
QUESTION_SOURCE_INTERVAL=02:16:11.260–02:16:26.860
CANONICAL_ASR_MODIFIED=NO
MASTER_SOURCE_MODIFIED=NO
OTHER_REELS_IN_SCOPE=NO
