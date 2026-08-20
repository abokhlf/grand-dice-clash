import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Coins, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { buyItemFn, equipItemFn } from "@/lib/game.functions";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "متجر ديوان اللودو — قطع وألواح ونرد" },
      { name: "description", content: "افتح أطقم القطع والألواح والنرد الفاخرة بالعملات التي تكسبها من المباريات." },
      { property: "og:title", content: "متجر ديوان اللودو" },
      { property: "og:description", content: "خصص لوحك وقطعك ونردك بأسلوب عربي فاخر." },
    ],
  }),
  component: ShopPage,
});

const KINDS = [
  { key: "piece", label: "القطع" },
  { key: "board", label: "الألواح" },
  { key: "dice", label: "النرد" },
] as const;

function ShopPage() {
  const { profile, user, refetch } = useProfile();
  const buy = useServerFn(buyItemFn);
  const equip = useServerFn(equipItemFn);

  const items = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data } = await supabase.from("items").select("*").order("sort");
      return data ?? [];
    },
  });

  const owned = useQuery({
    queryKey: ["player_items", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase.from("player_items").select("item_id");
      return (data ?? []).map((r) => r.item_id);
    },
  });

  const equipped = new Set(
    [profile?.equipped_piece, profile?.equipped_board, profile?.equipped_dice].filter(Boolean) as string[],
  );

  const act = async (itemId: string, isOwned: boolean) => {
    try {
      sfx.click();
      if (isOwned) await equip({ data: { itemId } });
      else {
        await buy({ data: { itemId } });
        sfx.win();
      }
      await Promise.all([refetch(), owned.refetch()]);
      toast.success(isOwned ? "تم التجهيز" : "تم الشراء والتجهيز");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إتمام العملية");
    }
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold text-gold-gradient">المتجر والتخصيص</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        اكسب العملات من المباريات وافتح أطقماً فاخرة. رصيدك الحالي: {profile?.coins ?? 0}
      </p>

      <Tabs defaultValue="piece" className="mt-6">
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k.key} value={k.key}>{k.label}</TabsTrigger>
          ))}
        </TabsList>
        {KINDS.map((k) => (
          <TabsContent key={k.key} value={k.key} className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {(items.data ?? [])
              .filter((i) => i.kind === k.key)
              .map((item) => {
                const isOwned = item.price === 0 || (owned.data ?? []).includes(item.id);
                const isEquipped = equipped.has(item.id);
                return (
                  <article key={item.id} className="panel-royal animate-rise rounded-2xl p-5">
                    <div
                      className="mb-4 grid h-24 place-items-center rounded-xl border border-primary/30 text-4xl"
                      style={{ background: "var(--gradient-royal)" }}
                    >
                      {k.key === "dice" ? "🎲" : k.key === "board" ? "🧿" : "⬤"}
                    </div>
                    <h2 className="font-display text-xl font-bold text-primary">{item.name_ar}</h2>
                    <p className="mt-1 min-h-10 text-sm text-muted-foreground">{item.description_ar}</p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm font-bold text-primary">
                        {isOwned ? <Check className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                        {isOwned ? "مملوك" : item.price}
                      </span>
                      <Button
                        size="sm"
                        variant={isEquipped ? "outline" : "default"}
                        disabled={isEquipped}
                        onClick={() => act(item.id, isOwned)}
                      >
                        {isEquipped ? "مُجهّز" : isOwned ? "تجهيز" : <><Lock className="ms-1 h-3.5 w-3.5" />شراء</>}
                      </Button>
                    </div>
                  </article>
                );
              })}
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}