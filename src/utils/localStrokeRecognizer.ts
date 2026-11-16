import { Stroke, StrokePoint } from '../types';

export interface RecognizedLocalEquation {
  latex: string;
  plain: string;
  title?: string;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

interface StrokeItem {
  stroke: Stroke;
  box: BBox;
  pts: StrokePoint[];
}

interface Glyph {
  strokes: StrokeItem[];
  box: BBox;
  text: string;
  latex: string;
}

function getPointsBBox(pts: StrokePoint[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function mergeBBoxes(boxes: BBox[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function dist(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(pts: StrokePoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1], pts[i]);
  }
  return total;
}

function isHorizontalBar(item: StrokeItem): boolean {
  const { box, pts } = item;
  if (pts.length < 2) return false;
  const straight = dist(pts[0], pts[pts.length - 1]);
  const len = pathLength(pts);
  const straightness = len > 0 ? straight / len : 1;
  return box.w >= 14 && box.h / box.w <= 0.35 && straightness >= 0.85;
}

function isVerticalBar(item: StrokeItem): boolean {
  const { box, pts } = item;
  if (pts.length < 2) return false;
  const straight = dist(pts[0], pts[pts.length - 1]);
  const len = pathLength(pts);
  const straightness = len > 0 ? straight / len : 1;
  return box.h >= 12 && box.w / box.h <= 0.42 && straightness >= 0.8;
}

function boxesIntersect(a: BBox, b: BBox, pad = 2): boolean {
  return (
    a.minX - pad <= b.maxX &&
    a.maxX + pad >= b.minX &&
    a.minY - pad <= b.maxY &&
    a.maxY + pad >= b.minY
  );
}

function horizontalOverlapRatio(a: BBox, b: BBox): number {
  const overlap = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const minW = Math.max(1, Math.min(a.w, b.w));
  return overlap / minW;
}

function classifySingleStroke(item: StrokeItem): string {
  const { box, pts } = item;
  if (pts.length <= 1) return '.';

  const start = pts[0];
  const end = pts[pts.length - 1];
  const diag = Math.hypot(box.w, box.h);
  const len = pathLength(pts);
  const direct = dist(start, end);
  const straightness = len > 0 ? direct / len : 1;
  const closedRatio = diag > 0 ? direct / diag : 0;

  if (isHorizontalBar(item)) return '-';

  // Straight lines: slash, vertical 1
  if (straightness > 0.9) {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleDeg >= 70) return '1';
    if (angleDeg >= 25) {
      // Top-right to bottom-left vs bottom-left to top-right
      if ((end.x - start.x) * (end.y - start.y) < 0) return '/';
      return '1';
    }
    return '-';
  }

  // Closed loop shapes: 0, O, 6, 8, 9
  if (closedRatio < 0.42 && box.w >= 10 && box.h >= 12) {
    // Check if stroke crosses itself (figure-8) or is simple oval
    const aspect = box.w / box.h;
    if (aspect >= 0.45 && aspect <= 1.35) {
      // Check how much area / convexity vs V/R
      // In R single-stroke, start is bottom-left and end is bottom-right with a high horizontal spread at bottom
      const startBottomLeft =
        start.x < box.minX + box.w * 0.35 && start.y > box.minY + box.h * 0.65;
      const endBottomRight =
        end.x > box.minX + box.w * 0.65 && end.y > box.minY + box.h * 0.65;
      if (startBottomLeft && endBottomRight) return 'R';
      return '0';
    }
  }

  // R drawn in one continuous stroke (up stem, top loop, leg down-right)
  const startBottomLeft =
    start.x < box.minX + box.w * 0.35 && start.y > box.minY + box.h * 0.65;
  const endBottomRight =
    end.x > box.minX + box.w * 0.65 && end.y > box.minY + box.h * 0.65;
  const visitsTopLeft = pts.some(
    (p) => p.x < box.minX + box.w * 0.35 && p.y < box.minY + box.h * 0.25
  );
  const visitsTopRight = pts.some(
    (p) => p.x > box.minX + box.w * 0.65 && p.y < box.minY + box.h * 0.35
  );
  if (startBottomLeft && endBottomRight && visitsTopLeft && visitsTopRight) {
    return 'R';
  }

  // V shape: starts top-left, lowest point near middle-x bottom, ends top-right
  const minYPoint = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]);
  const startTopLeft =
    start.x <= box.minX + box.w * 0.35 && start.y <= box.minY + box.h * 0.35;
  const endTopRight =
    end.x >= box.minX + box.w * 0.65 && end.y <= box.minY + box.h * 0.35;
  if (
    startTopLeft &&
    endTopRight &&
    minYPoint.y >= box.minY + box.h * 0.72 &&
    minYPoint.x >= box.minX + box.w * 0.2 &&
    minYPoint.x <= box.minX + box.w * 0.8
  ) {
    return 'V';
  }

