/**
 * Standalone deploy script: deploys ProofRegistry using an already-deployed Groth16Verifier.
 * Uses ethers.js directly (no hardhat), avoiding double-execution issues.
 */
import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = join(__dir, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = Object.fromEntries(
  envContent.split("\n").filter(l => l.includes("=")).map(l => {
    const idx = l.indexOf("=");
    return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const PRIVATE_KEY = envVars.DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not found in .env");

// Already-deployed Groth16Verifier (use the first one)
const VERIFIER_ADDRESS = "0xb4339750209d01002bf915b8854BEcDB89731BC2";

// Load ProofRegistry artifact
const artifact = JSON.parse(readFileSync(
  join(__dir, "..", "artifacts/contracts/ProofRegistry.sol/ProofRegistry.json"), "utf-8"
));

const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log("Deployer:", wallet.address);
const balance = await provider.getBalance(wallet.address);
console.log("Balance:", ethers.formatEther(balance), "ETH");

const nonce = await provider.getTransactionCount(wallet.address, "latest");
console.log("Nonce:", nonce);

console.log("\nDeploying ProofRegistry with verifier:", VERIFIER_ADDRESS);

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
const contract = await factory.deploy(VERIFIER_ADDRESS, {
  gasPrice: ethers.parseUnits("2", "gwei"),
  nonce,
});

console.log("Tx hash:", contract.deploymentTransaction().hash);
console.log("Waiting for confirmation...");
await contract.waitForDeployment();

const registryAddr = await contract.getAddress();
console.log("\nProofRegistry deployed to:", registryAddr);
console.log("Explorer: https://sepolia.basescan.org/address/" + registryAddr);

// Save deployed-addresses.json
const outPath = join(__dir, "..", "deployed-addresses.json");
const deployment = {
  network: "baseSepolia",
  chainId: 84532,
  deployer: wallet.address,
  timestamp: new Date().toISOString(),
  contracts: {
    Groth16Verifier: VERIFIER_ADDRESS,
    ProofRegistry: registryAddr,
  },
  explorer: {
    Groth16Verifier: `https://sepolia.basescan.org/address/${VERIFIER_ADDRESS}`,
    ProofRegistry: `https://sepolia.basescan.org/address/${registryAddr}`,
  },
};
writeFileSync(outPath, JSON.stringify(deployment, null, 2));
console.log("Saved:", outPath);

// Update frontend .env.local
const frontendEnvPath = join(__dir, "..", "..", "client", "frontend", ".env.local");
let envLocal = existsSync(frontendEnvPath) ? readFileSync(frontendEnvPath, "utf-8") : "";
if (envLocal.includes("VITE_PROOF_REGISTRY_ADDRESS=")) {
  envLocal = envLocal.replace(/VITE_PROOF_REGISTRY_ADDRESS=.*/,
    `VITE_PROOF_REGISTRY_ADDRESS=${registryAddr}`);
} else {
  envLocal += `\nVITE_PROOF_REGISTRY_ADDRESS=${registryAddr}\n`;
}
writeFileSync(frontendEnvPath, envLocal);
console.log("Frontend .env.local updated:", frontendEnvPath);
