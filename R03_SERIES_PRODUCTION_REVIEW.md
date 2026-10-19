# R03 Series Production Review

STATUS=CANDIDATE_READY_HUMAN_REVIEW  
OUTPUT=`out/r03-dominance-is-not-control-series-candidate.mp4`  

## Opening

Speech is active from frame 0. The approved `ДОМИНИРОВАНИЕ — НЕ КОНТРОЛЬ` hook overlays the live source and clears without an orphan plate.

## Source / joins

The approved 1.0x block ends after `когда ты рассыпаешься`; the rejected tail is excluded. The human-approved word-level end lies inside a longer canonical SRT segment, so the pipeline reports an expected warning; canonical episode ASR and master source remain unchanged.

## Subtitle safe width

PRE_RENDER_SAFE_WIDTH=PASS  
LAYOUT_GROUPS=7  
MAX_LINES_USED=4  
MIN_FONT_USED=56  
PRE_RENDER_STILLS=4/4_PASS  

## Cumulative reveal

WIDTH_AWARE_FIXED_SUBTITLE_LAYOUT=YES  
HORIZONTAL_REFLOW=NO  
VERTICAL_REFLOW=NO  

## B-roll

BROLL_COUNT=2  
BR013=AUTHORITY/SELF_POSSESSION over the opening stability description  
BR037=GROUNDING/SUPPORT over the stronger nervous-system beat  
SOURCE_AUDIO_CONTINUES=YES  

The previously considered romantic BR002 moment was rejected before full render and is not referenced by the final timeline.

## Music

TRACK=Vastness — Andrew Ev  
LICENSE=Mixkit Stock Music Free License  
VOCALS=NO  
BASE_GAIN=0.065  
DUCKED_GAIN=0.025  

## Visual system

R06/R02-derived dark-zone, wine plate, blurred portrait fill, and fixed lower subtitle zone are retained. Precheck and six full-render QC stills show no clipping, orphan graphics, or broken reflow.

## Technical QC

FFPROBE=PASS  
DECODE=PASS  
VIDEO=H.264 High, 1080x1920, 30fps, yuv420p, BT.709  
AUDIO=AAC LC, 48kHz, stereo  
AUDIO_MEAN=-25.8 dB  
AUDIO_MAX=-5.7 dB  
DURATION=40.043s  
SIZE=10,063,056 bytes  

## Full Reel

- [ ] FINAL HUMAN APPROVE
- [ ] NEEDS CHANGES

READY_FOR_HUMAN_REVIEW=YES
