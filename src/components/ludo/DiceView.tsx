import { cn } from "@/lib/utils";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceView({
  value,
  rolling,
  className,
}: {
  value: number | null;
  rolling?: boolean;
  className?: string;
}) {
  const pips = value ? (PIPS[value] ?? []) : [];
  return (
    <div
      className={cn(
        "grid h-16 w-16 grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-primary/70 p-2",
        rolling && "animate-dice",
        className,
      )}
      style={{ background: "var(--gradient-gold)", boxShadow: "var(--shadow-gold)" }}
      aria-label={value ? `النرد: ${value}` : "النرد"}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-opacity",
            pips.includes(i) ? "bg-primary-foreground opacity-100" : "opacity-0",
          )}
        />
      ))}
    </div>
  );
}