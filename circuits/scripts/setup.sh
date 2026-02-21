#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"
SNARKJS="$ROOT_DIR/node_modules/.bin/snarkjs"

echo "=== Powers of Tau Phase 1 (circuit-independent) ==="

if [ ! -f "$BUILD_DIR/usage_budget.r1cs" ]; then
    echo "Error: R1CS not found. Run 'npm run compile' first."
    exit 1
fi

# Phase 1: Powers of Tau
$SNARKJS powersoftau new bn128 14 "$BUILD_DIR/pot14_0000.ptau" -v
$SNARKJS powersoftau contribute "$BUILD_DIR/pot14_0000.ptau" "$BUILD_DIR/pot14_final.ptau" \
    --name="AI Router Ceremony" -v -e="random entropy for ai router ceremony"
$SNARKJS powersoftau prepare phase2 "$BUILD_DIR/pot14_final.ptau" "$BUILD_DIR/pot14_final_prep.ptau" -v

echo "=== Phase 2 (circuit-specific) ==="

# Phase 2: Groth16 setup
$SNARKJS groth16 setup "$BUILD_DIR/usage_budget.r1cs" "$BUILD_DIR/pot14_final_prep.ptau" \
    "$BUILD_DIR/usage_budget_0000.zkey"
$SNARKJS zkey contribute "$BUILD_DIR/usage_budget_0000.zkey" "$BUILD_DIR/usage_budget_final.zkey" \
    --name="AI Router Phase2" -v -e="random entropy for phase 2 contribution"

# Export verification key
$SNARKJS zkey export verificationkey "$BUILD_DIR/usage_budget_final.zkey" "$BUILD_DIR/usage_budget_vkey.json"

echo "=== Trusted setup complete ==="
echo "Artifacts:"
echo "  - $BUILD_DIR/usage_budget_final.zkey"
echo "  - $BUILD_DIR/usage_budget_vkey.json"
