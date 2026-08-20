import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isAdminFn } from "@/lib/admin.functions";
import { useAuth } from "./useAuth";

export function useIsAdmin() {
  const { user } = useAuth();
  const check = useServerFn(isAdminFn);
  const q = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => (await check()).isAdmin,
  });
  return { isAdmin: q.data === true, isLoading: q.isLoading };
}