  // Hooked 1: short upward-right entry then long vertical drop
  if (
    box.w / box.h <= 0.55 &&
    end.y >= box.minY + box.h * 0.75 &&
    start.y <= box.minY + box.h * 0.45 &&
    end.x >= start.x
  ) {
    return '1';
  }

  // 2 shape: starts upper-left/mid, reaches top-right, ends bottom-right
  const reachesBottomLeft = pts.some(
    (p) => p.x <= box.minX + box.w * 0.35 && p.y >= box.minY + box.h * 0.75
  );
  if (
    start.y <= box.minY + box.h * 0.45 &&
    end.x >= box.minX + box.w * 0.65 &&
    end.y >= box.minY + box.h * 0.75 &&
    reachesBottomLeft
  ) {
    return '2';
  }

  // 3 shape: starts top-left, ends bottom-left, visits middle-right twice
  if (
    start.x <= box.minX + box.w * 0.45 &&
    start.y <= box.minY + box.h * 0.35 &&
    end.x <= box.minX + box.w * 0.45 &&
    end.y >= box.minY + box.h * 0.65
  ) {
    return '3';
  }

  // Parentheses ( and )
  if (box.w / box.h <= 0.55 && start.y < box.minY + box.h * 0.25 && end.y > box.minY + box.h * 0.75) {
    const mid = pts[Math.floor(pts.length / 2)];
    if (mid.x < (start.x + end.x) / 2 - box.w * 0.2) return '(';
    if (mid.x > (start.x + end.x) / 2 + box.w * 0.2) return ')';
  }

  // 7 shape: starts top-left, visits top-right, ends bottom-left
  if (
    start.x <= box.minX + box.w * 0.35 &&
    start.y <= box.minY + box.h * 0.3 &&
    visitsTopRight &&
    end.y >= box.minY + box.h * 0.75 &&
    end.x <= box.minX + box.w * 0.55
  ) {
    return '7';
  }

  // 5 shape: starts top-right, goes left, down, curves right to bottom-left/mid
  if (
    start.x >= box.minX + box.w * 0.55 &&
    start.y <= box.minY + box.h * 0.3 &&
    end.y >= box.minY + box.h * 0.75
  ) {
    return '5';
  }

  // Fallback by aspect ratio
  if (box.h > box.w * 2) return '1';
  if (box.w > box.h * 2) return '-';
  return 'x';
}

function classifyMultiStroke(group: StrokeItem[]): string {
  if (group.length === 1) {
    return classifySingleStroke(group[0]);
  }

  if (group.length === 2) {
    const [a, b] = group;
    // = sign: two horizontal bars stacked vertically
    if (isHorizontalBar(a) && isHorizontalBar(b)) {
      return '=';
    }
    // + sign: one horizontal + one vertical crossing
    if (
      (isHorizontalBar(a) && isVerticalBar(b)) ||
      (isHorizontalBar(b) && isVerticalBar(a))
    ) {
      return '+';
    }
    // x: two intersecting diagonals
    const sA = classifySingleStroke(a);
    const sB = classifySingleStroke(b);
    if ((sA === '/' && sB !== '/') || (sB === '/' && sA !== '/')) {
      return 'x';
    }
    // R written as stem + loop/leg
    if (isVerticalBar(a) || isVerticalBar(b)) {
      return 'R';
    }
  }

  if (group.length === 3) {
    const horiz = group.filter(isHorizontalBar).length;
    const vert = group.filter(isVerticalBar).length;
    if (horiz >= 2 && vert >= 1) return 'I';
  }

  return classifySingleStroke(group[0]);
}

