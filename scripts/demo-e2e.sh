#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# AI Router — E2E Demo Script (CLI)
# Runs against a locally-running server (default: http://localhost:3001)
# ============================================================

SERVER="${SERVER_URL:-http://localhost:3001}"
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

header() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }
info()   { echo -e "${GREEN}✓${NC} $1"; }
warn()   { echo -e "${YELLOW}⚠${NC} $1"; }

parse_calldata() {
  PROOF_JSON="$1" python3 - <<'PY'
import json
import os

try:
    data = json.loads(os.environ.get("PROOF_JSON", ""))
except Exception:
    print("Could not parse proof JSON")
    raise SystemExit(0)

calldata = data.get("calldata")
if not isinstance(calldata, str) or not calldata.strip():
    print("calldata: N/A")
    raise SystemExit(0)

try:
    parsed = json.loads(f"[{calldata}]")
except Exception:
    print("calldata (raw):", calldata)
    raise SystemExit(0)

if len(parsed) < 4:
    print("calldata (raw):", calldata)
    raise SystemExit(0)

print("_pA:         ", parsed[0])
print("_pB:         ", parsed[1])
print("_pC:         ", parsed[2])
print("_pubSignals: ", parsed[3])
PY
}

# ----------------------------------------------------------
header "Step 1: Health check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER/health" || true)
if [ "$STATUS" != "200" ]; then
  echo "Server not reachable at $SERVER (got HTTP $STATUS)."
  echo "Start the server first: cd server && npm run dev"
  exit 1
fi
info "Server is running at $SERVER"

# ----------------------------------------------------------
header "Step 2: Send AI request (haiku — budget tier)"
RESPONSE=$(curl -s -X POST "$SERVER/request/haiku" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Explain quantum computing in one sentence."}],
    "options": {"max_tokens": 256}
  }')

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
info "AI request completed"

# ----------------------------------------------------------
header "Step 3: Check usage records"
RECORDS=$(curl -s "$SERVER/proof/records")
echo "$RECORDS" | python3 -m json.tool 2>/dev/null || echo "$RECORDS"

COUNT=$(echo "$RECORDS" | python3 -c "import sys,json; print(json.load(sys.stdin)['stats']['count'])" 2>/dev/null || echo "?")
info "Usage records available: $COUNT"

if [ "$COUNT" = "0" ] || [ "$COUNT" = "?" ]; then
  warn "No usage records found. Proof generation will fail."
  warn "Make sure the AI request above succeeded."
  exit 1
fi

# ----------------------------------------------------------
header "Step 4: Generate ZK proof"
PROOF=$(curl -s -X POST "$SERVER/proof/generate" \
  -H "Content-Type: application/json" \
  -d '{"budgetLimit": 0.10}')

echo "$PROOF" | python3 -m json.tool 2>/dev/null || echo "$PROOF"

SUCCESS=$(echo "$PROOF" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "false")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  info "ZK proof generated successfully!"

  TX_ROOT=$(echo "$PROOF" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['txHashesRoot'])" 2>/dev/null || echo "N/A")
  TX_COUNT=$(echo "$PROOF" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['txHashCount'])" 2>/dev/null || echo "N/A")

  echo ""
  info "txHashesRoot: $TX_ROOT"
  info "txHashCount:  $TX_COUNT"
  info "requestCount: $(echo "$PROOF" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['requestCount'])" 2>/dev/null || echo "?")"
else
  warn "Proof generation failed"
  exit 1
fi

# ----------------------------------------------------------
header "Step 5: Proof calldata (ready for on-chain submission)"
parse_calldata "$PROOF" || warn "Could not parse calldata"

# ----------------------------------------------------------
header "Done!"
echo "Next steps:"
echo "  1. Open http://localhost:5173 and submit the proof on-chain via MetaMask"
echo "  2. Or use cast/hardhat to call ProofRegistry.submitAndVerify() with the calldata above"
echo "  3. Verify on Basescan: https://sepolia.basescan.org"
