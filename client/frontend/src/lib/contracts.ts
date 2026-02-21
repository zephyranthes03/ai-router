/**
 * Shared blockchain contract constants for Base Sepolia USDC.
 */

// USDC on Base Sepolia
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
export const USDC_DECIMALS = 6;

export const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const ERC20_TRANSFER_EVENT = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ProofRegistry on Base Sepolia
// Preferred source: VITE_PROOF_REGISTRY_ADDRESS in client/frontend/.env.local
const envProofRegistryAddress = import.meta.env.VITE_PROOF_REGISTRY_ADDRESS?.trim() ?? "";
export const PROOF_REGISTRY_ADDRESS = (
  ADDRESS_REGEX.test(envProofRegistryAddress) ? envProofRegistryAddress : ZERO_ADDRESS
) as `0x${string}`;
export const IS_PROOF_REGISTRY_CONFIGURED = PROOF_REGISTRY_ADDRESS !== ZERO_ADDRESS;

export const PROOF_REGISTRY_ABI = [
  {
    type: "function",
    name: "submitAndVerify",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_pA", type: "uint256[2]" },
      { name: "_pB", type: "uint256[2][2]" },
      { name: "_pC", type: "uint256[2]" },
      { name: "_pubSignals", type: "uint256[4]" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getProof",
    stateMutability: "view",
    inputs: [{ name: "proofId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "prover", type: "address" },
          { name: "requestCount", type: "uint256" },
          { name: "budgetLimit", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "commitmentHash", type: "bytes32" },
          { name: "txHashesRoot", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getUserProofs",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "getUserProofCount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalProofsVerified",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "ProofVerified",
    inputs: [
      { name: "proofId", type: "bytes32", indexed: true },
      { name: "prover", type: "address", indexed: true },
      { name: "requestCount", type: "uint256", indexed: false },
      { name: "budgetLimit", type: "uint256", indexed: false },
      { name: "txHashesRoot", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