function groupStrokesIntoGlyphs(items: StrokeItem[]): Glyph[] {
  const used = new Array<boolean>(items.length).fill(false);
  const groups: StrokeItem[][] = [];

  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const group = [items[i]];

    let changed = true;
    while (changed) {
      changed = false;
      const gBox = mergeBBoxes(group.map((g) => g.box));

      for (let j = 0; j < items.length; j++) {
        if (used[j]) continue;
        const cand = items[j];

        // 1. Intersecting strokes (+, x, multi-stroke letters)
        if (boxesIntersect(gBox, cand.box, 3)) {
          used[j] = true;
          group.push(cand);
          changed = true;
          continue;
        }

        // 2. Stacked horizontal bars forming '='
        if (
          group.length === 1 &&
          isHorizontalBar(group[0]) &&
          isHorizontalBar(cand) &&
          horizontalOverlapRatio(group[0].box, cand.box) >= 0.45
        ) {
          const dy = Math.abs(group[0].box.cy - cand.box.cy);
          const avgW = (group[0].box.w + cand.box.w) / 2;
          if (dy <= Math.max(28, avgW * 0.95)) {
            used[j] = true;
            group.push(cand);
            changed = true;
            continue;
          }
        }
      }
    }

    const box = mergeBBoxes(group.map((g) => g.box));
    const sym = classifyMultiStroke(group);
    groups.push(group);
    void box;
    void sym;
  }

  return groups
    .map((group) => {
      const box = mergeBBoxes(group.map((g) => g.box));
      const sym = classifyMultiStroke(group);
      return {
        strokes: group,
        box,
        text: sym,
        latex: sym,
      };
    })
    .sort((a, b) => a.box.minX - b.box.minX);
}

