import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "/Users/yurasachenko/ReelsRemotion";
const outputDir = path.join(root, "scratch_check/nikulina_2026/r06_typography_pilot");
const display = "Avenir Next Condensed";
const sans = "Avenir Next";
const nearWhite = "#F7F4EF";
const wine = "#7A1F32";
const grey = "#B9B5B0";

const svg = (body) => Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs>
      <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#080808" stop-opacity="0.86"/>
        <stop offset="1" stop-color="#080808" stop-opacity="0.40"/>
      </linearGradient>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#080808" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#080808" stop-opacity="0.78"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="690" fill="url(#top)"/>
    <rect y="1298" width="1080" height="622" fill="url(#bottom)"/>
    ${body}
  </svg>
`);

const micro = `
  <text x="96" y="258" font-family="${sans}" font-size="27" font-weight="600"
    letter-spacing="3.2" fill="${grey}">R06  /  NIKULINA 2026</text>
`;

const variants = [
  {
    frame: "/private/tmp/r06_frame1.png",
    output: "01_hook_preset_A.png",
    foregroundY: 690,
    artwork: `${micro}
      <text x="96" y="378" font-family="${display}" font-size="112" font-weight="700"
        letter-spacing="0.5" fill="${nearWhite}">ЧТО ТЫ</text>
      <rect x="96" y="401" width="454" height="112" rx="2" fill="${wine}"/>
      <text x="112" y="494" font-family="${display}" font-size="108" font-weight="700"
        letter-spacing="0.5" fill="${nearWhite}">ЗНАЕШЬ</text>
      <text x="96" y="616" font-family="${display}" font-size="112" font-weight="700"
        letter-spacing="0.5" fill="${nearWhite}">НАВЕРНЯКА?</text>
    `,
  },
  {
    frame: "/private/tmp/r06_frame2.png",
    output: "02_hook_preset_B.png",
    foregroundY: 690,
    artwork: `${micro}
      <text x="96" y="400" font-family="${display}" font-size="102" font-weight="700"
        letter-spacing="0.2" fill="${nearWhite}">ЧТО ТЫ ЗНАЕШЬ</text>
      <rect x="96" y="439" width="156" height="6" fill="${wine}"/>
      <text x="96" y="548" font-family="${sans}" font-size="72" font-weight="600"
        letter-spacing="0.2" fill="${nearWhite}">наверняка?</text>
      <circle cx="957" cy="527" r="18" fill="${wine}"/>
    `,
  },
  {
    frame: "/private/tmp/r06_frame3.png",
    output: "03_question_punch.png",
    foregroundY: 690,
    artwork: `${micro}
      <text x="96" y="344" font-family="${display}" font-size="88" font-weight="700"
        fill="${nearWhite}">СКОЛЬКО</text>
      <rect x="96" y="371" width="846" height="94" rx="2" fill="${wine}"/>
      <text x="108" y="448" font-family="${display}" font-size="80" font-weight="700"
        fill="${nearWhite}">ДОКАЗАТЕЛЬСТВ</text>
      <text x="96" y="548" font-family="${display}" font-size="86" font-weight="700"
        fill="${nearWhite}">ТЕБЕ НУЖНО,</text>
      <text x="96" y="638" font-family="${sans}" font-size="60" font-weight="600"
        fill="${nearWhite}">чтобы поверить?</text>
    `,
  },
  {
    frame: "/private/tmp/r06_frame4.png",
    output: "04_subtitle_frame.png",
    foregroundY: 540,
    artwork: `
      <rect x="78" y="1386" width="924" height="160" rx="18" fill="#080808" fill-opacity="0.62"/>
      <rect x="78" y="1386" width="8" height="160" rx="4" fill="${wine}"/>
      <text x="540" y="1455" text-anchor="middle" font-family="${sans}" font-size="56"
        font-weight="600" fill="${nearWhite}">Что этот человек</text>
      <text x="540" y="1521" text-anchor="middle" font-family="${sans}" font-size="56"
        font-weight="600" fill="${nearWhite}">действительно сделал?</text>
    `,
  },
];

await fs.mkdir(outputDir, { recursive: true });

for (const item of variants) {
  const background = await sharp(item.frame)
    .resize(1080, 1920, { fit: "cover", position: "centre" })
    .blur(32)
    .modulate({ brightness: 0.60, saturation: 0.72 })
    .png()
    .toBuffer();
  const foreground = await sharp(item.frame)
    .resize(1080, 608, { fit: "fill" })
    .png()
    .toBuffer();

  await sharp(background)
    .composite([
      { input: foreground, left: 0, top: item.foregroundY },
      { input: svg(item.artwork), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputDir, item.output));
}

console.log(`R06 typography pilot: ${variants.length} stills written to ${outputDir}`);
