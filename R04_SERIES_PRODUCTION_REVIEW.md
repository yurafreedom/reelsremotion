# R04 Series Production Review

STATUS=CANDIDATE_READY_HUMAN_REVIEW  
OUTPUT=`out/r04-compromise-vs-consensus-series-candidate.mp4`  

## Source / join

The human-approved 1.0x practical example splice (`Мы → пытались`, retained through `и это не работало`) leads into the clean principle block. The package stores the literal canonical subtitle in `source_quote` and the approved edited result in `rendered_quote`; canonical episode ASR and master source are unchanged.

SOURCE_ORDER=PRACTICAL_EXAMPLE_THEN_PRINCIPLE  
APPROVED_SPLICE_DURATION=7.800s  

## Subtitle safe width

PRE_RENDER_SAFE_WIDTH=PASS  
LAYOUT_GROUPS=9  
MAX_LINES_USED=4  
MIN_FONT_USED=54  
PRE_RENDER_STILLS=4/4_PASS  

The R04 phrase-level DISPLAY groups preserve the approved meaning and `coniunctio`; standalone punctuation tokens were removed so every cumulative reveal state contains visible text.

## Cumulative reveal

WIDTH_AWARE_FIXED_SUBTITLE_LAYOUT=YES  
HORIZONTAL_REFLOW=NO  
VERTICAL_REFLOW=NO  

## B-roll

BROLL_COUNT=2  
BR007=RELATIONSHIP_CHEMISTRY/SHARED_ATTENTION  
BR026=TRANSITION_MASK/INTIMACY over the move from example toward principle  
SOURCE_AUDIO_CONTINUES=YES  

## Music

TRACK=Cyberpunk City — Alejandro Magaña (A. M.)  
LICENSE=Mixkit Stock Music Free License  
VOCALS=NO  
BASE_GAIN=0.055  
DUCKED_GAIN=0.022  

## Technical QC

FFPROBE=PASS  
DECODE=PASS  
VIDEO=H.264 High, 1080x1920, 30fps, yuv420p, BT.709  
AUDIO=AAC LC, 48kHz, stereo  
AUDIO_MEAN=-24.5 dB  
AUDIO_MAX=-4.6 dB  
DURATION=40.789s  
SIZE=11,914,911 bytes  
QC_STILLS=6/6_PASS  

## Full Reel

- [ ] FINAL HUMAN APPROVE
- [ ] NEEDS CHANGES

READY_FOR_HUMAN_REVIEW=YES
