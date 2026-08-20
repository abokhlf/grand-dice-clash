type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function adminClient(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

export async function overview(db: Admin) {
  const [players, rooms, matches, messages] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("rooms").select("id", { count: "exact", head: true }),
    db.from("matches").select("id", { count: "exact", head: true }),
    db.from("chat_messages").select("id", { count: "exact", head: true }),
  ]);
  return {
    players: players.count ?? 0,
    rooms: rooms.count ?? 0,
    matches: matches.count ?? 0,
    messages: messages.count ?? 0,
  };
}

export async function listPlayers(db: Admin, search: string) {
  let q = db
    .from("profiles")
    .select("id, username, avatar, coins, games, wins, streak, best_streak, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (search.trim()) q = q.ilike("username", `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRooms(db: Admin) {
  const { data, error } = await db
    .from("rooms")
    .select("id, code, status, is_public, max_players, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updatePlayer(
  db: Admin,
  userId: string,
  patch: { coins?: number; username?: string; wins?: number; games?: number },
) {
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteRoom(db: Admin, roomId: string) {
  await db.from("chat_messages").delete().eq("room_id", roomId);
  await db.from("matches").delete().eq("room_id", roomId);
  await db.from("room_players").delete().eq("room_id", roomId);
  const { error } = await db.from("rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setRole(db: Admin, userId: string, role: "admin" | "moderator" | "user", grant: boolean) {
  if (grant) {
    const { error } = await db.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}
