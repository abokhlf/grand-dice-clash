import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "ملفي وإنجازاتي — ديوان اللودو" },
      { name: "description", content: "تابع إحصائياتك، سلسلة انتصاراتك، وإنجازاتك المفتوحة في ديوان اللودو." },
      { property: "og:title", content: "ملفي في ديوان اللودو" },
      { property: "og:description", content: "إحصائيات المباريات والإنجازات والعملات." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user } = useProfile();

  const achievements = useQuery({
    queryKey: ["achievements"],
    queryFn: async () => {
      const { data } = await supabase.from("achievements").select("*").order("sort");
      return data ?? [];
    },
  });

  const earned = useQuery({
    queryKey: ["player_achievements", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase.from("player_achievements").select("achievement_id").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.achievement_id);
    },
  });

  const stats = [
    { label: "المباريات", value: profile?.games ?? 0 },
    { label: "الانتصارات", value: profile?.wins ?? 0 },
    { label: "سلسلة حالية", value: profile?.streak ?? 0 },
    { label: "أفضل سلسلة", value: profile?.best_streak ?? 0 },
  ];

  return (
    <AppShell>
      <div className="panel-royal flex items-center gap-4 rounded-2xl p-5">
        <span className="grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: "var(--gradient-royal)" }}>
          {profile?.avatar ?? "🦁"}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-gold-gradient">{profile?.username ?? "زائر"}</h1>
          <p className="text-sm text-muted-foreground">رصيدك: {profile?.coins ?? 0} عملة</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel-royal rounded-2xl p-4 text-center">
            <div className="font-display text-3xl font-bold text-primary">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 font-display text-2xl font-bold">الإنجازات</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(achievements.data ?? []).map((a) => {
          const done = (earned.data ?? []).includes(a.id);
          return (
            <article key={a.id} className={`panel-royal rounded-2xl p-4 ${done ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{a.icon}</span>
                <div>
                  <h3 className="font-bold text-primary">{a.name_ar}</h3>
                  <p className="text-xs text-muted-foreground">{a.description_ar}</p>
                </div>
              </div>
              <p className="mt-3 text-xs font-bold">
                {done ? "✓ مفتوح" : `مكافأة ${a.reward} عملة`}
              </p>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}