/**
 * Pure geometry/progress helpers for the homepage scroll motion.
 * Everything here is measured once per layout (ScrollTrigger refresh), so
 * per-scroll work is arithmetic only.
 */

/** Viewport fractions (card top position) where a card starts/finishes entering. */
export const CARD_ENTER_START = 0.96;
export const CARD_ENTER_END = 0.7;
/** Extra delay per grid column, as a viewport fraction. */
export const CARD_COLUMN_STEP = 0.04;
const MAX_COLUMN = 2;

export type CardRange = { start: number; end: number };

/**
 * Scroll positions over which a card rolls in (scrolling down) and back out
 * (scrolling up). Returns null for cards already visible at load: they stay
 * static so nothing in view on arrival is ever faded.
 */
export function cardScrollRange({
  top,
  viewportHeight,
  maxScroll,
  column,
}: {
  top: number;
  viewportHeight: number;
  maxScroll: number;
  column: number;
}): CardRange | null {
  const col = Math.min(Math.max(0, Math.floor(column)), MAX_COLUMN);
  let start = top - viewportHeight * (CARD_ENTER_START - CARD_COLUMN_STEP * col);
  let end = top - viewportHeight * (CARD_ENTER_END - CARD_COLUMN_STEP * col);
  if (end > maxScroll) {
    // Near the bottom: finish exactly at max scroll so the card is never
    // left partly entered.
    start -= end - maxScroll;
    end = maxScroll;
  }
  if (start <= 0) return null;
  return { start: Math.round(start), end: Math.round(end) };
}

/** Rank of a card among siblings that share its grid row (0 = leftmost). */
export function columnIndex(
  boxes: readonly { left: number; top: number }[],
  i: number,
  tolerance = 4,
): number {
  const me = boxes[i];
  return boxes.filter((b) => Math.abs(b.top - me.top) <= tolerance && b.left < me.left - tolerance).length;
}

export type TraceKnot = { anchor: number; length: number };
export type Trace = {
  mode: "snake" | "spine";
  points: [number, number][];
  d: string;
  length: number;
  knots: TraceKnot[];
};

/**
 * Builds the accent trace. Vertical runs sit on the page's 40px background
 * grid lines in the gutters beside the content; horizontal runs follow the
 * real section divider borders. If there is no gutter on the right (phones),
 * it is a single spine on the left grid line.
 *
 * Coordinates are relative to the grid's origin (the .home element) and are
 * offset by 0.5px to sit on the 1px grid/border lines.
 */
export function buildTrace({
  width,
  contentLeft,
  contentRight,
  dividers,
  grid = 40,
  gap = 4,
}: {
  width: number;
  contentLeft: number;
  contentRight: number;
  dividers: readonly number[];
  grid?: number;
  gap?: number;
}): Trace | null {
  const ys = [...dividers].map(Math.round).sort((a, b) => a - b);
  if (ys.length < 2) return null;
  const xL = Math.max(0, Math.floor((contentLeft - gap) / grid) * grid);
  const xRCandidate = Math.ceil((contentRight + gap) / grid) * grid;
  const snake = xRCandidate <= width - 4 && xRCandidate > xL;
  const o = 0.5;

  const points: [number, number][] = [];
  const knots: TraceKnot[] = [];
  let length = 0;

  if (!snake) {
    const first = ys[0];
    const last = ys[ys.length - 1];
    points.push([xL + o, first + o], [xL + o, last + o]);
    length = last - first;
    knots.push({ anchor: first, length: 0 }, { anchor: last, length });
  } else {
    const xR = xRCandidate;
    const span = xR - xL;
    let minGap = Infinity;
    for (let i = 1; i < ys.length; i++) minGap = Math.min(minGap, ys[i] - ys[i - 1]);
    const hw = Math.min(60, minGap / 4);
    ys.forEach((y, i) => {
      const fromX = i % 2 === 0 ? xL : xR;
      const toX = i % 2 === 0 ? xR : xL;
      if (i === 0) points.push([fromX + o, y + o]);
      else {
        // vertical descent in the gutter from the previous divider
        length += y - ys[i - 1];
        points.push([fromX + o, y + o]);
      }
      knots.push({ anchor: y - hw, length });
      length += span;
      points.push([toX + o, y + o]);
      knots.push({ anchor: y + hw, length });
    });
  }

  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  return { mode: snake ? "snake" : "spine", points, d, length, knots };
}

/**
 * Document y the trace head is tied to. It sweeps from the top of the
 * viewport (at scroll 0) to its bottom (at max scroll), so the head is
 * always on screen and the trace completes exactly at the page end.
 */
export function anchorForScroll(scroll: number, viewportHeight: number, maxScroll: number): number {
  const p = maxScroll > 0 ? Math.min(1, Math.max(0, scroll / maxScroll)) : 1;
  return scroll + viewportHeight * p;
}

/** Piecewise-linear trace length for a document anchor (clamped). */
export function lengthAtAnchor(knots: readonly TraceKnot[], anchor: number): number {
  if (!knots.length) return 0;
  if (anchor <= knots[0].anchor) return knots[0].length;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1],
      b = knots[i];
    if (anchor <= b.anchor) {
      const span = b.anchor - a.anchor;
      return span > 0 ? a.length + ((anchor - a.anchor) / span) * (b.length - a.length) : b.length;
    }
  }
  return knots[knots.length - 1].length;
}
