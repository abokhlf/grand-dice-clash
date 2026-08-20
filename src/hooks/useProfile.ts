import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myProfileFn } from "@/lib/game.functions";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(myProfileFn);
  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      return await fetchProfile();
    },
  });
  return { profile: query.data ?? null, isLoading: loading || query.isLoading, refetch: query.refetch, user };
}