# ProofRoute AI Contracts

Hardhat workspace for on-chain ZK verification.

Contracts:

- `Groth16Verifier.sol`: generated verifier contract
- `ProofRegistry.sol`: stores proof records and emits `ProofVerified`

Current deployment target in this repo is Base Sepolia.

## Prerequisites

- Node.js 20+ (Node 22 recommended for Hardhat tooling)
- npm 10+
- Circuit artifacts already built in `../circuits/build` for full proof tests

## Environment

Create `contracts/.env` with:

```env
BASE_SEPOLIA_RPC=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x...
BASESCAN_API_KEY=...
```

## Install

```bash
cd contracts
npm install
```

## Commands

```bash
# Compile
npm run compile

# Test (includes real Groth16 fullProve path)
npm test

# Local deploy (hardhat network)
npm run deploy:local

# Base Sepolia deploy + save deployed-addresses.json
npm run deploy:base-sepolia

# Verify on Basescan
npm run verify
```

## Deployment Outputs

`scripts/deploy.ts` does the following:

1. Deploys `Groth16Verifier`
2. Deploys `ProofRegistry`
3. Saves `contracts/deployed-addresses.json`
4. Updates `client/frontend/.env.local` with `VITE_PROOF_REGISTRY_ADDRESS`
5. Tries Basescan verification (non-local networks)

## Test Notes

`test/ProofRegistry.test.ts` uses real proving flow:

- reads WASM/zkey/vkey from `../circuits/build`
- runs `snarkjs.groth16.fullProve`
- verifies proof locally
- calls `submitAndVerify` on deployed test contracts

If circuit artifacts are missing, tests fail with a clear path message.

## Live Base Sepolia Addresses

See `contracts/deployed-addresses.json` for the current deployed contract addresses and explorer links.

## Track Alignment Note

- Current chain execution in this repository is Base Sepolia.
- Mainnet-specific prize requirements should be treated as a separate deployment milestone.
