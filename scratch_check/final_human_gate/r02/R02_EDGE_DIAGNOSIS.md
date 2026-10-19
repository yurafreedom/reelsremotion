# R02 end-edge diagnosis

DATE=2026-08-29  
SCOPE=R02 002_context.mp4 and 003_payoff.mp4 only  
HUMAN_FINDING_AUTHORITY=YES  
ASR_RUN=NO

## Context — 002_context.mp4

FILE=`reel-input/r02-connection-without-future/public/clips/002_context.mp4`  
DOCUMENTED_SOURCE_INTERVAL=`01:18:51.520 --> 01:19:12.320`  
EXPECTED_DURATION=20.800s  
ACTUAL_VIDEO_DURATION=20.800s  
ACTUAL_AUDIO_DURATION=20.821333s  
ACTUAL_CONTAINER_DURATION=20.822s  
DURATION_DIFFERENCE_VIDEO_VS_EXPECTED=0.000s  
STALE_EXTRACTION=NO  
CURRENT_END_STATUS=REJECTED_TOO_SHORT

The extracted video duration exactly matches the interval currently documented by `source_manifest.json`. The small audio/container tail is ordinary AAC/mux duration padding and does not indicate a different source endpoint. Human listening overrides the previous edge approval: the final word `unique` is audibly truncated.

## Payoff — 003_payoff.mp4

FILE=`reel-input/r02-connection-without-future/public/clips/003_payoff.mp4`  
DOCUMENTED_SOURCE_INTERVAL=`01:20:43.900 --> 01:21:05.360`  
EXPECTED_DURATION=21.460s  
ACTUAL_VIDEO_DURATION=21.440s  
ACTUAL_AUDIO_DURATION=21.481333s  
ACTUAL_CONTAINER_DURATION=21.502s  
DURATION_DIFFERENCE_VIDEO_VS_EXPECTED=-0.020s  
SOURCE_FRAME_RATE=25fps  
STALE_EXTRACTION=NO  
CURRENT_END_STATUS=REJECTED_TOO_SHORT

The 20 ms video difference is below one 40 ms source frame at 25 fps; audio and container durations extend beyond the expected duration. This is consistent with the documented exact re-encode rather than a stale earlier endpoint. Human listening overrides the previous edge approval: the ending of `expectations` is audibly truncated.

## Decision

STALE_EXTRACTION_FOUND=NO  
CANDIDATE_A_POLICY=Fresh tiny source-window extraction ending at the currently documented endpoint.  
MANIFEST_MODIFICATION_AUTHORIZED=NO  
FINAL_BOUNDARY_SELECTION=HUMAN_LISTENING_REQUIRED

## Candidate windows and ffprobe QC

All candidates are fresh exact re-encodes from `video1219377731.mp4`, beginning five seconds before the documented endpoint. No candidate changes the manifest.

| Passage | Candidate | Source window | Video / container duration | Streams | QC |
|---|---|---|---:|---|---|
| Context | A | `01:19:07.320 --> 01:19:12.320` | 5.000 / 5.022 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
| Context | B | `01:19:07.320 --> 01:19:12.670` | 5.360 / 5.382 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
| Context | C | `01:19:07.320 --> 01:19:13.020` | 5.720 / 5.742 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
| Payoff | A | `01:21:00.360 --> 01:21:05.360` | 5.000 / 5.022 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
| Payoff | B | `01:21:00.360 --> 01:21:05.710` | 5.360 / 5.382 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
| Payoff | C | `01:21:00.360 --> 01:21:06.060` | 5.720 / 5.742 s | H.264 1280×720 25 fps; AAC 48 kHz stereo | PASS |
