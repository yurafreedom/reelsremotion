#!/usr/bin/env python3
# recut_reel2_v2.py — Phase C step 1. Re-cut reel2_source.mp4 → reel2_source_v2.mp4.
# KEEP only Evgenia's opening QUESTION (chunks 1-9, src 0.0-26.60s) + Safir's whole
# speech (chunks 25-49, src 83.52-148.25s). DROP Evgenia's EN+RU monologue
# (chunks 10-24, src 26.6-83.52s). Tighten every inter-phrase pause to a ~0.12-0.20s
# breath. Stitch with SOFT joins (xfade video + acrossfade audio) that sit entirely
# in silence — no hard cuts, no speech overlap.
#
# Emits public/media/reel2_source_v2.mp4 (640x360, 25fps, stereo 48k — same shape as
# the source so the build treats it identically) and compose/recut_map_reel2.json
# (the source->v2 piecewise-linear time map for the re-align step).
import json, subprocess, sys

SRC = "public/media/reel2_source.mp4"
OUT = "public/media/reel2_source_v2.mp4"
MAP = "compose/recut_map_reel2.json"

# silencedetect -30dB d=0.25 on the source (start,end)
SIL = [(1.434,1.844),(1.950,2.628),(3.682,4.203),(4.551,4.834),(5.127,5.593),(5.680,6.288),
(7.198,7.460),(8.380,9.811),(10.064,10.852),(10.852,11.494),(12.361,12.847),(13.500,14.949),
(16.488,17.166),(18.927,19.410),(20.812,21.092),(22.419,22.722),(23.368,24.402),(25.509,25.773),
(26.450,26.732),(26.732,26.995),(28.375,28.677),(30.413,31.468),(32.585,32.956),(33.797,34.352),
(35.025,35.687),(36.148,37.489),(39.665,40.157),(41.851,42.155),(43.411,43.681),(44.230,44.784),
(45.314,46.751),(48.465,49.628),(50.051,50.432),(50.951,51.368),(51.475,52.182),(53.435,54.075),
(54.541,54.825),(54.978,55.372),(56.029,56.401),(67.486,68.401),(69.070,70.274),(72.733,73.167),
(75.104,75.613),(75.862,76.147),(81.109,81.449),(86.091,86.469),(87.384,88.377),(88.960,90.133),
(94.144,94.958),(97.190,97.663),(99.360,99.769),(102.166,103.337),(104.996,105.320),(107.273,109.768),
(112.655,113.497),(113.967,114.276),(116.420,117.409),(118.692,119.925),(121.294,121.584),
(124.380,125.316),(125.842,126.513),(127.886,129.296),(131.273,132.844),(136.394,137.862),
(141.491,142.140),(143.770,144.340),(145.931,146.557),(148.191,148.544)]

# KEEP regions in source seconds: [speech_start, region_end]
REGIONS = [(0.0, 26.60), (83.52, 148.25)]  # Q (ends after "right?", before monologue "And"@26.64) | Safir

M       = 0.13   # silence margin retained each side of an internal cut
CUTMIN  = 0.32   # only cut a silence at least this long
MINCLIP = 0.26   # never create a kept fragment shorter than this
Fi      = 0.10   # internal soft-join (dissolve) seconds — sits inside silence
Fm      = 0.18   # major Q->Safir join seconds
FPS     = 25

def build_keep():
    keep=[]
    for (Rs,Re) in REGIONS:
        cuts=[]  # (rs,re) intervals to REMOVE inside this region
        for (s,e) in SIL:
            if s>Rs+1e-6 and e<Re-1e-6 and (e-s)>=CUTMIN:
                rs,re=s+M,e-M
                if re-rs>0.02: cuts.append((rs,re))
        cuts.sort()
        # keep = region minus cuts, with MINCLIP guard (skip a cut that orphans a tiny clip)
        ivs=[]; cur=Rs
        for (rs,re) in cuts:
            if rs-cur<MINCLIP:      # left fragment too small -> skip this cut (merge)
                continue
            ivs.append((cur,rs)); cur=re
        ivs.append((cur,Re))
        # drop any sub-min trailing fragment by merging into previous
        merged=[]
        for iv in ivs:
            if iv[1]-iv[0]<MINCLIP and merged:
                merged[-1]=(merged[-1][0],iv[1])
            else:
                merged.append(list(iv))
        keep+= [tuple(x) for x in merged]
    return keep

