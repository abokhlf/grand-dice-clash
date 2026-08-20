import { COLORS, type Color } from "./ludo/board";
import {
  applyMove,
  applyRoll,
  createInitialState,
  currentSeat,
  legalMoves,
  pickBotMove,
  type GameState,
  type Seat,
} from "./ludo/engine";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

const BOT_NAMES = ["زيد الآلي", "سلمى الآلية", "فارس الآلي", "نجود الآلية"];
const BOT_AVATARS = ["🤖", "🦾", "🛡️", "🎯"];
export const TURN_SECONDS = 45;

export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = new Uint32Array(6);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 6; i++) out += alphabet[buf[i]! % alphabet.length];
  return out;
}

export async function getProfile(db: Admin, userId: string) {
  const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

export async function loadRoomByCode(db: Admin, code: string) {
  const { data } = await db.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  return data;
}

export async function seatsForRoom(db: Admin, roomId: string): Promise<Seat[]> {
  const { data: players } = await db
    .from("room_players")
    .select("*")
    .eq("room_id", roomId)
    .order("seat", { ascending: true });
  const rows = players ?? [];
  const userIds = rows.map((r) => r.user_id).filter((v): v is string => Boolean(v));
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, username, avatar").in("id", userIds)
    : { data: [] as Array<{ id: string; username: string; avatar: string }> };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((row, i) => ({
    color: row.color as Color,
    userId: row.user_id,
    name: row.is_bot ? (row.bot_name ?? BOT_NAMES[i % BOT_NAMES.length]!) : (byId.get(row.user_id!)?.username ?? "لاعب"),
    avatar: row.is_bot ? BOT_AVATARS[i % BOT_AVATARS.length]! : (byId.get(row.user_id!)?.avatar ?? "🦁"),
    isBot: row.is_bot,
  }));
}

export async function nextFreeSeat(db: Admin, roomId: string) {
  const { data } = await db.from("room_players").select("seat, color").eq("room_id", roomId);
  const taken = new Set((data ?? []).map((r) => r.seat));
  for (let i = 0; i < 4; i++) if (!taken.has(i)) return { seat: i, color: COLORS[i]! };
  return null;
}

export async function createRoom(
  db: Admin,
  userId: string,
  opts: { isPublic: boolean; maxPlayers: number; bots: number },
) {
  await leaveAllRooms(db, userId);
  let code = makeCode();
  for (let i = 0; i < 5; i++) {
    const existing = await loadRoomByCode(db, code);
    if (!existing) break;
    code = makeCode();
  }
  const { data: room, error } = await db
    .from("rooms")
    .insert({
      code,
      host_id: userId,
      max_players: opts.maxPlayers,
      is_public: opts.isPublic,
    })
    .select()
    .single();
  if (error || !room) throw new Error(error?.message ?? "تعذر إنشاء الغرفة");

  await db.from("room_players").insert({
    room_id: room.id,
    user_id: userId,
    color: COLORS[0]!,
    seat: 0,
    is_ready: true,
  });

  for (let i = 0; i < opts.bots; i++) {
    const slot = i + 1;
    if (slot >= opts.maxPlayers) break;
    await db.from("room_players").insert({
      room_id: room.id,
      color: COLORS[slot]!,
      seat: slot,
      is_ready: true,
      is_bot: true,
      bot_name: BOT_NAMES[i % BOT_NAMES.length]!,
    });
  }
  return room;
}

export async function leaveAllRooms(db: Admin, userId: string) {
  const { data: memberships } = await db
    .from("room_players")
    .select("room_id")
    .eq("user_id", userId);
  for (const m of memberships ?? []) await leaveRoom(db, userId, m.room_id);
}

export async function leaveRoom(db: Admin, userId: string, roomId: string) {
  const { data: room } = await db.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return;
  await db.from("room_players").delete().eq("room_id", roomId).eq("user_id", userId);
  const { data: rest } = await db
    .from("room_players")
    .select("id, is_bot")
    .eq("room_id", roomId);
  const humans = (rest ?? []).filter((r) => !r.is_bot);
  if (humans.length === 0) {
    await db.from("rooms").delete().eq("id", roomId);
    return;
  }
  if (room.host_id === userId) {
    const { data: nextHost } = await db
      .from("room_players")
      .select("user_id")
      .eq("room_id", roomId)
      .not("user_id", "is", null)
      .order("seat", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextHost?.user_id) await db.from("rooms").update({ host_id: nextHost.user_id }).eq("id", roomId);
  }
}

export async function joinRoom(db: Admin, userId: string, code: string) {
  const room = await loadRoomByCode(db, code);
  if (!room) throw new Error("لا توجد غرفة بهذا الكود");
  const { data: already } = await db
    .from("room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (already) return room;
  if (room.status !== "lobby") throw new Error("المباراة بدأت بالفعل");
  const { count } = await db
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= room.max_players) throw new Error("الغرفة ممتلئة");
  await leaveAllRooms(db, userId);
  const slot = await nextFreeSeat(db, room.id);
  if (!slot) throw new Error("الغرفة ممتلئة");
  await db.from("room_players").insert({
    room_id: room.id,
    user_id: userId,
    color: slot.color,
    seat: slot.seat,
  });
  return room;
}

export async function startMatch(db: Admin, userId: string, roomId: string) {
  const { data: room } = await db.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) throw new Error("الغرفة غير موجودة");
  if (room.host_id !== userId) throw new Error("المضيف فقط يمكنه بدء المباراة");
  const seats = await seatsForRoom(db, roomId);
  if (seats.length < 2) throw new Error("تحتاج لاعبين اثنين على الأقل");
  const state = createInitialState(seats);
  await db.from("matches").upsert(
    { room_id: roomId, state: state as unknown as Record<string, unknown>, status: "playing", winner_order: [] },
    { onConflict: "room_id" },
  );
  await db.from("rooms").update({ status: "playing" }).eq("id", roomId);
  return state;
}

