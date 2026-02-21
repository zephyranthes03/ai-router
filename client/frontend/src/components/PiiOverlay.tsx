import { useState } from "react";
import type { PiiDetection, PiiReport } from "../types";

interface PiiOverlayProps {
  originalText: string;
  maskedText: string;           // text masked per global pii_mode setting
  strictMaskedText: string;     // text with ALL detections masked (from backend)
  maskMap: Record<string, string>; // [PLACEHOLDER] -> original (for display info)
  piiReport: PiiReport;
  onConfirm: (textToSend: string) => void; // called with chosen text
  onCancel: () => void;
}

type SendMode = "original" | "permissive" | "strict";
type HoveredMode = SendMode | null;

// ─── Severity color tokens ────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-900/60 text-red-300 border-red-700",
  high: "bg-orange-900/60 text-orange-300 border-orange-700",
  medium: "bg-yellow-900/60 text-yellow-300 border-yellow-700",
  low: "bg-blue-900/60 text-blue-300 border-blue-700",
};

const PASS_COLORS = "bg-green-900/40 text-green-400 border-green-700";

// Forced-mask color used in "strict" preview — everything treated as masked
const STRICT_MASK_COLORS = "bg-orange-900/60 text-orange-300 border-orange-700";

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Returns a copy of originalText where only critical-severity detections
 * that carry a placeholder are replaced with that placeholder.
 */
function computePermissiveMasked(
  originalText: string,
  detections: PiiDetection[]
): string {
  const sorted = [...detections]
    .filter((d) => d.severity === "critical" && d.placeholder)
    .sort((a, b) => b.start - a.start); // descending to safely splice in-place
  let text = originalText;
  for (const det of sorted) {
    text = text.slice(0, det.start) + det.placeholder! + text.slice(det.end);
  }
  return text;
}

// ─── HighlightedText ─────────────────────────────────────────────────────────

/**
 * Renders `text` (the original) with coloured spans over detected PII ranges.
 *
 * mode behaviour:
 *   "original"   — show each detection with its real severity colour; passing
 *                  detections shown in green (current behaviour).
 *   "permissive" — only critical detections are highlighted; rest shown plain.
 *   "strict"     — every detection is highlighted in the orange "will be masked" colour.
 */
