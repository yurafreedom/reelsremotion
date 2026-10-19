import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const WIDTH_AWARE_LAYOUT_SYSTEM = "WIDTH_AWARE_FIXED_SUBTITLE_LAYOUT";
const HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), "measure-subtitle-text.mjs");
const DEFAULT_INTERNAL_MARGIN = 24;
const DEFAULT_MIN_FONT_SIZE = 44;
const MAX_LINES = 4;

const visibleTokens = (text) => String(text ?? "").trim().split(/\s+/u).filter(Boolean);
const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const measure = (items) => {
  const result = spawnSync(process.execPath, [HELPER], {
    input: JSON.stringify({ items }),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? path.join(os.tmpdir(), "reels-font-cache"),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`subtitle text measurement failed: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
};

const endingPenalty = (tokens, end, isFinal) => {
  const token = tokens[end - 1]?.toLocaleLowerCase("ru") ?? "";
  const next = tokens[end]?.toLocaleLowerCase("ru") ?? "";
  const bare = token.replace(/[^\p{L}\p{N}]+/gu, "");
  const weakEnd = new Set(["и", "а", "но", "или", "что", "чтобы", "когда", "если", "пока", "потому", "с", "в", "во", "на", "к", "у", "без", "для", "от", "до", "по"]);
  const naturalNext = new Set(["и", "а", "но", "или", "что", "чтобы", "когда", "если", "пока", "потому", "настолько"]);
  let score = 0;
  if (!isFinal && weakEnd.has(bare)) score += 520;
  if (!isFinal && /[,;:—–-]$/u.test(token)) score -= 110;
  if (!isFinal && naturalNext.has(next.replace(/[^\p{L}\p{N}]+/gu, ""))) score -= 55;
  return score;
};

const chooseBreaks = ({ tokens, tokenWidths, spaceWidth, safeWidth, lineCount }) => {
  const prefix = [0];
  for (const width of tokenWidths) prefix.push(prefix.at(-1) + width);
  const widthOf = (start, end) => prefix[end] - prefix[start] + Math.max(0, end - start - 1) * spaceWidth;
  const total = widthOf(0, tokens.length);
  const target = Math.min(safeWidth, total / lineCount);
  let best = null;

  const walk = (start, lineIndex, lines) => {
    const remainingLines = lineCount - lineIndex;
    if (remainingLines === 1) {
      if (start >= tokens.length) return;
      const width = widthOf(start, tokens.length);
      if (width > safeWidth) return;
      const candidate = [...lines, { start, end: tokens.length, width }];
      let score = lineCount === 4 ? 80 : 0;
      for (const [index, line] of candidate.entries()) {
        const count = line.end - line.start;
        score += ((line.width - target) / safeWidth) ** 2 * 1800;
        if (count === 1) score += index === candidate.length - 1 ? 1300 : 800;
        score += endingPenalty(tokens, line.end, index === candidate.length - 1);
      }
      if (!best || score < best.score) best = { score, lines: candidate };
      return;
    }
    const minEnd = start + 1;
    const maxEnd = tokens.length - (remainingLines - 1);
    for (let end = minEnd; end <= maxEnd; end += 1) {
      const width = widthOf(start, end);
      if (width > safeWidth) break;
      walk(end, lineIndex + 1, [...lines, { start, end, width }]);
    }
  };
  walk(0, 0, []);
  return best;
};

const minimumPreferredLines = (tokenCount, fullWidth, safeWidth) => {
  if (tokenCount <= 7 && fullWidth <= safeWidth * 0.72) return 1;
  if (tokenCount <= 16) return 2;
  return 3;
};

const bestLineLayout = ({ tokens, tokenWidths, spaceWidth, safeWidth }) => {
  const fullWidth = tokenWidths.reduce((sum, width) => sum + width, 0) + Math.max(0, tokenWidths.length - 1) * spaceWidth;
  const minimumLines = minimumPreferredLines(tokens.length, fullWidth, safeWidth);
  for (let lineCount = minimumLines; lineCount <= MAX_LINES; lineCount += 1) {
    const result = chooseBreaks({ tokens, tokenWidths, spaceWidth, safeWidth, lineCount });
    if (result) return result;
  }
  return null;
};

// A translation authority group can be much longer than one readable subtitle
// card (R02 q-g1 is 37 tokens). Pagination is therefore a layout concern: token
// reveal frames remain unchanged, while completed pages clear at the next page's
// first reveal. Every page still freezes its complete final 1–4-line geometry.
const paginateAtSize = ({ tokens, tokenWidths, spaceWidth, safeWidth }) => {
  const memo = new Map();
  const solve = (start) => {
    if (start === tokens.length) return { score: 0, pages: [] };
    if (memo.has(start)) return memo.get(start);
    let best = null;
    for (let end = start + 1; end <= tokens.length; end += 1) {
      const pageTokens = tokens.slice(start, end);
      const pageWidths = tokenWidths.slice(start, end);
      const layout = bestLineLayout({ tokens: pageTokens, tokenWidths: pageWidths, spaceWidth, safeWidth });
      if (!layout) continue;
      const rest = solve(end);
      if (!rest) continue;
      const count = end - start;
      let pagePenalty = 10_000 + layout.score;
      if (count <= 2 && end !== tokens.length) pagePenalty += 4000;
      if (count === 1) pagePenalty += 8000;
      pagePenalty += endingPenalty(tokens, end, end === tokens.length) * 3;
      const candidate = {
        score: pagePenalty + rest.score,
        pages: [{ start, end, lines: layout.lines.map((line) => ({
          ...line,
          start: line.start + start,
          end: line.end + start,
        })) }, ...rest.pages],
      };
      if (!best || candidate.score < best.score) best = candidate;
    }
    memo.set(start, best);
    return best;
  };
  return solve(0);
};

export const applyWidthAwareFixedSubtitleLayout = ({ captions, styleTokens, frameWidth = 1080, frameHeight = 1920 }) => {
  const safe = styleTokens.safe_area ?? { left: 96, right: 96, top: 220, bottom: 300 };
  const policy = styleTokens.subtitle_layout ?? {};
  const internalMargin = Number(policy.internal_margin_px ?? DEFAULT_INTERNAL_MARGIN);
  const safeLeft = Number(safe.left) + internalMargin;
  const safeRight = frameWidth - Number(safe.right) - internalMargin;
  const safeTop = Number(safe.top);
  const safeBottom = frameHeight - Number(safe.bottom);
  const safeWidth = safeRight - safeLeft;
  const minFontSize = Number(policy.minimum_font_size_px ?? DEFAULT_MIN_FONT_SIZE);

  const groups = new Map();
  captions.forEach((caption, index) => {
    const role = caption.role ?? "speech";
    if (role !== "speech") return;
    if (!caption.phrase_id) throw new Error(`SUBTITLE_LAYOUT_UNFITTABLE: speech caption ${index} has no phrase_id`);
    const key = `${caption.sequence_id}:${caption.phrase_id}`;
    const group = groups.get(key) ?? { key, entries: [] };
    group.entries.push({ caption, index });
    groups.set(key, group);
  });

  const measurementItems = [];
  for (const group of groups.values()) {
    const entries = group.entries;
    group.tokens = entries.flatMap(({ caption }) => visibleTokens(caption.text));
    group.font = entries[0].caption.font ?? styleTokens.typography.subtitle.font;
    group.weight = Number(entries[0].caption.weight ?? styleTokens.typography.subtitle.weight);
    group.case = entries[0].caption.case ?? styleTokens.typography.subtitle.case ?? "none";
    group.baseSize = median(entries.map(({ caption }) => Number(caption.size ?? styleTokens.typography.subtitle.size)));
    group.x = median(entries.map(({ caption }) => Number(caption.x ?? styleTokens.typography.subtitle.x ?? 0)));
    const ys = entries.map(({ caption }) => Number(caption.y ?? styleTokens.typography.subtitle.y ?? 570));
    group.centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const gaps = ys.slice(1).map((y, index) => Math.abs(y - ys[index])).filter((gap) => gap > 0);
    group.authoredGap = gaps.length ? median(gaps) : null;
    group.tokens.forEach((text, index) => measurementItems.push({
      id: `${group.key}:token:${index}`,
      text,
      font: group.font,
      size: group.baseSize,
      weight: group.weight,
      case: group.case,
    }));
    measurementItems.push(
      { id: `${group.key}:space-pair`, text: "н н", font: group.font, size: group.baseSize, weight: group.weight, case: group.case },
      { id: `${group.key}:space-single`, text: "н", font: group.font, size: group.baseSize, weight: group.weight, case: group.case },
    );
  }

  const tokenMeasurements = measure(measurementItems);
  for (const group of groups.values()) {
    const baseTokenWidths = group.tokens.map((_, index) => Number(tokenMeasurements[`${group.key}:token:${index}`].width) + 1.5);
    const baseSpace = Math.max(4, Number(tokenMeasurements[`${group.key}:space-pair`].width) - 2 * Number(tokenMeasurements[`${group.key}:space-single`].width));
    let chosen = null;
    for (let size = group.baseSize; size >= minFontSize && !chosen; size -= 1) {
      const scale = size / group.baseSize;
      const tokenWidths = baseTokenWidths.map((width) => width * scale);
      const spaceWidth = baseSpace * scale;
      const pagination = paginateAtSize({ tokens: group.tokens, tokenWidths, spaceWidth, safeWidth });
      if (pagination) chosen = { ...pagination, size, tokenWidths, spaceWidth };
    }
    if (!chosen) {
      throw new Error(`SUBTITLE_LAYOUT_UNFITTABLE: ${group.key} cannot fit at >=${minFontSize}px and <=${MAX_LINES} lines`);
    }
    group.chosen = chosen;
  }

  const finalLineItems = [];
  for (const group of groups.values()) {
    group.chosen.pages.forEach((page, pageIndex) => {
      page.lines.forEach((line, lineIndex) => finalLineItems.push({
        id: `${group.key}:page:${pageIndex}:line:${lineIndex}`,
        text: group.tokens.slice(line.start, line.end).join(" "),
        font: group.font,
        size: group.chosen.size,
        weight: group.weight,
        case: group.case,
      }));
    });
  }
  const finalMeasurements = measure(finalLineItems);
  const reportGroups = [];

  for (const group of groups.values()) {
    const fontSize = group.chosen.size;
    const lineBoxHeight = fontSize * Number(styleTokens.typography.subtitle.line_height ?? 1.14);
    group.outputPages = group.chosen.pages.map((page, pageIndex) => {
      const lineCount = page.lines.length;
      const lineGap = Math.max(fontSize * Number(styleTokens.typography.subtitle.line_height ?? 1.14), group.authoredGap ?? 0);
      const halfBlock = ((lineCount - 1) * lineGap + lineBoxHeight) / 2;
      const centerYAbsolute = Math.max(safeTop + halfBlock, Math.min(safeBottom - halfBlock, frameHeight / 2 + group.centerY));
      const lines = page.lines.map((line, lineIndex) => {
        const text = group.tokens.slice(line.start, line.end).join(" ");
        const measured = finalMeasurements[`${group.key}:page:${pageIndex}:line:${lineIndex}`];
        const width = Number(measured.width) + 4;
        const centerX = frameWidth / 2 + group.x;
        const left = centerX - width / 2;
        const right = centerX + width / 2;
        const centerY = centerYAbsolute + (lineIndex - (lineCount - 1) / 2) * lineGap;
        const top = centerY - lineBoxHeight / 2;
        const bottom = centerY + lineBoxHeight / 2;
        if (left < safeLeft || right > safeRight || top < safeTop || bottom > safeBottom) {
          throw new Error(
            `SUBTITLE_LAYOUT_UNFITTABLE: ${group.key}:page:${pageIndex + 1} line ${lineIndex + 1}/${lineCount} ` +
            `bounds=${left.toFixed(1)},${top.toFixed(1)}..${right.toFixed(1)},${bottom.toFixed(1)} ` +
            `safe=${safeLeft},${safeTop}..${safeRight},${safeBottom}`
          );
        }
        const estimatedWidth = line.width || 1;
        const scale = width / estimatedWidth;
        let cursor = left;
        const wordFinalPositions = [];
        for (let tokenIndex = line.start; tokenIndex < line.end; tokenIndex += 1) {
          const tokenWidth = group.chosen.tokenWidths[tokenIndex] * scale;
          wordFinalPositions.push({
            text: group.tokens[tokenIndex],
            x: Number((cursor + tokenWidth / 2).toFixed(2)),
            y: Number(centerY.toFixed(2)),
            left: Number(cursor.toFixed(2)),
            right: Number((cursor + tokenWidth).toFixed(2)),
          });
          cursor += tokenWidth + group.chosen.spaceWidth * scale;
        }
        return {
          text,
          lineIndex,
          width: Number(width.toFixed(2)),
          x: group.x,
          y: Number((centerY - frameHeight / 2).toFixed(2)),
          bounds: {
            left: Number(left.toFixed(2)), right: Number(right.toFixed(2)),
            top: Number(top.toFixed(2)), bottom: Number(bottom.toFixed(2)),
          },
          wordFinalPositions,
        };
      });
      const outputPage = { start: page.start, end: page.end, lines };
      reportGroups.push({
        id: `${group.key}:page:${pageIndex + 1}`,
        authorityGroupId: group.key,
        pageIndex,
        pageCount: group.chosen.pages.length,
        tokenStart: page.start,
        tokenEnd: page.end,
        displayText: group.tokens.slice(page.start, page.end).join(" "),
        lineCount,
        font: group.font,
        fontSize,
        weight: group.weight,
        safeWidth,
        safeBounds: { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom },
        fixedFinalLayout: true,
        horizontalReflow: false,
        verticalReflow: false,
        lines,
      });
      return outputPage;
    });
  }

  const firstIndexByGroup = new Map([...groups.values()].map((group) => [group.key, group.entries[0].index]));
  const outputCaptions = [];
  captions.forEach((caption, index) => {
    const role = caption.role ?? "speech";
    if (role !== "speech") {
      outputCaptions.push(caption);
      return;
    }
    const key = `${caption.sequence_id}:${caption.phrase_id}`;
    if (firstIndexByGroup.get(key) !== index) return;
    const group = groups.get(key);
    const base = group.entries[0].caption;
    group.outputPages.forEach((page, pageIndex) => {
      page.lines.forEach((line) => outputCaptions.push({
        ...base,
        text: line.text,
        size: group.chosen.size,
        x: line.x,
        y: line.y,
        layout_system: WIDTH_AWARE_LAYOUT_SYSTEM,
        layout_group_id: `${key}:page:${pageIndex + 1}`,
        layout_page_index: pageIndex,
        layout_page_count: group.outputPages.length,
        layout_page_token_start: page.start,
        layout_page_token_end: page.end,
        layout_line_index: line.lineIndex,
        layout_line_count: page.lines.length,
        layout_bounds: line.bounds,
        layout_safe_bounds: { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom },
        layout_fixed_final: true,
        layout_horizontal_reflow: false,
        layout_vertical_reflow: false,
        layout_word_positions: line.wordFinalPositions,
      }));
    });
  });

  return {
    captions: outputCaptions,
    report: {
      system: WIDTH_AWARE_LAYOUT_SYSTEM,
      maxLines: MAX_LINES,
      minimumFontSize: minFontSize,
      internalMargin,
      safeBounds: { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom },
      groups: reportGroups,
    },
  };
};
