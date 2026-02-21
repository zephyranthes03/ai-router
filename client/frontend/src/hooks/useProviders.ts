/**
 * React hook for fetching available AI providers from the server.
 */

import { useQuery } from "@tanstack/react-query";
import { getProviders } from "../lib/serverApi";
import type { Provider } from "../types";

export function useProviders() {
  return useQuery<Provider[], Error>({
    queryKey: ["providers"],
    queryFn: getProviders,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}