keep=build_keep()
# fades per join: big source jump => major dissolve, else internal
joins=[]
for i in range(1,len(keep)):
    jump=keep[i][0]-keep[i-1][1]
    joins.append(Fm if jump>5.0 else Fi)

# durations + time map (source time -> v2 time), accounting for fade overlaps
durs=[round(b-a,4) for (a,b) in keep]
out_start=[]   # v2 start time of each kept interval
acc=0.0
for i,d in enumerate(durs):
    if i==0:
        out_start.append(0.0); acc=d
    else:
        f=joins[i-1]
        out_start.append(acc-f)   # this clip begins (in v2) overlapping prev by f
        acc=acc+d-f
v2_total=acc

print("KEEP intervals (source s) -> v2 placement:")
for i,(a,b) in enumerate(keep):
    f_in = joins[i-1] if i>0 else 0.0
    print(f"  [{i:2}] src {a:7.3f}-{b:7.3f}  dur {durs[i]:5.2f}  v2@ {out_start[i]:6.2f}  fade_in {f_in:.2f}")
print(f"\njoins (fade s): {joins}")
print(f"intervals: {len(keep)}   v2 interview duration ≈ {v2_total:.2f}s")
print(f"removed monologue+pauses: {148.56 - v2_total:.1f}s   (was 148.56s)")

# write time map for re-align (piecewise: src in [a,b] -> v2 in [out_start, out_start+(x-a)])
json.dump({"keep":[{"src0":a,"src1":b,"v2_0":out_start[i],"dur":durs[i]} for i,(a,b) in enumerate(keep)],
           "v2_total":round(v2_total,3),"fps":FPS,"major_join_fade":Fm,"internal_fade":Fi},
          open(MAP,"w"), indent=2)
print(f"wrote {MAP}")

if "--run" not in sys.argv:
    print("\n(dry run — pass --run to encode)"); sys.exit(0)

# ── Build ffmpeg filter_complex: trim each interval, then xfade/acrossfade ladder ──
vparts=[]; aparts=[]
for i,(a,b) in enumerate(keep):
    vparts.append(f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p,setsar=1,settb=AVTB[v{i}]")
    aparts.append(f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a{i}]")
fc=vparts+aparts
# video xfade ladder
prevv="v0"; accL=durs[0]
for i in range(1,len(keep)):
    f=joins[i-1]; off=accL-f
    out=f"vx{i}"
    fc.append(f"[{prevv}][v{i}]xfade=transition=fade:duration={f:.3f}:offset={off:.3f}[{out}]")
    prevv=out; accL=accL+durs[i]-f
# audio acrossfade ladder
preva="a0"
for i in range(1,len(keep)):
    f=joins[i-1]; out=f"ax{i}"
    fc.append(f"[{preva}][a{i}]acrossfade=d={f:.3f}:c1=tri:c2=tri[{out}]")
    preva=out
filt=";".join(fc)
cmd=["ffmpeg","-v","error","-y","-i",SRC,"-filter_complex",filt,
     "-map",f"[{prevv}]","-map",f"[{preva}]",
     "-c:v","libx264","-preset","medium","-crf","18","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","192k","-r",str(FPS),OUT]
print("\nencoding v2 ...")
r=subprocess.run(cmd,capture_output=True,text=True)
if r.returncode!=0:
    print("FFMPEG ERROR:\n",r.stderr[-3000:]); sys.exit(1)
print("wrote",OUT)
