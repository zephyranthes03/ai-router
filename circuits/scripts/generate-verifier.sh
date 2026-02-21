#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"
SNARKJS="$ROOT_DIR/node_modules/.bin/snarkjs"
CONTRACTS_DIR="$ROOT_DIR/../contracts/contracts"

echo "=== Generating Solidity Groth16 Verifier ==="

if [ ! -f "$BUILD_DIR/usage_budget_final.zkey" ]; then
    echo "Error: zkey not found. Run 'npm run setup' first."
    exit 1
fi

mkdir -p "$CONTRACTS_DIR"

$SNARKJS zkey export solidityverifier "$BUILD_DIR/usage_budget_final.zkey" \
    "$CONTRACTS_DIR/Groth16Verifier.sol"

echo "=== Verifier generated ==="
echo "Output: $CONTRACTS_DIR/Groth16Verifier.sol"
