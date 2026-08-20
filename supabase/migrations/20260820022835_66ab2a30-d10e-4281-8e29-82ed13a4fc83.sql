-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar text NOT NULL DEFAULT '🦁',
  coins integer NOT NULL DEFAULT 500,
  games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  equipped_piece text NOT NULL DEFAULT 'piece_classic',
  equipped_board text NOT NULL DEFAULT 'board_heritage',
  equipped_dice text NOT NULL DEFAULT 'dice_gold',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'username', ''), 'لاعب ' || substr(NEW.id::text, 1, 4)),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'avatar', ''), '🦁')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROOMS
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'lobby',
  max_players integer NOT NULL DEFAULT 4,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select_all" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE TRIGGER rooms_touch BEFORE UPDATE ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ROOM PLAYERS
CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_name text,
  color text NOT NULL,
  seat integer NOT NULL,
  is_ready boolean NOT NULL DEFAULT false,
  is_bot boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, color),
  UNIQUE (room_id, seat)
);
CREATE UNIQUE INDEX room_players_unique_user ON public.room_players (room_id, user_id) WHERE user_id IS NOT NULL;
GRANT SELECT ON public.room_players TO authenticated;
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_players_select_all" ON public.room_players FOR SELECT TO authenticated USING (true);

-- MATCHES
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  status text NOT NULL DEFAULT 'playing',
  winner_order text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE TRIGGER matches_touch BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CHAT
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_room_idx ON public.chat_messages (room_id, created_at DESC);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_select_all" ON public.chat_messages FOR SELECT TO authenticated USING (true);

-- SHOP ITEMS
CREATE TABLE public.items (
  id text PRIMARY KEY,
  kind text NOT NULL,
  name_ar text NOT NULL,
  description_ar text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  preview text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_all" ON public.items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.player_items TO authenticated;
GRANT ALL ON public.player_items TO service_role;
ALTER TABLE public.player_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_items_select_own" ON public.player_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ACHIEVEMENTS
CREATE TABLE public.achievements (
  id text PRIMARY KEY,
  name_ar text NOT NULL,
  description_ar text NOT NULL,
  icon text NOT NULL DEFAULT '🏅',
  reward integer NOT NULL DEFAULT 0,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_select_all" ON public.achievements FOR SELECT TO authenticated USING (true);

CREATE TABLE public.player_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT ON public.player_achievements TO authenticated;
GRANT ALL ON public.player_achievements TO service_role;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_achievements_select_all" ON public.player_achievements FOR SELECT TO authenticated USING (true);

-- SEED SHOP
INSERT INTO public.items (id, kind, name_ar, description_ar, price, preview, sort) VALUES
('piece_classic', 'piece', 'القطع الكلاسيكية', 'قطع تقليدية أنيقة', 0, 'classic', 1),
('piece_gold', 'piece', 'قطع الذهب الخالص', 'لمعة ذهبية فاخرة', 800, 'gold', 2),
('piece_pearl', 'piece', 'قطع اللؤلؤ', 'لمسة لؤلؤية ناعمة', 1200, 'pearl', 3),
('piece_gem', 'piece', 'قطع الجواهر', 'جواهر متلألئة نادرة', 2500, 'gem', 4),
('board_heritage', 'board', 'اللوح التراثي', 'زخارف إسلامية بفيروزي وعنابي', 0, 'heritage', 1),
('board_night', 'board', 'ليل الصحراء', 'أزرق ليلي مع نجوم ذهبية', 900, 'night', 2),
('board_royal', 'board', 'القصر الملكي', 'رخام وذهب ملكي', 2000, 'royal', 3),
('dice_gold', 'dice', 'نرد ذهبي', 'النرد الافتراضي الفاخر', 0, 'gold', 1),
('dice_ivory', 'dice', 'نرد عاجي', 'أبيض عاجي بنقوش', 600, 'ivory', 2),
('dice_ruby', 'dice', 'نرد الياقوت', 'أحمر ياقوتي متوهج', 1500, 'ruby', 3);

INSERT INTO public.achievements (id, name_ar, description_ar, icon, reward, sort) VALUES
('first_game', 'أول خطوة', 'أكمل أول مباراة لك', '🎲', 50, 1),
('first_win', 'الفوز الأول', 'اربح مباراتك الأولى', '🏆', 150, 2),
('five_wins', 'خماسية', 'اربح 5 مباريات', '⭐', 300, 3),
('twenty_wins', 'أسطورة اللودو', 'اربح 20 مباراة', '👑', 1000, 4),
('streak_three', 'سلسلة نار', 'اربح 3 مباريات متتالية', '🔥', 400, 5),
('hunter', 'الصياد', 'كُل 5 قطع في مباراة واحدة', '🎯', 250, 6);

-- REALTIME
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;