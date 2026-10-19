#!/usr/bin/env python3
"""Independent targeted ASR pass for extracted editorial-review clips.

This is review evidence only. It never rewrites the episode ASR, manifests, or
subtitle scripts. Run from the repository root with `.venv-asr/bin/python`.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from faster_whisper import WhisperModel


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scratch_check/editorial_review/targeted_asr.json"


def main() -> None:
    manifests = sorted((ROOT / "reel-input").glob("r0*/source_manifest.json"))
    jobs: list[dict] = []
    for manifest_path in manifests:
        manifest = json.loads(manifest_path.read_text())
        for clip in manifest.get("clips", []):
            jobs.append(
                {
                    "reel_id": manifest["reel_id"],
                    "slug": manifest["slug"],
                    "clip_id": clip["id"],
                    "source_start": clip["source_start"],
                    "source_end": clip["source_end"],
                    "canonical_text": clip["source_quote"],
                    "file": clip["output_path"],
                }
            )

    started = time.monotonic()
    model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8",
        local_files_only=True,
    )
    results: list[dict] = []
    for index, job in enumerate(jobs, 1):
        clip_started = time.monotonic()
        segments, info = model.transcribe(
            str(ROOT / job["file"]),
            language=None,
            task="transcribe",
            multilingual=True,
            word_timestamps=True,
            vad_filter=False,
            beam_size=5,
            condition_on_previous_text=False,
        )
        segment_rows = []
        for segment in segments:
            segment_rows.append(
                {
                    "start": round(segment.start, 3),
                    "end": round(segment.end, 3),
                    "text": segment.text.strip(),
                    "words": [
                        {
                            "word": word.word.strip(),
                            "start": round(word.start, 3),
                            "end": round(word.end, 3),
                            "probability": round(word.probability, 4),
                        }
                        for word in (segment.words or [])
                    ],
                }
            )
        result = {
            **job,
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 4),
            "review_text": " ".join(row["text"] for row in segment_rows),
            "segments": segment_rows,
            "elapsed_seconds": round(time.monotonic() - clip_started, 2),
        }
        results.append(result)
        print(
            f"[{index:02d}/{len(jobs)}] {job['reel_id']} {job['clip_id']} "
            f"lang={info.language} {result['elapsed_seconds']:.2f}s",
            flush=True,
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "purpose": "independent short-clip ASR review; never canonical provenance",
                "model": "small",
                "device": "cpu",
                "compute_type": "int8",
                "faster_whisper_version": "1.2.1",
                "elapsed_seconds": round(time.monotonic() - started, 2),
                "clips": results,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {OUT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
