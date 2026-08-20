-- helper: is user a member of a room
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_players rp WHERE rp.room_id = _room_id AND rp.user_id = _user_id);
$$;

-- chat messages: only room members
DROP POLICY IF EXISTS chat_select_all ON public.chat_messages;
CREATE POLICY chat_select_members ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_room_member(room_id, auth.uid()));

-- rooms: public rooms, own rooms, or rooms the user is in
DROP POLICY IF EXISTS rooms_select_all ON public.rooms;
CREATE POLICY rooms_select_visible ON public.rooms FOR SELECT TO authenticated
USING (is_public = true OR host_id = auth.uid() OR public.is_room_member(id, auth.uid()));

-- player achievements: own only
DROP POLICY IF EXISTS player_achievements_select_all ON public.player_achievements;
CREATE POLICY player_achievements_select_own ON public.player_achievements FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- profiles: own row only; public view for leaderboard/room display
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, username, avatar, wins, games, streak, best_streak,
       equipped_piece, equipped_board, equipped_dice
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;