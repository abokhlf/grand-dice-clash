import { useMemo } from "react";
import {
  CENTER,
  COLORS,
  COLOR_VAR,
  HOME_PATH,
  STAR_INDEXES,
  START_INDEX,
  TRACK,
  YARD_ORIGIN,
  cellForProgress,
  type Cell,
  type Color,
} from "@/lib/ludo/board";
import { HOME_PROGRESS, type GameState } from "@/lib/ludo/engine";
import { cn } from "@/lib/utils";

const N = 15;
const pct = (v: number) => `${(v / N) * 100}%`;

function cellStyle(cell: Cell) {
  return { left: pct(cell.c), top: pct(cell.r), width: pct(1), height: pct(1) } as const;
}

type Props = {
  state: GameState;
  movablePieces?: number[];
  activeColor?: Color | null;
  onPieceClick?: (piece: number) => void;
  myColor?: Color | null;
};

export function LudoBoard({ state, movablePieces = [], activeColor, onPieceClick, myColor }: Props) {
  const seatColors = useMemo(() => state.seats.map((s) => s.color), [state.seats]);

  return (
    <div
      dir="ltr"
      className="relative aspect-square w-full overflow-hidden rounded-[1.6rem] border-2 border-primary/45 bg-card p-[2%] shadow-[var(--shadow-deep)]"
    >
      <div className="arabesque absolute inset-0 opacity-40" aria-hidden />
      <div className="relative h-full w-full">
        {/* yards */}
        {COLORS.map((color) => {
          const o = YARD_ORIGIN[color];
          const inGame = seatColors.includes(color);
          return (
            <div
              key={`yard-${color}`}
              className={cn(
                "absolute rounded-2xl border-2 transition-opacity",
                inGame ? "opacity-100" : "opacity-25",
              )}
              style={{
                left: pct(o.c),
                top: pct(o.r),
                width: pct(6),
                height: pct(6),
                borderColor: COLOR_VAR[color],
                background: `color-mix(in oklab, ${COLOR_VAR[color]} 26%, transparent)`,
              }}
            >
              <div className="absolute inset-[16%] rounded-xl border border-primary/30 bg-card/70" />
            </div>
          );
        })}

        {/* track */}
        {TRACK.map((cell, i) => {
          const owner = COLORS.find((c) => START_INDEX[c] === i);
          return (
            <div
              key={`t-${i}`}
              className="absolute border border-primary/20"
              style={{
                ...cellStyle(cell),
                background: owner
                  ? `color-mix(in oklab, ${COLOR_VAR[owner]} 62%, transparent)`
                  : "color-mix(in oklab, var(--cream) 8%, transparent)",
              }}
            >
              {STAR_INDEXES.has(i) && (
                <span className="flex h-full w-full items-center justify-center text-[0.55rem] text-primary">
                  ★
                </span>
              )}
            </div>
          );
        })}

        {/* home columns */}
        {COLORS.map((color) =>
          HOME_PATH[color].map((cell, i) => (
            <div
              key={`h-${color}-${i}`}
              className="absolute border border-primary/25"
              style={{
                ...cellStyle(cell),
                background: `color-mix(in oklab, ${COLOR_VAR[color]} 45%, transparent)`,
              }}
            />
          )),
        )}

        {/* centre */}
        <div
          className="absolute flex items-center justify-center rounded-md border-2 border-primary/60"
          style={{
            left: pct(CENTER.c - 1),
            top: pct(CENTER.r - 1),
            width: pct(3),
            height: pct(3),
            background: "var(--gradient-gold)",
          }}
        >
          <span className="font-display text-[clamp(0.6rem,2.2vw,1.1rem)] font-bold text-primary-foreground">
            البيت
          </span>
        </div>

        {/* pieces */}
        {state.seats.map((seat) =>
          (state.pieces[seat.color] ?? []).map((progress, pieceIndex) => {
            const cell = cellForProgress(seat.color, progress, pieceIndex);
            const isMine = myColor === seat.color;
            const movable = isMine && movablePieces.includes(pieceIndex);
            const stacked = (state.pieces[seat.color] ?? []).filter(
              (p, i) => p === progress && progress > 0 && i < pieceIndex,
            ).length;
            return (
              <button
                key={`p-${seat.color}-${pieceIndex}`}
                type="button"
                disabled={!movable}
                onClick={() => movable && onPieceClick?.(pieceIndex)}
                aria-label={`قطعة ${seat.name} رقم ${pieceIndex + 1}`}
                className={cn(
                  "absolute z-10 grid place-items-center rounded-full border-2 border-cream/70 transition-all duration-500 ease-out",
                  movable && "z-20 cursor-pointer ring-2 ring-primary animate-turn",
                  progress >= HOME_PROGRESS && "opacity-90",
                )}
                style={{
                  left: pct(cell.c + 0.5),
                  top: pct(cell.r + 0.5),
                  width: pct(0.82),
                  height: pct(0.82),
                  transform: `translate(-50%, calc(-50% - ${stacked * 12}%))`,
                  background: COLOR_VAR[seat.color],
                  boxShadow:
                    activeColor === seat.color
                      ? `0 0 0 2px var(--gold), 0 6px 14px -6px ${COLOR_VAR[seat.color]}`
                      : "0 4px 10px -6px oklch(0 0 0 / 80%)",
                }}
              >
                <span className="text-[0.5rem] font-bold text-cream">{pieceIndex + 1}</span>
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}