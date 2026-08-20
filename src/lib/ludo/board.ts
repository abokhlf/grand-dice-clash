export type Color = "red" | "green" | "yellow" | "blue";

export const COLORS: Color[] = ["red", "green", "yellow", "blue"];

export const COLOR_LABEL: Record<Color, string> = {
  red: "الأحمر",
  green: "الأخضر",
  yellow: "الأصفر",
  blue: "الأزرق",
};

/** CSS variable name holding each player's colour. */
export const COLOR_VAR: Record<Color, string> = {
  red: "var(--ludo-red)",
  green: "var(--ludo-green)",
  yellow: "var(--ludo-yellow)",
  blue: "var(--ludo-blue)",
};

export type Cell = { r: number; c: number };

/** The 52 shared track cells, index 0 = red start. */
export const TRACK: Cell[] = [
  { r: 6, c: 1 },
  { r: 6, c: 2 },
  { r: 6, c: 3 },
  { r: 6, c: 4 },
  { r: 6, c: 5 },
  { r: 5, c: 6 },
  { r: 4, c: 6 },
  { r: 3, c: 6 },
  { r: 2, c: 6 },
  { r: 1, c: 6 },
  { r: 0, c: 6 },
  { r: 0, c: 7 },
  { r: 0, c: 8 },
  { r: 1, c: 8 },
  { r: 2, c: 8 },
  { r: 3, c: 8 },
  { r: 4, c: 8 },
  { r: 5, c: 8 },
  { r: 6, c: 9 },
  { r: 6, c: 10 },
  { r: 6, c: 11 },
  { r: 6, c: 12 },
  { r: 6, c: 13 },
  { r: 6, c: 14 },
  { r: 7, c: 14 },
  { r: 8, c: 14 },
  { r: 8, c: 13 },
  { r: 8, c: 12 },
  { r: 8, c: 11 },
  { r: 8, c: 10 },
  { r: 8, c: 9 },
  { r: 9, c: 8 },
  { r: 10, c: 8 },
  { r: 11, c: 8 },
  { r: 12, c: 8 },
  { r: 13, c: 8 },
  { r: 14, c: 8 },
  { r: 14, c: 7 },
  { r: 14, c: 6 },
  { r: 13, c: 6 },
  { r: 12, c: 6 },
  { r: 11, c: 6 },
  { r: 10, c: 6 },
  { r: 9, c: 6 },
  { r: 8, c: 5 },
  { r: 8, c: 4 },
  { r: 8, c: 3 },
  { r: 8, c: 2 },
  { r: 8, c: 1 },
  { r: 8, c: 0 },
  { r: 7, c: 0 },
  { r: 6, c: 0 },
];

export const START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Start cells + star cells are safe from capture. */
export const SAFE_INDEXES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const STAR_INDEXES = new Set([8, 21, 34, 47]);

/** Five home-column cells per colour (progress 52..56). Progress 57 = centre. */
export const HOME_PATH: Record<Color, Cell[]> = {
  red: [
    { r: 7, c: 1 },
    { r: 7, c: 2 },
    { r: 7, c: 3 },
    { r: 7, c: 4 },
    { r: 7, c: 5 },
  ],
  green: [
    { r: 1, c: 7 },
    { r: 2, c: 7 },
    { r: 3, c: 7 },
    { r: 4, c: 7 },
    { r: 5, c: 7 },
  ],
  yellow: [
    { r: 7, c: 13 },
    { r: 7, c: 12 },
    { r: 7, c: 11 },
    { r: 7, c: 10 },
    { r: 7, c: 9 },
  ],
  blue: [
    { r: 13, c: 7 },
    { r: 12, c: 7 },
    { r: 11, c: 7 },
    { r: 10, c: 7 },
    { r: 9, c: 7 },
  ],
};

export const CENTER: Cell = { r: 7, c: 7 };

/** Top-left corner (row, col) of each colour's base yard. */
export const YARD_ORIGIN: Record<Color, Cell> = {
  red: { r: 0, c: 0 },
  green: { r: 0, c: 9 },
  yellow: { r: 9, c: 9 },
  blue: { r: 9, c: 0 },
};

export function yardSlot(color: Color, index: number): Cell {
  const o = YARD_ORIGIN[color];
  const dr = index < 2 ? 1.2 : 3.2;
  const dc = index % 2 === 0 ? 1.2 : 3.2;
  return { r: o.r + dr, c: o.c + dc };
}

/** Board cell for a piece at a given progress (0 = yard). */
export function cellForProgress(color: Color, progress: number, pieceIndex: number): Cell {
  if (progress <= 0) return yardSlot(color, pieceIndex);
  if (progress <= 51) return TRACK[(START_INDEX[color] + progress - 1) % 52]!;
  if (progress <= 56) return HOME_PATH[color][progress - 52]!;
  return CENTER;
}

/** Shared-track index for a progress value, or null when off the shared track. */
export function trackIndex(color: Color, progress: number): number | null {
  if (progress < 1 || progress > 51) return null;
  return (START_INDEX[color] + progress - 1) % 52;
}