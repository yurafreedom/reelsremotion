# Series Production Reference

REFERENCE_REELS=R06_V5,R02_V2
R06_REFERENCE_ROLE=VISUAL_EDITORIAL_PRODUCTION_REFERENCE
R02_REFERENCE_ROLE=WIDTH_AWARE_SUBTITLE_FOUNDATION
R02_FINAL_HUMAN_APPROVED=YES
R02_VISUAL_QC=PASS
R02_SUBTITLE_SAFE_WIDTH=PASS
SUBTITLE_SAFE_WIDTH=MANDATORY
WIDTH_AWARE_WRAPPING=MANDATORY
MAX_SPEECH_SUBTITLE_LINES=4
PREFER_3_OR_4_LINES_OVER_HORIZONTAL_CLIPPING=YES
FIXED_FINAL_LAYOUT_BEFORE_REVEAL=YES
HORIZONTAL_REFLOW=FORBIDDEN
VERTICAL_REFLOW=FORBIDDEN
ORPHAN_WORD_AVOIDANCE=YES
HORIZONTAL_CLIPPING=FORBIDDEN

Applies to R01, R02, R03, R04, R05, R06, R07, and R08. R06 V5 remains the approved reference and does not require rerendering.

R02 V2 is the approved measured-layout authority: semantic 2–4-line wrapping, fixed final coordinates before reveal, no horizontal/vertical reflow, no clipping, and mandatory pre-render validation. R02 does not require rerendering.
REFERENCE_OUTPUT=out/r06-what-is-actually-true-v5-music-and-subtitle-fix-candidate.mp4
R06_V5_HUMAN_APPROVED=YES
R06_FINAL_HUMAN_APPROVED=YES
ACTIVE_REFERENCE=R06_V5

## Active production contract

- `SPEECH_VIDEO_PLAYBACK_RATE=1.0`
- `SPEECH_AUDIO_PLAYBACK_RATE=1.0`
- Natural facial timing, pauses, eye movement, and reactions are editorial material; accelerated or mixed-rate speech footage is forbidden.
- Speech subtitles use cumulative-word reveal. Native Russian uses real source word timing; English-to-Russian display uses derived visual reveal inside approved phrase groups and is explicitly not Russian acoustic alignment.
- Full-phrase eager rendering for ordinary speech, layout reflow, karaoke highlighting, and word bounce are forbidden.
- `ORPHANED_ACCENT_PLATE=FORBIDDEN`: every accent plate, highlight, underline, or card ends at the same semantic boundary as its attached visible text.
- Default opening has active source audio from frame 0. Context may use an editorial hook overlay, but editorial compression must not be presented as a direct quote.
- B-roll target is 2–4 short, semantic 1.0x inserts per Reel, maximum 5. Use fewer when no honest visual exists; never invent factual relationship events or hide an important reaction.
- R06 reserves B-roll `BR039`, `BR019`, and `BR052`; other Reels should use unique ranges.
- Instrumental music is required and must be unique per Reel, vocal-free, smoothly ducked under speech, and mixed with track-specific gains.
- R06 reserves `Meridian — National Sweetheart`.
- Production is sequential, one candidate per Reel, followed by ffprobe, decode, audio/subtitle/graphic sanity checks, QC stills, and a human-review artifact before the next Reel.
- R07 remains deferred pending the human guest-audio gate and must not be modified or rendered in this batch.

SOURCE_AUTHORITY_PRIORITY=explicit current human decisions → latest human review artifacts → mutable package manifest → historical audits → canonical ASR provenance
CANONICAL_ASR_MUTABLE=NO
MASTER_SOURCE_MUTABLE=NO
