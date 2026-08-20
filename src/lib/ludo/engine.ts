import { SAFE_INDEXES, trackIndex, type Color } from "./board";

export const HOME_PROGRESS = 57;

export type Seat = {
  color: Color;
  userId: string | null;
  name: string;
  avatar: string;
  isBot: boolean;
};

export type GameState = {
  seats: Seat[];
  pieces: Record<Color, number[]>;
  turn: number;
  dice: number | null;
  sixStreak: number;
  captures: Record<Color, number>;
  ranking: Color[];
  finished: boolean;
  turnStartedAt: string;
  lastEvent: string;
  version: number;
};

export type Move = {
  piece: number;
  from: number;
  to: number;
  capture: boolean;
  finishes: boolean;
};

export function createInitialState(seats: Seat[]): GameState {
  const pieces = {} as Record<Color, number[]>;
  const captures = {} as Record<Color, number>;
  for (const seat of seats) {
    pieces[seat.color] = [0, 0, 0, 0];
    captures[seat.color] = 0;
  }
  return {
    seats,
    pieces,
    turn: 0,
    dice: null,
    sixStreak: 0,
    captures,
    ranking: [],
    finished: false,
    turnStartedAt: new Date().toISOString(),
    lastEvent: "بدأت المباراة",
    version: 1,
  };
}

export function currentSeat(state: GameState): Seat {
  return state.seats[state.turn]!;
}

function isSafeProgress(color: Color, progress: number): boolean {
  const idx = trackIndex(color, progress);
  return idx === null ? true : SAFE_INDEXES.has(idx);
}

export function legalMoves(state: GameState, color: Color, dice: number): Move[] {
  const pieces = state.pieces[color] ?? [];
  const moves: Move[] = [];
  pieces.forEach((progress, piece) => {
    if (progress >= HOME_PROGRESS) return;
    let to: number;
    if (progress === 0) {
      if (dice !== 6) return;
      to = 1;
    } else {
      to = progress + dice;
      if (to > HOME_PROGRESS) return;
    }
    // cannot land on own piece outside the yard
    if (pieces.some((p, i) => i !== piece && p === to && to < HOME_PROGRESS && to > 0)) return;
    moves.push({
      piece,
      from: progress,
      to,
      capture: wouldCapture(state, color, to).length > 0,
      finishes: to === HOME_PROGRESS,
    });
  });
  return moves;
}

function wouldCapture(
  state: GameState,
  color: Color,
  to: number,
): Array<{ color: Color; piece: number }> {
  const targetIdx = trackIndex(color, to);
  if (targetIdx === null) return [];
  if (isSafeProgress(color, to)) return [];
  const hits: Array<{ color: Color; piece: number }> = [];
  for (const seat of state.seats) {
    if (seat.color === color) continue;
    (state.pieces[seat.color] ?? []).forEach((p, i) => {
      if (trackIndex(seat.color, p) === targetIdx) hits.push({ color: seat.color, piece: i });
    });
  }
  return hits;
}

export function rollValue(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! % 6) + 1;
}

export type ApplyResult = {
  state: GameState;
  moved?: Move;
  captured: number;
  extraTurn: boolean;
};

function advanceTurn(state: GameState): void {
  const alive = state.seats.filter((s) => !state.ranking.includes(s.color));
  if (alive.length <= 1) {
    for (const seat of alive) if (!state.ranking.includes(seat.color)) state.ranking.push(seat.color);
    state.finished = true;
    state.dice = null;
    return;
  }
  let next = state.turn;
  for (let i = 0; i < state.seats.length; i++) {
    next = (next + 1) % state.seats.length;
    const seat = state.seats[next]!;
    if (!state.ranking.includes(seat.color)) break;
  }
  state.turn = next;
  state.dice = null;
  state.sixStreak = 0;
  state.turnStartedAt = new Date().toISOString();
}

/** Roll the dice for the active seat. Auto-passes when no move is possible. */
export function applyRoll(state: GameState, forced?: number): ApplyResult {
  const next: GameState = structuredClone(state);
  const seat = currentSeat(next);
  const dice = forced ?? rollValue();
  next.version += 1;
  next.dice = dice;
  next.sixStreak = dice === 6 ? next.sixStreak + 1 : 0;
  next.lastEvent = `${seat.name} رمى ${dice}`;

  if (next.sixStreak >= 3) {
    next.lastEvent = `${seat.name} رمى ثلاث ستات — ضاع الدور!`;
    advanceTurn(next);
    return { state: next, captured: 0, extraTurn: false };
  }

  const moves = legalMoves(next, seat.color, dice);
  if (moves.length === 0) {
    next.lastEvent = `${seat.name} رمى ${dice} — لا توجد حركة ممكنة`;
    advanceTurn(next);
    return { state: next, captured: 0, extraTurn: false };
  }
  return { state: next, captured: 0, extraTurn: true };
}

/** Move a piece with the already-rolled dice value. */
export function applyMove(state: GameState, pieceIndex: number): ApplyResult {
  const next: GameState = structuredClone(state);
  const seat = currentSeat(next);
  const dice = next.dice;
  if (dice === null) throw new Error("لم يتم رمي النرد بعد");
  const move = legalMoves(next, seat.color, dice).find((m) => m.piece === pieceIndex);
  if (!move) throw new Error("حركة غير مسموحة");

  const hits = wouldCapture(next, seat.color, move.to);
  for (const hit of hits) next.pieces[hit.color]![hit.piece] = 0;
  next.pieces[seat.color]![pieceIndex] = move.to;
  next.captures[seat.color] = (next.captures[seat.color] ?? 0) + hits.length;
  next.version += 1;

  if (hits.length > 0) next.lastEvent = `${seat.name} أكل ${hits.length} قطعة!`;
  else if (move.finishes) next.lastEvent = `${seat.name} أوصل قطعة إلى البيت!`;
  else next.lastEvent = `${seat.name} تحرك ${dice} خطوات`;

  const allHome = next.pieces[seat.color]!.every((p) => p === HOME_PROGRESS);
  if (allHome && !next.ranking.includes(seat.color)) {
    next.ranking.push(seat.color);
    next.lastEvent = `${seat.name} أنهى المباراة في المركز ${next.ranking.length}!`;
  }

  const extra = (dice === 6 || hits.length > 0 || move.finishes) && !allHome;
  if (extra) {
    next.dice = null;
    next.turnStartedAt = new Date().toISOString();
  } else {
    advanceTurn(next);
  }

  return { state: next, moved: move, captured: hits.length, extraTurn: extra };
}

/** Simple heuristic bot: prefer capture > finish > leave yard > furthest piece. */
export function pickBotMove(state: GameState): number {
  const seat = currentSeat(state);
  const moves = legalMoves(state, seat.color, state.dice ?? 0);
  if (moves.length === 0) return -1;
  const scored = moves.map((m) => {
    let score = m.to;
    if (m.capture) score += 400;
    if (m.finishes) score += 300;
    if (m.from === 0) score += 150;
    if (m.to > 51) score += 80;
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.m.piece;
}