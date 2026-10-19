import * as fs from "node:fs";
import * as path from "node:path";
import { checkFrame } from "./check";

const timeline = "reel-input/r02-connection-without-future/timeline.json";
const outputDir = "scratch_check/nikulina_2026/r02_width_precheck";
const checks = [
  { frame: 36, name: "01_opening_1.200.png" },
  { frame: 645, name: "02_former_failure_21.500.png" },
  { frame: 852, name: "03_former_failure_28.400.png" },
  { frame: 1905, name: "04_former_failure_63.500.png" },
];

fs.mkdirSync(outputDir, { recursive: true });
for (const check of checks) {
  const output = path.join(outputDir, check.name);
  await checkFrame(timeline, check.frame, { out: output });
  console.log(`PRECHECK frame=${check.frame} output=${output}`);
}
console.log(`R02_WIDTH_PRECHECK_COUNT=${checks.length}`);
