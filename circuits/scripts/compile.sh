#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"

echo "=== Compiling UsageBudgetProof circuit ==="

mkdir -p "$BUILD_DIR"

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "Error: circom is not installed."
    echo "Install: https://docs.circom.io/getting-started/installation/"
    exit 1
fi

circom "$ROOT_DIR/circuits/usage_budget.circom" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR/"

echo "=== Compilation complete ==="
echo "Artifacts:"
echo "  - $BUILD_DIR/usage_budget.r1cs"
echo "  - $BUILD_DIR/usage_budget_js/usage_budget.wasm"
echo "  - $BUILD_DIR/usage_budget.sym"
