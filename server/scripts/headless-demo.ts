/**
 * Headless Autonomous x402 Payment Demo
 *
 * Demonstrates a fully autonomous x402 micropayment flow with NO browser,
 * NO wallet extension, and NO manual clicking. Uses a raw private key to
 * sign EIP-712 TransferWithAuthorization typed data and pays the AI gateway
 * entirely from Node.js.
 *
 * Usage:
 *   cd server && tsx scripts/headless-demo.ts
 *
 * Required env vars (in server/.env):
 *   HEADLESS_PRIVATE_KEY   - 0x-prefixed private key holding USDC on Base Sepolia
 *
 * Optional env vars:
 *   HEADLESS_PROVIDER      - AI provider slug (default: haiku)
 *   HEADLESS_GATEWAY_URL   - Gateway base URL (default: http://localhost:3001)
 *   HEADLESS_MESSAGE       - Message to send to the AI (default: see below)
 */

import { createWalletClient, http, toHex, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import * as path from "path";

// ---------------------------------------------------------------------------
// Load .env from server directory (works regardless of cwd when tsx is run)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------
const PRIVATE_KEY = process.env.HEADLESS_PRIVATE_KEY as `0x${string}` | undefined;
const PROVIDER = process.env.HEADLESS_PROVIDER ?? "haiku";
const GATEWAY_URL = process.env.HEADLESS_GATEWAY_URL ?? "http://localhost:3001";
const MESSAGE =
  process.env.HEADLESS_MESSAGE ?? "Explain what x402 is in one sentence.";

if (!PRIVATE_KEY || PRIVATE_KEY === "0xYourPrivateKeyWithUsdcBalance") {
  console.error(
    "ERROR: HEADLESS_PRIVATE_KEY is not set in server/.env\n" +
      "  Edit server/.env and add your private key (must hold USDC on Base Sepolia)."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// EIP-712 typed data structures for EIP-3009 TransferWithAuthorization
// (matches what @x402/evm uses in chunk-RPL6OFJL.mjs authorizationTypes)
// ---------------------------------------------------------------------------
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// ---------------------------------------------------------------------------
// Utility: base64 encode (works in Node.js)
// ---------------------------------------------------------------------------
function base64Encode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64");
}

function base64Decode(str: string): string {
  return Buffer.from(str, "base64").toString("utf8");
}

// ---------------------------------------------------------------------------
// Utility: create a random 32-byte nonce (bytes32 hex)
// ---------------------------------------------------------------------------
function createNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// ---------------------------------------------------------------------------
// Parse the PAYMENT-REQUIRED header that the x402 middleware sends back
// The header is base64( JSON.stringify(paymentRequired) )
// ---------------------------------------------------------------------------
function decodePaymentRequiredHeader(headerValue: string): any {
  return JSON.parse(base64Decode(headerValue));
}

// ---------------------------------------------------------------------------
// Build the PAYMENT-SIGNATURE header that x402 middleware expects
// Format: base64( JSON.stringify(paymentPayload) )
// ---------------------------------------------------------------------------
function encodePaymentSignatureHeader(paymentPayload: object): string {
  return base64Encode(JSON.stringify(paymentPayload));
}

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------
async function main() {
  // --- Setup wallet ---
  const account = privateKeyToAccount(PRIVATE_KEY!);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  console.log("=== Headless Autonomous x402 Demo ===");
  console.log(`Wallet:   ${account.address}`);
  console.log(`Provider: ${PROVIDER} ($0.001 USDC per request)`);
  console.log(`Gateway:  ${GATEWAY_URL}`);
  console.log("");

  const endpoint = `${GATEWAY_URL}/request/${PROVIDER}`;
  const requestBody = {
    messages: [{ role: "user", content: MESSAGE }],
  };

  // ---------------------------------------------------------------------------
  // Step 1: Send initial request — expect 402 with payment requirements
  // ---------------------------------------------------------------------------
  console.log("[1/3] Sending request to gateway...");

  const initialResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (initialResponse.status !== 402) {
    // If we got a non-402, either payment is disabled (dev mode) or an error.
    if (initialResponse.ok) {
      const data = await initialResponse.json();
      console.log("      Server responded without requiring payment (dev/demo mode).");
      console.log("      Response:", JSON.stringify(data, null, 2));
      return;
    }
    const errText = await initialResponse.text();
    console.error(`ERROR: Expected 402, got ${initialResponse.status}: ${errText}`);
    process.exit(1);
  }

  console.log("      --> 402 received (payment required)");

  // ---------------------------------------------------------------------------
  // Extract payment requirements from the PAYMENT-REQUIRED response header.
  // x402 v2 puts requirements in the header (not the body).
  // The body is typically {} (empty JSON object).
  // ---------------------------------------------------------------------------
  const paymentRequiredHeader =
    initialResponse.headers.get("PAYMENT-REQUIRED") ||
    initialResponse.headers.get("payment-required");

  let paymentRequired: any;

  if (paymentRequiredHeader) {
    // x402 v2 path: requirements are in the PAYMENT-REQUIRED header
    paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
  } else {
    // Fallback: try to read from body (x402 v1 compat)
    try {
      paymentRequired = await initialResponse.json();
    } catch {
      console.error("ERROR: 402 response has no PAYMENT-REQUIRED header and no parseable JSON body.");
      process.exit(1);
    }
  }

  // Validate we have what we need
  if (!paymentRequired || !paymentRequired.accepts || paymentRequired.accepts.length === 0) {
    console.error("ERROR: Could not parse payment requirements from 402 response.");
    console.error("       Raw payment required:", JSON.stringify(paymentRequired, null, 2));
    process.exit(1);
  }

  // Select the first payment requirement (exact scheme on eip155:84532)
  const requirements = paymentRequired.accepts[0];

  console.log(`      Asset:   ${requirements.asset}`);
  console.log(`      Amount:  ${requirements.maxAmountRequired ?? requirements.amount} atomic units`);
  console.log(`      PayTo:   ${requirements.payTo}`);
  console.log(`      Network: ${requirements.network}`);
  console.log(`      Scheme:  ${requirements.scheme}`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Step 2: Sign the EIP-712 TransferWithAuthorization (EIP-3009)
  // This is an off-chain signature — no transaction, no gas fee.
  // ---------------------------------------------------------------------------
  console.log("[2/3] Signing payment authorization (no browser, no clicks)...");

  const now = Math.floor(Date.now() / 1000);
  const maxTimeoutSeconds = requirements.maxTimeoutSeconds ?? 300;
  const amount = requirements.maxAmountRequired ?? requirements.amount;
  const payTo = getAddress(requirements.payTo);
  const asset = getAddress(requirements.asset);
  const nonce = createNonce();

  // EIP-712 domain — read token name/version from requirements.extra if available,
  // otherwise fall back to USDC defaults for Base Sepolia.
  const tokenName = requirements.extra?.name ?? "USD Coin";
  const tokenVersion = requirements.extra?.version ?? "2";

  // chainId from network string "eip155:84532" -> 84532
  const chainId = parseInt(requirements.network.split(":")[1] ?? "84532");

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId,
    verifyingContract: asset,
  };

  const authorization = {
    from: account.address,
    to: payTo,
    value: BigInt(amount),
    validAfter: BigInt(now - 600), // allow 10 min clock skew
    validBefore: BigInt(now + maxTimeoutSeconds),
    nonce,
  };

  const signature = await walletClient.signTypedData({
    domain,
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });

  console.log(`      Signature: ${signature.slice(0, 20)}...${signature.slice(-8)}`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Build the payment payload (x402 v2 format).
  // Structure mirrors what ExactEvmScheme.createPaymentPayload returns +
  // x402Client.createPaymentPayload wraps it with extensions/resource/accepted.
  // ---------------------------------------------------------------------------
  const paymentPayload = {
    x402Version: paymentRequired.x402Version ?? 2,
    payload: {
      authorization: {
        from: account.address,
        to: payTo,
        value: amount.toString(),
        validAfter: (now - 600).toString(),
        validBefore: (now + maxTimeoutSeconds).toString(),
        nonce,
      },
      signature,
    },
    extensions: paymentRequired.extensions ?? undefined,
    resource: paymentRequired.resource ?? undefined,
    accepted: requirements,
  };

  // Encode as base64 for the PAYMENT-SIGNATURE header (x402 v2)
  const paymentSignatureHeader = encodePaymentSignatureHeader(paymentPayload);

  // ---------------------------------------------------------------------------
  // Step 3: Retry with the PAYMENT-SIGNATURE header
  // ---------------------------------------------------------------------------
  console.log("[3/3] Retrying with PAYMENT-SIGNATURE header...");

  const paidResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-SIGNATURE": paymentSignatureHeader,
      // Also send X-PAYMENT for v1 fallback compatibility
      "X-PAYMENT": paymentSignatureHeader,
    },
    body: JSON.stringify(requestBody),
  });

  // ---------------------------------------------------------------------------
  // Parse and display the result
  // ---------------------------------------------------------------------------
  if (!paidResponse.ok) {
    const errText = await paidResponse.text();
    console.error(`ERROR: Paid request failed with ${paidResponse.status}:`);
    try {
      const errJson = JSON.parse(errText);
      console.error(JSON.stringify(errJson, null, 2));
    } catch {
      console.error(errText);
    }
    process.exit(1);
  }

  const result = await paidResponse.json() as {
    provider_id?: string;
    response?: {
      content?: string;
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };
    cost?: {
      actual_total?: number;
      charged?: number;
    };
    demo_mode?: boolean;
    demo_notice?: string;
  };

  // Check settlement response header (x402 v2: PAYMENT-RESPONSE)
  const paymentResponseHeader =
    paidResponse.headers.get("PAYMENT-RESPONSE") ||
    paidResponse.headers.get("payment-response") ||
    paidResponse.headers.get("X-PAYMENT-RESPONSE") ||
    paidResponse.headers.get("x-payment-response");

  let settlementTxHash: string | undefined;
  if (paymentResponseHeader) {
    try {
      const settlementData = JSON.parse(base64Decode(paymentResponseHeader));
      settlementTxHash = settlementData.transaction;
    } catch {
      // ignore parse errors
    }
  }

  console.log("");
  console.log("SUCCESS");
  console.log("--------");

  if (result.demo_mode) {
    console.log("(running in demo mode — no actual AI call was made)");
    console.log("");
  }

  if (result.response?.content) {
    console.log("Response:", result.response.content);
  }

  if (result.response?.usage) {
    const { input_tokens, output_tokens } = result.response.usage;
    console.log(`Tokens:   ${input_tokens} in / ${output_tokens} out`);
  }

  if (result.cost) {
    const actual = result.cost.actual_total?.toFixed(6) ?? "?";
    const charged = result.cost.charged?.toFixed(4) ?? "?";
    console.log(`Cost:     $${actual} actual / $${charged} charged via x402`);
  }

  console.log("");
  console.log("x402 Settlement:");
  if (settlementTxHash) {
    console.log(`  TX Hash:  ${settlementTxHash}`);
    console.log(
      `  Explorer: https://sepolia.basescan.org/tx/${settlementTxHash}`
    );
  } else {
    console.log("  Settlement pending — the facilitator (https://x402.org/facilitator)");
    console.log("  submits the transferWithAuthorization() tx after verifying the signature.");
    console.log("  Check the server logs or Base Sepolia explorer for the tx hash.");
  }

  console.log("");
  console.log("Flow summary:");
  console.log("  1. POST /request/haiku        -> 402 (payment required)");
  console.log("  2. signTypedData(EIP-712)     -> signature (off-chain, no gas)");
  console.log("  3. POST + PAYMENT-SIGNATURE   -> 200 (facilitator settles on-chain)");
  console.log("  No browser. No wallet extension. No manual clicks. Fully autonomous.");
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
