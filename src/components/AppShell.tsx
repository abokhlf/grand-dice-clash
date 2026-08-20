import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Coins, LogOut, Store, Trophy, User as UserIcon, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { isMuted, setMuted, sfx } from "@/lib/sound";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const [muted, setLocalMuted] = useState(false);

  useEffect(() => setLocalMuted(isMuted()), []);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setLocalMuted(next);
    if (!next) sfx.click();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-primary/20 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2" onClick={() => sfx.click()}>
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/50 text-lg" style={{ background: "var(--gradient-gold)" }}>
              🎲
            </span>
            <span className="font-display text-lg font-bold text-gold-gradient sm:text-xl">ديوان اللودو</span>
          </Link>
          <div className="flex-1" />
          {profile && (
            <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-card/70 px-3 py-1 text-sm font-bold text-primary">
              <Coins className="h-4 w-4" />
              {profile.coins}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={toggleSound} aria-label="كتم الصوت">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="المتجر">
            <Link to="/shop"><Store className="h-5 w-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="المتصدرون">
            <Link to="/leaderboard"><Trophy className="h-5 w-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label="ملفي">
            <Link to="/profile"><UserIcon className="h-5 w-5" /></Link>
          </Button>
          {profile && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="خروج"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6">{children}</main>
    </div>
  );
}