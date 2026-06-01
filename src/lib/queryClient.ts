import { QueryClient } from "@tanstack/react-query";
import { CACHE_TTL } from "@/lib/clientCache";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TTL.default,
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

export const queryStaleTime = CACHE_TTL;
