import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, Dices, DoorOpen, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { createRoomFn, joinRoomFn, quickMatchFn } from "@/lib/game.functions";
import { sfx } from "@/lib/sound";
import { LudoBoard } from "@/components/ludo/LudoBoard";
import { createInitialState } from "@/lib/ludo/engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ديوان اللودو — لعبة لودو عربية أونلاين" },
      {
        name: "description",
        content: "العب اللودو أونلاين بين 2-4 لاعبين بطابع عربي تراثي: غرف مباشرة، دردشة، إنجازات ومتجر قطع.",
      },
      { property: "og:title", content: "ديوان اللودو — لودو عربي فاخر" },
      { property: "og:description", content: "غرف مباشرة، ذكاء اصطناعي، عملات وتخصيص كامل." },
    ],
  }),
  component: Index,
});

const DEMO = createInitialState([
  { color: "red", userId: null, name: "الأحمر", avatar: "🦁", isBot: true },
  { color: "green", userId: null, name: "الأخضر", avatar: "🐫", isBot: true },
  { color: "yellow", userId: null, name: "الأصفر", avatar: "🦅", isBot: true },
  { color: "blue", userId: null, name: "الأزرق", avatar: "🐎", isBot: true },
]);

function Index() {
  const navigate = useNavigate();
  const { profile, user, isLoading } = useProfile();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const quick = useServerFn(quickMatchFn);
  const create = useServerFn(createRoomFn);
  const join = useServerFn(joinRoomFn);

  const guard = () => {
    if (!user) {
      void navigate({ to: "/auth", search: {} });
      return false;
    }
    return true;
  };

  const run = async (fn: () => Promise<{ code: string }>) => {
    if (!guard()) return;
    setBusy(true);
    try {
      sfx.click();
      const res = await fn();
      await navigate({ to: "/room/$code", params: { code: res.code } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="animate-rise space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/70 px-4 py-1 text-xs font-bold text-primary">
            ✦ لودو أونلاين بطابع عربي تراثي
          </span>
          <h1 className="font-display text-4xl leading-tight font-bold sm:text-6xl">
            <span className="text-gold-gradient">ديوان اللودو</span>
            <br />
            حيث تُلعب الجولة بأصولها
          </h1>
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
            غرف مباشرة بين 2-4 لاعبين، نرد عادل يُدار من الخادم، دردشة وإيموجي، عملات وإنجازات،
            وتصميم مستوحى من الزخرفة الإسلامية.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="h-14 text-base font-bold" disabled={busy || isLoading} onClick={() => run(() => quick({}))}>
              <Dices className="ms-1 h-5 w-5" /> لعب سريع
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 text-base font-bold"
              disabled={busy}
              onClick={() => run(() => create({ data: { isPublic: false, maxPlayers: 4, bots: 0 } }))}
            >
              <Plus className="ms-1 h-5 w-5" /> إنشاء غرفة خاصة
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 text-base font-bold"
              disabled={busy}
              onClick={() => run(() => create({ data: { isPublic: false, maxPlayers: 4, bots: 3 } }))}
            >
              <Bot className="ms-1 h-5 w-5" /> ضد الكمبيوتر
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 text-base font-bold"
              disabled={busy}
              onClick={() => run(() => create({ data: { isPublic: true, maxPlayers: 4, bots: 0 } }))}
            >
              <Users className="ms-1 h-5 w-5" /> غرفة عامة
            </Button>
          </div>

          <div className="panel-royal flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <DoorOpen className="h-5 w-5 text-primary" />
            <Input
              value={code}
              dir="ltr"
              maxLength={6}
              placeholder="كود الغرفة"
              className="text-center text-lg font-bold tracking-[0.4em] uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button disabled={busy || code.length < 4} onClick={() => run(() => join({ data: { code } }))}>
              انضمام
            </Button>
          </div>

          {profile && (
            <p className="text-sm text-muted-foreground">
              أهلاً {profile.avatar} <span className="font-bold text-foreground">{profile.username}</span> — رصيدك{" "}
              <span className="font-bold text-primary">{profile.coins}</span> عملة، وانتصاراتك {profile.wins}.
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-md animate-rise">
          <LudoBoard state={DEMO} />
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          { icon: "⚡", title: "تزامن لحظي", text: "كل رمية وحركة تظهر فوراً لدى الجميع، مع استئناف تلقائي بعد انقطاع الشبكة." },
          { icon: "🛡️", title: "نرد عادل", text: "الرمي والتحقق من الحركات يتم على الخادم — لا مجال للغش." },
          { icon: "👑", title: "تخصيص فاخر", text: "أطقم قطع وألواح ونرد تُفتح بالعملات التي تكسبها من المباريات." },
        ].map((f) => (
          <article key={f.title} className="panel-royal rounded-2xl p-5">
            <div className="mb-2 text-2xl">{f.icon}</div>
            <h2 className="font-display text-xl font-bold text-primary">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
