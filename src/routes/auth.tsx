import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sfx } from "@/lib/sound";

const AVATARS = ["🦁", "🐫", "🦅", "🐎", "🌙", "⭐", "🕌", "🏹"];

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "الدخول إلى ديوان اللودو" },
      { name: "description", content: "سجّل دخولك للعب اللودو أونلاين مع أصدقائك في غرف مباشرة." },
      { property: "og:title", content: "الدخول إلى ديوان اللودو" },
      { property: "og:description", content: "أنشئ حسابك وابدأ اللعب فوراً." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]!);
  const [busy, setBusy] = useState(false);

  const target = search.next && search.next.startsWith("/") ? search.next : "/";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: target });
    });
  }, [navigate, target]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("تعذر تسجيل الدخول: تحقق من البريد وكلمة المرور");
      return;
    }
    sfx.home();
    void navigate({ to: target });
  };

  const signUp = async () => {
    if (username.trim().length < 2) {
      toast.error("اكتب اسم لاعب مناسب");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${target}`,
        data: { username: username.trim(), avatar },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "هذا البريد مسجّل بالفعل" : "تعذر إنشاء الحساب");
      return;
    }
    sfx.win();
    toast.success("أهلاً بك في الديوان!");
    void navigate({ to: target });
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("تعذر الدخول عبر جوجل");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: target });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel-royal w-full max-w-md rounded-3xl p-6 animate-rise">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: "var(--gradient-gold)" }}>
            🎲
          </div>
          <h1 className="font-display text-3xl font-bold text-gold-gradient">ديوان اللودو</h1>
          <p className="mt-1 text-sm text-muted-foreground">لودو عربي فاخر مع أصدقائك في الوقت الحقيقي</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">دخول</TabsTrigger>
            <TabsTrigger value="signup">حساب جديد</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">كلمة المرور</Label>
              <Input id="pass" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={signIn}>ادخل الديوان</Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">اسم اللاعب</Label>
              <Input id="name" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: أبو فيصل" />
            </div>
            <div className="space-y-1.5">
              <Label>الصورة الرمزية</Label>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`grid h-10 w-10 place-items-center rounded-xl border text-xl transition-colors ${
                      avatar === a ? "border-primary bg-primary/20" : "border-border bg-card"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email2">البريد الإلكتروني</Label>
              <Input id="email2" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass2">كلمة المرور</Label>
              <Input id="pass2" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={signUp}>أنشئ حسابي</Button>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={google}>
          المتابعة عبر جوجل
        </Button>
      </div>
    </div>
  );
}