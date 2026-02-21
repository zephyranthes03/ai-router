/**
 * ERC-8021 Builder Code Attribution
 *
 * Generates a dataSuffix to append to on-chain transaction calldata,
 * attributing on-chain activity to this ProofRoute AI application.
 *
 * Standard: https://docs.base.org/base-chain/quickstart/builder-codes
 * Register your code at: https://base.dev Settings → Builder Code
 */

/** ERC-8021 marker: 16 bytes of repeating 0x8021 */
const ERC_MARKER_HEX = "80218021802180218021802180218021";

/**
 * Generates the ERC-8021 Schema-0 data suffix for a builder code string.
 * Format (parsed backwards):
 *   [codes_length (1 byte)] [codes (N bytes, ASCII)] [schema_id (0x00)] [erc_marker (16 bytes)]
 */
function buildErc8021DataSuffix(code: string): `0x${string}` {
  const codeBytes = new TextEncoder().encode(code);
  const len = codeBytes.length;
  // schema ID 0x00
  const parts = [
    len.toString(16).padStart(2, "0"),
    Array.from(codeBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    "00",
    ERC_MARKER_HEX,
  ];
  return `0x${parts.join("")}`;
}

/**
 * The builder code for this application.
 * Set VITE_BUILDER_CODE in your .env.local to override with your registered base.dev code.
 * Default: "ai-router" (for development/testing attribution only)
 */
const BUILDER_CODE = import.meta.env.VITE_BUILDER_CODE ?? "ai-router";

/**
 * The pre-computed ERC-8021 dataSuffix for this application.
 * Append to any on-chain transaction calldata to attribute it to ai-router.
 */
export const BUILDER_DATA_SUFFIX: `0x${string}` =
  buildErc8021DataSuffix(BUILDER_CODE);

export { BUILDER_CODE };
