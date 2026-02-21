/**
 * React hook wrapping the local /analyze endpoint.
 */

import { useMutation } from "@tanstack/react-query";
import { analyze } from "../lib/localApi";
import type { AnalyzeResponse } from "../types";

interface AnalyzeParams {
  message: string;
  tier?: string;
  speedQualityWeight?: number;
}

export function useAnalyze() {
  return useMutation<AnalyzeResponse, Error, AnalyzeParams>({
    mutationFn: ({ message, tier, speedQualityWeight }) =>
      analyze(message, tier, speedQualityWeight),
  });
}
