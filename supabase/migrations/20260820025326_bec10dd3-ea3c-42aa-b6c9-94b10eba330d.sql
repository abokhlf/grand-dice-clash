DROP POLICY IF EXISTS chat_select_members ON public.chat_messages;
CREATE POLICY chat_select_members ON public.chat_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = chat_messages.room_id AND rp.user_id = auth.uid()));

DROP POLICY IF EXISTS rooms_select_visible ON public.rooms;
CREATE POLICY rooms_select_visible ON public.rooms FOR SELECT TO authenticated
USING (
  is_public = true
  OR host_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = rooms.id AND rp.user_id = auth.uid())
);

DROP FUNCTION IF EXISTS public.is_room_member(uuid, uuid);
DROP VIEW IF EXISTS public.public_profiles;

-- profiles: rows readable (leaderboard/opponents) but coin balance is not exposed to clients
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, avatar, games, wins, streak, best_streak, equipped_piece, equipped_board, equipped_dice, created_at, updated_at)
  ON public.profiles TO authenticated;