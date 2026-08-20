import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, LogOut, Play, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LudoBoard } from "@/components/ludo/LudoBoard";
import { DiceView } from "@/components/ludo/DiceView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { legalMoves, type GameState } from "@/lib/ludo/engine";
import type { Color } from "@/lib/ludo/board";
import { autoStepFn, leaveRoomFn, movePieceFn, rollDiceFn, sendChatFn, startMatchFn } from "@/lib/game.functions";
import { sfx } from "@/lib/sound";

const EMOJIS = ["👏", "🔥", "😂", "😱", "🤝", "🎯", "🐫", "☕"];

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "غرفة اللعب — ديوان اللودو" },
      { name: "description", content: "غرفة لودو مباشرة: ارمِ النرد، حرّك قطعك، ودردش مع خصومك لحظياً." },
      { property: "og:title", content: "غرفة لعب في ديوان اللودو" },
      { property: "og:description", content: "انضم إلى المباراة وتحدَّ أصدقاءك الآن." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [rolling, setRolling] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const roll = useServerFn(rollDiceFn);
  const move = useServerFn(movePieceFn);
  const start = useServerFn(startMatchFn);
  const leave = useServerFn(leaveRoomFn);
  const chat = useServerFn(sendChatFn);
  const step = useServerFn(autoStepFn);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: `/room/${code}` } });
  }, [loading, user, navigate, code]);

  const roomQ = useQuery({
    queryKey: ["room", code],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: room } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
      if (!room) return null;
      const [{ data: players }, { data: match }, { data: messages }] = await Promise.all([
        supabase.from("room_players").select("*").eq("room_id", room.id).order("seat"),
        supabase.from("matches").select("*").eq("room_id", room.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("chat_messages").select("*").eq("room_id", room.id).order("created_at").limit(80),
      ]);
      const ids = [...new Set((messages ?? []).map((m) => m.user_id))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, username, avatar").in("id", ids)
        : { data: [] as { id: string; username: string; avatar: string }[] };
      return { room, players: players ?? [], match, messages: messages ?? [], profiles: profiles ?? [] };
    },
  });

  const roomId = roomQ.data?.room.id;

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["room", code] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["room", code] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["room", code] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, () => {
        void qc.invalidateQueries({ queryKey: ["room", code] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, code, qc]);

  const state = (roomQ.data?.match?.state as GameState | undefined) ?? null;
  const myColor = useMemo<Color | undefined>(() => {
    const seat = roomQ.data?.players.find((p) => p.user_id === user?.id);
    return seat ? (seat.color as Color) : undefined;
  }, [roomQ.data, user?.id]);

  const activeSeat = state ? state.seats[state.turn] : null;
  const isMyTurn = Boolean(state && !state.finished && activeSeat && activeSeat.userId === user?.id);
  const movable = useMemo(() => {
    if (!state || !isMyTurn || !state.dice || !myColor) return [];
    return legalMoves(state, myColor, state.dice).map((m) => m.piece);
  }, [state, isMyTurn, myColor]);

  // Drive bot / auto turns forward.
  useEffect(() => {
    if (!roomId || !state || state.finished) return;
    const seat = state.seats[state.turn];
    if (!seat?.isBot) return;
    const timer = setTimeout(() => {
      void step({ data: { roomId } }).catch(() => undefined);
    }, 900);
    return () => clearTimeout(timer);
  }, [roomId, state, step]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [roomQ.data?.messages.length]);

  if (roomQ.isLoading || loading) {
    return <AppShell><p className="py-20 text-center text-muted-foreground">جارٍ فتح الغرفة…</p></AppShell>;
  }
  if (!roomQ.data) {
    return (
      <AppShell>
        <div className="panel-royal mx-auto max-w-md rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl font-bold">الغرفة غير موجودة</h1>
          <Button className="mt-4" onClick={() => navigate({ to: "/" })}>العودة للرئيسية</Button>
        </div>
      </AppShell>
    );
  }

  const { room, players, messages, profiles } = roomQ.data;
  const isHost = room.host_id === user?.id;

  const doRoll = async () => {
    if (!roomId) return;
    setRolling(true);
    sfx.roll();
    try {
      await roll({ data: { roomId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رمي النرد");
    } finally {
      setTimeout(() => setRolling(false), 450);
      await qc.invalidateQueries({ queryKey: ["room", code] });
    }
  };

  const doMove = async (piece: number) => {
    if (!roomId) return;
    sfx.move();
    try {
      await move({ data: { roomId, piece } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حركة غير مسموحة");
    }
    await qc.invalidateQueries({ queryKey: ["room", code] });
  };

  const send = async () => {
    if (!roomId || !message.trim()) return;
    const content = message.trim();
    setMessage("");
    try {
      await chat({ data: { roomId, content } });
    } catch {
      toast.error("تعذر إرسال الرسالة");
    }
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="panel-royal flex flex-wrap items-center gap-3 rounded-2xl p-4">
            <div>
              <p className="text-xs text-muted-foreground">كود الغرفة</p>
              <p dir="ltr" className="font-display text-2xl font-bold tracking-[0.3em] text-gold-gradient">{room.code}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(room.code);
                toast.success("تم نسخ الكود");
              }}
            >
              <Copy className="ms-1 h-4 w-4" /> نسخ
            </Button>
            <div className="flex-1" />
            {room.status === "lobby" && isHost && (
              <Button
                onClick={async () => {
                  try {
                    await start({ data: { roomId: room.id } });
                    sfx.home();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "تعذر بدء المباراة");
                  }
                }}
              >
                <Play className="ms-1 h-4 w-4" /> ابدأ المباراة
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await leave({ data: { roomId: room.id } }).catch(() => undefined);
                await navigate({ to: "/" });
              }}
            >
              <LogOut className="ms-1 h-4 w-4" /> مغادرة
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {players.map((p) => (
              <div
                key={p.id}
                className={`panel-royal rounded-xl p-3 text-center text-sm ${
                  activeSeat?.color === p.color ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="text-xl">{p.is_bot ? "🤖" : "🎭"}</div>
                <div className="truncate font-bold">{p.bot_name ?? (p.user_id === user?.id ? "أنت" : "لاعب")}</div>
                <div className="text-xs text-muted-foreground">{colorLabel(p.color as Color)}</div>
              </div>
            ))}
          </div>

          {state ? (
            <>
              <div className="mx-auto w-full max-w-xl">
                <LudoBoard
                  state={state}
                  movablePieces={movable}
                  activeColor={activeSeat?.color}
                  myColor={myColor}
                  onPieceClick={(piece) => void doMove(piece)}
                />
              </div>
              <div className="panel-royal flex items-center justify-between gap-4 rounded-2xl p-4">
                <div>
                  <p className="font-bold">{state.finished ? "انتهت المباراة" : isMyTurn ? "دورك الآن" : `دور ${colorLabel(activeSeat!.color)}`}</p>
                  <p className="text-xs text-muted-foreground">{state.lastEvent}</p>
                </div>
                <div className="flex items-center gap-3">
                  <DiceView value={state.dice} rolling={rolling} />
                  <Button size="lg" disabled={!isMyTurn || state.dice !== null} onClick={() => void doRoll()}>
                    ارمِ النرد
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel-royal rounded-2xl p-8 text-center">
              <p className="text-muted-foreground">
                بانتظار انضمام اللاعبين… {players.length}/{room.max_players}
              </p>
            </div>
          )}
        </div>

        <aside className="panel-royal flex h-[520px] flex-col rounded-2xl p-3">
          <h2 className="mb-2 font-display text-lg font-bold text-primary">الدردشة</h2>
          <div ref={chatRef} className="flex-1 space-y-2 overflow-y-auto pe-1">
            {messages.map((m) => {
              const prof = profiles.find((p) => p.id === m.user_id);
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary/20" : "bg-card"}`}>
                    <span className="block text-[11px] text-muted-foreground">{prof?.avatar} {prof?.username ?? "لاعب"}</span>
                    {m.content}
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <p className="pt-6 text-center text-xs text-muted-foreground">لا رسائل بعد</p>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="rounded-lg border border-border px-2 py-1 text-lg"
                onClick={() => {
                  setMessage("");
                  if (roomId) void chat({ data: { roomId, content: e } }).catch(() => undefined);
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={message}
              maxLength={200}
              placeholder="اكتب رسالة…"
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
            />
            <Button size="icon" onClick={() => void send()} aria-label="إرسال">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function colorLabel(color: Color) {
  return { red: "الأحمر", green: "الأخضر", yellow: "الأصفر", blue: "الأزرق" }[color] ?? color;
}