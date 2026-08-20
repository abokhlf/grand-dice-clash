import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Crown, RefreshCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminDeleteRoomFn,
  adminOverviewFn,
  adminPlayersFn,
  adminRoomsFn,
  adminSetRoleFn,
  adminUpdatePlayerFn,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة تحكم الديوان — إدارة اللعبة" },
      { name: "description", content: "لوحة المشرف: إدارة اللاعبين، العملات، الغرف والصلاحيات في ديوان اللودو." },
      { property: "og:title", content: "لوحة تحكم ديوان اللودو" },
      { property: "og:description", content: "تحكم كامل في اللاعبين والغرف والاقتصاد داخل اللعبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useIsAdmin();
  const [search, setSearch] = useState("");

  const overview = useServerFn(adminOverviewFn);
  const players = useServerFn(adminPlayersFn);
  const rooms = useServerFn(adminRoomsFn);
  const updatePlayer = useServerFn(adminUpdatePlayerFn);
  const deleteRoom = useServerFn(adminDeleteRoomFn);
  const setRole = useServerFn(adminSetRoleFn);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/admin" } });
  }, [loading, user, navigate]);

  const statsQ = useQuery({ queryKey: ["admin-overview"], enabled: isAdmin, queryFn: () => overview() });
  const playersQ = useQuery({
    queryKey: ["admin-players", search],
    enabled: isAdmin,
    queryFn: () => players({ data: { search } }),
  });
  const roomsQ = useQuery({ queryKey: ["admin-rooms"], enabled: isAdmin, queryFn: () => rooms() });

  if (loading || isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-muted-foreground">جارٍ التحقق من الصلاحيات…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="panel-royal mx-auto mt-16 max-w-md rounded-3xl p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="font-display text-2xl font-bold text-gold-gradient">منطقة المشرفين</h1>
          <p className="mt-2 text-sm text-muted-foreground">هذا القسم مخصص لحساب الإدارة فقط.</p>
        </div>
      </AppShell>
    );
  }

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-players"] });
    void qc.invalidateQueries({ queryKey: ["admin-rooms"] });
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تنفيذ العملية");
    }
  };

  const stats = statsQ.data;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-gold-gradient">لوحة تحكم الديوان</h1>
          <p className="mt-1 text-sm text-muted-foreground">تحكم كامل في اللاعبين والاقتصاد والغرف.</p>
        </div>
        <Button variant="outline" size="icon" onClick={refresh} aria-label="تحديث">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["اللاعبون", stats?.players],
          ["الغرف", stats?.rooms],
          ["المباريات", stats?.matches],
          ["الرسائل", stats?.messages],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel-royal rounded-2xl p-4 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold text-primary">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم اللاعب" className="max-w-xs" />
        </div>
        <div className="space-y-2">
          {(playersQ.data ?? []).map((p) => (
            <div key={p.id} className="panel-royal flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <span className="text-2xl">{p.avatar}</span>
              <div className="min-w-32 flex-1">
                <p className="font-bold">{p.username}</p>
                <p className="text-xs text-muted-foreground">
                  {p.wins} فوز / {p.games} مباراة · أفضل سلسلة {p.best_streak}
                </p>
              </div>
              <span className="flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-sm font-bold text-primary">
                <Coins className="h-4 w-4" />
                {p.coins}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => act(() => updatePlayer({ data: { userId: p.id, coins: p.coins + 1000 } }), "تمت إضافة 1000 عملة")}
              >
                +1000
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => act(() => updatePlayer({ data: { userId: p.id, coins: 0, wins: 0, games: 0 } }), "تمت تصفية الحساب")}
              >
                تصفير
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => act(() => setRole({ data: { userId: p.id, role: "admin", grant: true } }), "تم منح صلاحية الإدارة")}
              >
                <Crown className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {playersQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد لاعبون مطابقون.</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-bold">الغرف النشطة</h2>
        <div className="space-y-2">
          {(roomsQ.data ?? []).map((r) => (
            <div key={r.id} className="panel-royal flex items-center gap-3 rounded-2xl p-3">
              <span className="font-mono text-lg font-bold text-primary" dir="ltr">{r.code}</span>
              <span className="text-xs text-muted-foreground">
                {r.status} · {r.is_public ? "عامة" : "خاصة"} · {r.max_players} لاعبين
              </span>
              <div className="flex-1" />
              <Button size="sm" variant="destructive" onClick={() => act(() => deleteRoom({ data: { roomId: r.id } }), "تم حذف الغرفة")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {roomsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد غرف حالياً.</p>}
        </div>
      </section>
    </AppShell>
  );
}