function renderSequence(items: StrokeItem[]): { plain: string; latex: string } {
  if (items.length === 0) return { plain: '', latex: '' };

  // Find candidate fraction bars: wide horizontal bars that have items strictly above AND strictly below
  const sortedByWidth = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => isHorizontalBar(item) && item.box.w >= 26)
    .sort((a, b) => b.item.box.w - a.item.box.w);

  for (const { item: bar } of sortedByWidth) {
    const padX = Math.max(8, bar.box.w * 0.12);
    const above = items.filter(
      (other) =>
        other !== bar &&
        other.box.cy < bar.box.minY &&
        other.box.cx >= bar.box.minX - padX &&
        other.box.cx <= bar.box.maxX + padX
    );
    const below = items.filter(
      (other) =>
        other !== bar &&
        other.box.cy > bar.box.maxY &&
        other.box.cx >= bar.box.minX - padX &&
        other.box.cx <= bar.box.maxX + padX
    );

    if (above.length > 0 && below.length > 0) {
      const consumed = new Set<StrokeItem>([bar, ...above, ...below]);
      const leftItems = items.filter(
        (other) => !consumed.has(other) && other.box.cx < bar.box.minX
      );
      const rightItems = items.filter(
        (other) => !consumed.has(other) && other.box.cx > bar.box.maxX
      );

      const numRes = renderSequence(above);
      const denRes = renderSequence(below);
      const leftRes = renderSequence(leftItems);
      const rightRes = renderSequence(rightItems);

      const wrapIfComplex = (s: string) =>
        /[+\-*/\s]/.test(s) ? `(${s})` : s;
      const fracPlain = `${wrapIfComplex(numRes.plain)}/${wrapIfComplex(denRes.plain)}`;
      const fracLatex = `\\frac{${numRes.latex}}{${denRes.latex}}`;

      const joinPlain = [leftRes.plain, fracPlain, rightRes.plain]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const joinLatex = [leftRes.latex, fracLatex, rightRes.latex]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return { plain: joinPlain, latex: joinLatex };
    }
  }

  // Linear sequence with subscript/superscript detection
  const glyphs = groupStrokesIntoGlyphs(items);
  if (glyphs.length === 0) return { plain: '', latex: '' };

  let plainOut = '';
  let latexOut = '';

  for (let i = 0; i < glyphs.length; i++) {
    const curr = glyphs[i];
    const prev = i > 0 ? glyphs[i - 1] : null;

    const isLetter = /^[A-Za-z]$/.test(prev?.text ?? '');
    const isDigitOrVar = /^[0-9A-Za-z]$/.test(curr.text);
    const isSmallerOrLower =
      prev &&
      isLetter &&
      isDigitOrVar &&
      curr.box.minX >= prev.box.maxX - 4 &&
      curr.box.minX - prev.box.maxX <= Math.max(24, prev.box.h * 0.7);

    if (prev && isSmallerOrLower && curr.box.cy > prev.box.cy + prev.box.h * 0.25 && curr.box.h < prev.box.h * 0.85) {
      // Subscript (e.g. V_1, R_1)
      plainOut += curr.text;
      latexOut += `_${curr.text}`;
      continue;
    }

    if (
      prev &&
      /^[0-9A-Za-z)]$/.test(prev.text) &&
      isDigitOrVar &&
      curr.box.cy < prev.box.cy - prev.box.h * 0.25 &&
      curr.box.h < prev.box.h * 0.85 &&
      curr.box.minX - prev.box.maxX <= Math.max(24, prev.box.h * 0.7)
    ) {
      // Superscript (e.g. x^2)
      plainOut += `^${curr.text}`;
      latexOut += `^{${curr.text}}`;
      continue;
    }

    const op = /^[+\-=]$/.test(curr.text);
    const prevOp = prev && /^[+\-=]$/.test(prev.text);
    if (plainOut && (op || prevOp)) {
      plainOut += ` ${curr.text}`;
      latexOut += ` ${curr.latex}`;
    } else {
      plainOut += curr.text;
      latexOut += curr.latex;
    }
  }

  return {
    plain: plainOut.replace(/\s+/g, ' ').trim(),
    latex: latexOut.replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Pure in-browser stroke-to-math recognizer so handwriting conversion
 * continues to function locally/offline without a backend API.
 */
export function recognizeStrokesLocally(
  strokes: Stroke[]
): RecognizedLocalEquation[] {
  const penItems: StrokeItem[] = strokes
    .filter((s) => s.mode === 'pen' && s.points.length > 0)
    .map((stroke) => ({
      stroke,
      pts: stroke.points,
      box: getPointsBBox(stroke.points),
    }));

  if (penItems.length === 0) return [];

  // Split into distinct lines only when there is a wide vertical empty band (> 90px)
  // that doesn't cut through any stroke
  const sortedByY = [...penItems].sort((a, b) => a.box.minY - b.box.minY);
  const lineGroups: StrokeItem[][] = [];
  let currentGroup: StrokeItem[] = [sortedByY[0]];
  let groupMaxY = sortedByY[0].box.maxY;

  for (let i = 1; i < sortedByY.length; i++) {
    const item = sortedByY[i];
    if (item.box.minY - groupMaxY > 85) {
      lineGroups.push(currentGroup);
      currentGroup = [item];
      groupMaxY = item.box.maxY;
    } else {
      currentGroup.push(item);
      if (item.box.maxY > groupMaxY) groupMaxY = item.box.maxY;
    }
  }
  lineGroups.push(currentGroup);

  const results: RecognizedLocalEquation[] = [];
  for (const group of lineGroups) {
    const parsed = renderSequence(group);
    if (parsed.plain || parsed.latex) {
      results.push({
        plain: parsed.plain,
        latex: parsed.latex,
      });
    }
  }
  return results;
}
