// Font resolution. JSON refers to fonts by abstract keys ("condensedHeavy");
// FONT_MAP maps each key to a real CSS font-family that ships Cyrillic glyphs.
//
// VARIABLE fonts (CONTRACT §5): we load Inter and Oswald via Google's css2 API
// with a wght AXIS RANGE (`font-weight: 100 900`), not discrete instances. A
// single variable `@font-face` per unicode-range means a `weight` keyframe
// interpolates CONTINUOUSLY (e.g. 543) instead of snapping to 100-unit stops.
// The css2 response also carries the Cyrillic subsets, so Russian text renders.
//
// We render the SAME composition in the editor's <Player> and the headless
// render; both fetch gstatic over the network (as the previous discrete loader
// already did), and `delayRender` blocks the render until the variable files are
// ready, so the mp4 matches the preview.
//
// Non-variable fallback (documented): if the css2 fetch fails (offline render),
// the families fall through to the system `sans-serif` stack — text still renders
// but `weight` keyframes lose smoothness. To pin an offline variable font, drop a
// woff2 in public/ and replace the `cssUrl` below with a local @font-face.

type VariableFont = {
  /** CSS family name Google declares (used directly in FONT_MAP). */
  family: string;
  /** Google css2 stylesheet URL with a wght axis range. */
  cssUrl: string;
  /** Extreme weights to force-load (with a Cyrillic+Latin probe) before render. */
  probeWeights: number[];
  /** Probe the ITALIC face too (separate woff2 — e.g. Playfair Display italic).
   *  Without this the italic glyphs aren't downloaded and `font-style: italic`
   *  would synthesize a slant on the roman face instead of using real italics. */
  probeItalic?: boolean;
};

const VARIABLE_FONTS: VariableFont[] = [
  {
    family: "Inter",
    cssUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
    probeWeights: [100, 900],
  },
  {
    family: "Oswald",
    cssUrl: "https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap",
    probeWeights: [200, 700],
  },
  {
    family: "Unbounded",
    cssUrl: "https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&display=swap",
    probeWeights: [200, 900],
  },
  {
    family: "Onest",
    cssUrl: "https://fonts.googleapis.com/css2?family=Onest:wght@100..900&display=swap",
    probeWeights: [100, 900],
  },
  {
    // Playfair Display loaded with the ital AXIS so the real italic face ships
    // (CONTRACT §5). `playfairItalic` resolves to font-style: italic (see
    // FONT_STYLE_MAP) which then binds to this italic face, not a faux slant.
    family: "Playfair Display",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
    probeWeights: [400, 900],
    probeItalic: true,
  },
];

/** Abstract JSON font key -> real CSS font-family stack. */
export const FONT_MAP: Record<string, string> = {
  condensedHeavy: "'Oswald', sans-serif",
  cleanSans: "'Inter', sans-serif",
  unbounded: "'Unbounded', sans-serif",
  onest: "'Onest', sans-serif",
  playfairItalic: "'Playfair Display', serif",
  // Nikulina 2026 canonical pair: local macOS faces with Cyrillic coverage.
  // These keys do not require a network font download.
  nikulinaCondensed:
    "'Avenir Next Condensed', 'DIN Condensed', 'Arial Narrow', sans-serif",
  nikulinaSans: "'Avenir Next', 'Helvetica Neue', Arial, sans-serif",
};

/** Font keys whose face is ITALIC (a distinct cut, not a synthesized slant).
 *  resolveFontStyle() drives the CSS `font-style` so the right woff2 binds. */
export const FONT_STYLE_MAP: Record<string, "normal" | "italic"> = {
  playfairItalic: "italic",
};

const FALLBACK = "'Inter', sans-serif";

/** Resolve a JSON font key to a CSS font-family stack. */
export const resolveFont = (key: string): string => FONT_MAP[key] ?? FALLBACK;

/** Resolve a JSON font key to its CSS `font-style` (italic for italic-cut keys). */
export const resolveFontStyle = (key: string): "normal" | "italic" =>
  FONT_STYLE_MAP[key] ?? "normal";

// Fetch the variable css2 stylesheet, inject it, and force-load the extreme
// weights (so the variable woff2 + Cyrillic subset are actually downloaded).
const loadVariableFont = async (def: VariableFont): Promise<void> => {
  if (typeof document === "undefined") return; // no-DOM (SSR/Node) — nothing to do
  const res = await fetch(def.cssUrl);
  const cssText = await res.text();
  const style = document.createElement("style");
  style.setAttribute("data-reels-font", def.family);
  style.textContent = cssText;
  document.head.appendChild(style);

  // Probe Cyrillic + Latin + digits at the axis extremes so the whole weight
  // range (and the Cyrillic subset face) is fetched before we draw a frame.
  const probe = "Аа Бб Reels 0";
  const styles = def.probeItalic ? ["normal", "italic"] : ["normal"];
  await Promise.all(
    def.probeWeights.flatMap((w) =>
      styles.map((style) =>
        (document as Document).fonts.load(`${style} ${w} 64px '${def.family}'`, probe)
      )
    )
  );
};

let remoteReadyPromise: Promise<unknown> | null = null;

const loadLocalNikulinaFonts = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const probe = "Аа Бб Nikulina 2026";
  await Promise.all([
    document.fonts.load("700 64px 'Avenir Next Condensed'", probe),
    document.fonts.load("600 64px 'Avenir Next'", probe),
  ]);
  await document.fonts.ready;
};

/** Await the fonts required by a render. R06 sets localOnly=true, which proves
 *  the locked system fonts without fetching any Google/font CDN asset. Legacy
 *  timelines retain the previous remote-variable-font path on demand. */
export const waitForReelsFonts = (localOnly = false): Promise<unknown> => {
  if (localOnly) return loadLocalNikulinaFonts();
  if (!remoteReadyPromise) {
    remoteReadyPromise = Promise.all(VARIABLE_FONTS.map(loadVariableFont))
      .then(async () => {
        if (typeof document !== "undefined") await document.fonts.ready;
      })
      .catch((e) => {
        console.warn("[reels] variable font load failed; using fallback", e);
      });
  }
  return remoteReadyPromise;
};