function HighlightedText({
  text,
  detections,
  mode,
}: {
  text: string;
  detections: PiiDetection[];
  mode: SendMode;
}) {
  if (detections.length === 0) {
    return <span>{text}</span>;
  }

  // Filter which detections are visually highlighted based on mode
  const activeDetections = detections.filter((d) => {
    if (mode === "permissive") return d.severity === "critical";
    return true; // "original" and "strict" show all
  });

  // Build a sorted, non-overlapping set
  const sorted = [...activeDetections].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  sorted.forEach((det, i) => {
    if (det.start > lastEnd) {
      parts.push(
        <span key={`t-${i}`}>{text.slice(lastEnd, det.start)}</span>
      );
    }

    let colors: string;
    let titleText: string;

    if (mode === "strict") {
      colors = STRICT_MASK_COLORS;
      titleText = `${det.type} (${det.severity}) — will be masked`;
    } else if (mode === "permissive") {
      // Only critical ones reach here
      colors = SEVERITY_COLORS.critical;
      titleText = `${det.type} (critical) — will be masked`;
    } else {
      // original mode — preserve existing pass/mask distinction
      const isPassing = det.action === "pass";
      colors = isPassing
        ? PASS_COLORS
        : SEVERITY_COLORS[det.severity] || SEVERITY_COLORS.medium;
      titleText = isPassing
        ? `${det.type} (${det.severity}) — passed through in permissive mode`
        : `${det.type} (${det.severity}) — will be masked`;
    }

    parts.push(
      <span
        key={`d-${i}`}
        className={`px-0.5 rounded border ${colors}`}
        title={titleText}
      >
        {text.slice(det.start, det.end)}
      </span>
    );
    lastEnd = det.end;
  });

  if (lastEnd < text.length) {
    parts.push(<span key="tail">{text.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

// ─── Preview renderer ─────────────────────────────────────────────────────────

/**
 * Renders the text preview area. When a send mode is hovered we show what
 * will actually be sent; otherwise we show the highlighted original.
 */
function TextPreview({
  originalText,
  strictMaskedText,
  detections,
  hoveredMode,
}: {
  originalText: string;
  strictMaskedText: string;
  detections: PiiDetection[];
  hoveredMode: HoveredMode;
}) {
  if (hoveredMode === null) {
    // Default: show highlighted original (no specific mode preview)
    return (
      <HighlightedText
        text={originalText}
        detections={detections}
        mode="original"
      />
    );
  }

  if (hoveredMode === "original") {
    // Show highlighted original so the user sees what is exposed
    return (
      <HighlightedText
        text={originalText}
        detections={detections}
        mode="original"
      />
    );
  }

  if (hoveredMode === "permissive") {
    const permissiveText = computePermissiveMasked(originalText, detections);
    // Render the already-substituted text — critical placeholders are embedded,
    // so we just show the plain masked string in a muted colour for legibility.
    return (
      <span className="text-yellow-100/80">{permissiveText}</span>
    );
  }

  // strict
  return (
    <span className="text-orange-200/80">{strictMaskedText}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PiiOverlay({
  originalText,
  maskedText: _maskedText,
  strictMaskedText,
  maskMap: _maskMap,
  piiReport,
  onConfirm,
  onCancel,
}: PiiOverlayProps) {
  const [hoveredMode, setHoveredMode] = useState<HoveredMode>(null);

  const maskedDetections = piiReport.detections.filter(
    (d) => d.action === "mask"
  );
  const passingDetections = piiReport.detections.filter(
    (d) => d.action === "pass"
  );
  const criticalCount = piiReport.detections.filter(
    (d) => d.severity === "critical"
  ).length;

  const handleSend = (mode: SendMode) => {
    if (mode === "original") {
      onConfirm(originalText);
    } else if (mode === "permissive") {
      onConfirm(computePermissiveMasked(originalText, piiReport.detections));
    } else {
      onConfirm(strictMaskedText);
    }
  };

  // Human-readable label for the preview label
  const previewLabel: Record<SendMode, string> = {
    original: "Previewing: original text (no masking)",
    permissive: "Previewing: critical items masked",
    strict: "Previewing: all detected items masked",
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            {/* Shield icon */}
            <svg
              className="w-4 h-4 text-amber-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <h3 className="font-semibold text-sm text-gray-100 tracking-tight">
              PII Detected
            </h3>

            {/* Detection badges */}
            {piiReport.has_critical && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-900/70 text-red-300 border border-red-800 font-medium">
                {criticalCount} critical
              </span>
            )}
            {maskedDetections.length > 0 && !piiReport.has_critical && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-900/50 text-orange-400 border border-orange-800">
                {maskedDetections.length} masked
              </span>
            )}
            {passingDetections.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-900">
                {passingDetections.length} low-risk
              </span>
            )}
          </div>

          {/* Preview mode label — shows when hovering a send button */}
          <div className="text-xs text-gray-500 transition-all duration-150">
            {hoveredMode !== null ? (
              <span className="text-gray-400">{previewLabel[hoveredMode]}</span>
            ) : (
              <span>Hover a send option to preview</span>
            )}
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">

          {/* Text preview */}
          <div
            className={`text-sm whitespace-pre-wrap leading-relaxed font-mono bg-gray-900 rounded-lg px-4 py-3 border transition-colors duration-150 ${
              hoveredMode === "original"
                ? "border-gray-600"
                : hoveredMode === "permissive"
                ? "border-yellow-800/60"
                : hoveredMode === "strict"
                ? "border-orange-800/60"
                : "border-gray-800"
            }`}
          >
            <TextPreview
              originalText={originalText}
              strictMaskedText={strictMaskedText}
              detections={piiReport.detections}
              hoveredMode={hoveredMode}
            />
          </div>

          {/* Detections list */}
          {piiReport.detections.length > 0 && (
            <div className="space-y-2">
              {maskedDetections.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                    Will be masked
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {maskedDetections.map((det, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
                          SEVERITY_COLORS[det.severity] || SEVERITY_COLORS.medium
                        }`}
                        title={`${det.source} · "${det.value}"`}
                      >
                        <span className="font-mono">{det.type}</span>
                        <span className="opacity-50">·</span>
                        <span className="opacity-70">{det.severity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {passingDetections.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs text-gray-500 font-medium uppercase tracking-widest">
                    Passing through
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {passingDetections.map((det, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${PASS_COLORS}`}
                        title={`${det.source} · "${det.value}" — low risk, not masked`}
                      >
                        <span className="font-mono">{det.type}</span>
                        <span className="opacity-50">·</span>
                        <span className="opacity-70">{det.severity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-800 px-5 py-4">
          <p className="text-xs text-gray-500 mb-3">
            How would you like to send this message?
          </p>

          <div className="flex items-stretch gap-2">

            {/* ── Option 1: Original ─────────────────────────── */}
            <button
              onClick={() => !piiReport.has_critical && handleSend("original")}
              onMouseEnter={() => setHoveredMode("original")}
              onMouseLeave={() => setHoveredMode(null)}
              disabled={piiReport.has_critical}
              title={
                piiReport.has_critical
                  ? "Cannot send original — critical PII would be exposed"
                  : "Send message without any masking"
              }
              className={`
                group flex-1 flex flex-col items-start gap-0.5
                px-3.5 py-2.5 rounded-lg border text-left
                transition-all duration-150
                ${
                  piiReport.has_critical
                    ? "border-gray-800 bg-gray-900/40 cursor-not-allowed opacity-40"
                    : hoveredMode === "original"
                    ? "border-gray-500 bg-gray-800 shadow-sm"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/70"
                }
              `}
            >
              <div className="flex items-center gap-1.5 w-full">
                {/* Lock-open icon */}
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                    piiReport.has_critical
                      ? "text-gray-600"
                      : hoveredMode === "original"
                      ? "text-gray-200"
                      : "text-gray-400"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                <span className="text-xs font-semibold text-gray-200">
                  Send Original
                </span>
                {piiReport.has_critical && (
                  <svg
                    className="w-3 h-3 ml-auto text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-500 pl-5">No masking applied</span>
            </button>

            {/* ── Option 2: Permissive ───────────────────────── */}
            <button
              onClick={() => handleSend("permissive")}
              onMouseEnter={() => setHoveredMode("permissive")}
              onMouseLeave={() => setHoveredMode(null)}
              className={`
                group flex-1 flex flex-col items-start gap-0.5
                px-3.5 py-2.5 rounded-lg border text-left
                transition-all duration-150
                ${
                  hoveredMode === "permissive"
                    ? "border-indigo-500 bg-indigo-950/60 shadow-sm shadow-indigo-900/40"
                    : "border-indigo-800/60 bg-gray-900 hover:border-indigo-600 hover:bg-indigo-950/30"
                }
              `}
            >
              <div className="flex items-center gap-1.5">
                {/* Half-lock icon (shield-check variant) */}
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                    hoveredMode === "permissive" ? "text-indigo-300" : "text-indigo-500"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span
                  className={`text-xs font-semibold transition-colors ${
                    hoveredMode === "permissive" ? "text-indigo-200" : "text-indigo-300"
                  }`}
                >
                  Send Permissive
                </span>
              </div>
              <span className="text-xs text-gray-500 pl-5">Critical items masked only</span>
            </button>

            {/* ── Option 3: Strict ───────────────────────────── */}
            <button
              onClick={() => handleSend("strict")}
              onMouseEnter={() => setHoveredMode("strict")}
              onMouseLeave={() => setHoveredMode(null)}
              className={`
                group flex-1 flex flex-col items-start gap-0.5
                px-3.5 py-2.5 rounded-lg border text-left
                transition-all duration-150
                ${
                  hoveredMode === "strict"
                    ? "border-orange-500 bg-orange-950/50 shadow-sm shadow-orange-900/40"
                    : "border-orange-800/60 bg-gray-900 hover:border-orange-600 hover:bg-orange-950/20"
                }
              `}
            >
              <div className="flex items-center gap-1.5">
                {/* Lock icon */}
                <svg
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                    hoveredMode === "strict" ? "text-orange-300" : "text-orange-500"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                <span
                  className={`text-xs font-semibold transition-colors ${
                    hoveredMode === "strict" ? "text-orange-200" : "text-orange-300"
                  }`}
                >
                  Send Strict
                </span>
              </div>
              <span className="text-xs text-gray-500 pl-5">All detected items masked</span>
            </button>

            {/* ── Divider + Cancel ───────────────────────────── */}
            <div className="flex items-center pl-1">
              <div className="w-px h-8 bg-gray-800 mr-3" />
              <button
                onClick={onCancel}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1 py-1 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