async function loadMatch(db: Admin, roomId: string) {
  const { data } = await db.from("matches").select("*").eq("room_id", roomId).maybeSingle();
  if (!data) throw new Error("المباراة غير موجودة");
  return { row: data, state: data.state as unknown as GameState };
}

async function saveState(db: Admin, roomId: string, state: GameState) {
  const finished = state.finished;
  await db
    .from("matches")
    .update({
      state: state as unknown as Record<string, unknown>,
      status: finished ? "finished" : "playing",
      winner_order: state.ranking,
    })
    .eq("room_id", roomId);
  if (finished) {
    await db.from("rooms").update({ status: "finished" }).eq("id", roomId);
    await settleRewards(db, state);
  }
}

async function settleRewards(db: Admin, state: GameState) {
  for (const seat of state.seats) {
    if (!seat.userId || seat.isBot) continue;
    const place = state.ranking.indexOf(seat.color);
    const won = place === 0;
    const reward = won ? 300 : place === 1 ? 150 : 60;
    const profile = await getProfile(db, seat.userId);
    if (!profile) continue;
    const streak = won ? profile.streak + 1 : 0;
    await db
      .from("profiles")
      .update({
        coins: profile.coins + reward,
        games: profile.games + 1,
        wins: profile.wins + (won ? 1 : 0),
        streak,
        best_streak: Math.max(profile.best_streak, streak),
      })
      .eq("id", seat.userId);

    const wins = profile.wins + (won ? 1 : 0);
    const earned: string[] = ["first_game"];
    if (wins >= 1) earned.push("first_win");
    if (wins >= 5) earned.push("five_wins");
    if (wins >= 20) earned.push("twenty_wins");
    if (streak >= 3) earned.push("streak_three");
    if ((state.captures[seat.color] ?? 0) >= 5) earned.push("hunter");
    for (const id of earned) {
      await db
        .from("player_achievements")
        .upsert({ user_id: seat.userId, achievement_id: id }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
    }
  }
}

function assertTurn(state: GameState, userId: string) {
  const seat = currentSeat(state);
  if (seat.userId !== userId) throw new Error("ليس دورك");
}

export async function rollDice(db: Admin, userId: string, roomId: string) {
  const { state } = await loadMatch(db, roomId);
  if (state.finished) throw new Error("انتهت المباراة");
  assertTurn(state, userId);
  if (state.dice !== null) throw new Error("لقد رميت النرد بالفعل");
  const result = applyRoll(state);
  await saveState(db, roomId, result.state);
  return result.state;
}

export async function movePiece(db: Admin, userId: string, roomId: string, piece: number) {
  const { state } = await loadMatch(db, roomId);
  if (state.finished) throw new Error("انتهت المباراة");
  assertTurn(state, userId);
  const result = applyMove(state, piece);
  await saveState(db, roomId, result.state);
  return result.state;
}

/** Advance a bot seat, or auto-play a human whose timer expired. */
export async function autoStep(db: Admin, roomId: string) {
  const { state } = await loadMatch(db, roomId);
  if (state.finished) return state;
  const seat = currentSeat(state);
  const elapsed = (Date.now() - new Date(state.turnStartedAt).getTime()) / 1000;
  if (!seat.isBot && elapsed < TURN_SECONDS) return state;

  let working = state;
  if (working.dice === null) working = applyRoll(working).state;
  if (working.finished || working.dice === null) {
    await saveState(db, roomId, working);
    return working;
  }
  const stillSame = currentSeat(working).color === seat.color;
  if (!stillSame) {
    await saveState(db, roomId, working);
    return working;
  }
  const moves = legalMoves(working, seat.color, working.dice);
  if (moves.length > 0) {
    const piece = pickBotMove(working);
    if (piece >= 0) working = applyMove(working, piece).state;
  }
  await saveState(db, roomId, working);
  return working;
}

export async function sendChat(db: Admin, userId: string, roomId: string, content: string) {
  const trimmed = content.trim().slice(0, 200);
  if (!trimmed) throw new Error("رسالة فارغة");
  const { data: member } = await db
    .from("room_players")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("لست في هذه الغرفة");
  await db.from("chat_messages").insert({ room_id: roomId, user_id: userId, content: trimmed });
}

export async function buyItem(db: Admin, userId: string, itemId: string) {
  const { data: item } = await db.from("items").select("*").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("العنصر غير موجود");
  const profile = await getProfile(db, userId);
  if (!profile) throw new Error("لا يوجد ملف شخصي");
  const { data: owned } = await db
    .from("player_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (!owned) {
    if (profile.coins < item.price) throw new Error("لا تملك عملات كافية");
    await db.from("player_items").insert({ user_id: userId, item_id: itemId });
    await db.from("profiles").update({ coins: profile.coins - item.price }).eq("id", userId);
  }
  const field =
    item.kind === "piece" ? "equipped_piece" : item.kind === "board" ? "equipped_board" : "equipped_dice";
  await db.from("profiles").update({ [field]: itemId }).eq("id", userId);
  return { ok: true };
}

export async function equipItem(db: Admin, userId: string, itemId: string) {
  const { data: item } = await db.from("items").select("*").eq("id", itemId).maybeSingle();
  if (!item) throw new Error("العنصر غير موجود");
  if (item.price > 0) {
    const { data: owned } = await db
      .from("player_items")
      .select("item_id")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .maybeSingle();
    if (!owned) throw new Error("لا تملك هذا العنصر");
  }
  const field =
    item.kind === "piece" ? "equipped_piece" : item.kind === "board" ? "equipped_board" : "equipped_dice";
  await db.from("profiles").update({ [field]: itemId }).eq("id", userId);
  return { ok: true };
}

export async function quickMatch(db: Admin, userId: string) {
  const { data: rooms } = await db
    .from("rooms")
    .select("*")
    .eq("status", "lobby")
    .eq("is_public", true)
    .order("created_at", { ascending: true })
    .limit(10);
  for (const room of rooms ?? []) {
    const { count } = await db
      .from("room_players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    if ((count ?? 0) < room.max_players) {
      try {
        return await joinRoom(db, userId, room.code);
      } catch {
        continue;
      }
    }
  }
  return await createRoom(db, userId, { isPublic: true, maxPlayers: 4, bots: 0 });
}