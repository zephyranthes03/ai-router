/**
 * Hook to fetch server-side usage records from GET /usage.
 * These records include x402 payment txHashes from the facilitator.
 */

import { useQuery } from "@tanstack/react-query";
import { getServerUsage, type ServerUsageResponse } from "../lib/serverApi";

export function useServerUsage() {
  return useQuery<ServerUsageResponse>({
    queryKey: ["server-usage"],
    queryFn: getServerUsage,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
