import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "المتصدرون — ديوان اللودو" },
      { name: "description", content: "قائمة أفضل لاعبي اللودو حسب عدد الانتصارات وسلسلة الفوز." },
      { property: "og:title", content: "المتصدرون في ديوان اللودو" },
      { property: "og:description", content: "تنافس على صدارة الديوان واصعد في الترتيب." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const top = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar, wins, games, best_streak")
        .order("wins", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold text-gold-gradient">لوحة المتصدرين</h1>
      <p className="mt-1 text-sm text-muted-foreground">أفضل 50 لاعباً حسب عدد الانتصارات.</p>

      <div className="panel-royal mt-6 overflow-hidden rounded-2xl">
        {(top.data ?? []).map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
            <span className={`w-7 text-center font-display text-lg font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
              {i + 1}
            </span>
            <span className="text-2xl">{p.avatar}</span>
            <span className="flex-1 truncate font-bold">{p.username}</span>
            {i === 0 && <Crown className="h-4 w-4 text-primary" />}
            <span className="text-sm text-muted-foreground">{p.games} مباراة</span>
            <span className="w-16 text-end font-bold text-primary">{p.wins} فوز</span>
          </div>
        ))}
        {top.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {!top.isLoading && (top.data ?? []).length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">لا يوجد لاعبون بعد — كن أول المتصدرين!</p>
        )}
      </div>
    </AppShell>
  );
}