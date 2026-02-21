import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function upsertEnvVar(filePath: string, key: string, value: string) {
  const nextEntry = `${key}=${value}`;
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];

  let replaced = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return nextEntry;
    }
    return line;
  });

  if (!replaced) {
    updated.push(nextEntry);
  }

  const trimmed = updated.filter((line, i) => !(line.length === 0 && i === updated.length - 1));
  fs.writeFileSync(filePath, `${trimmed.join("\n")}\n`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("Network:", network.name);

  // 1. Deploy Groth16Verifier
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("Groth16Verifier deployed to:", verifierAddr);

  // 2. Deploy ProofRegistry with verifier address
  const Registry = await ethers.getContractFactory("ProofRegistry");
  const registry = await Registry.deploy(verifierAddr);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("ProofRegistry deployed to:", registryAddr);

  // 3. Save deployed addresses
  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      Groth16Verifier: verifierAddr,
      ProofRegistry: registryAddr,
    },
    explorer:
      network.name === "baseSepolia"
        ? {
            Groth16Verifier: `https://sepolia.basescan.org/address/${verifierAddr}`,
            ProofRegistry: `https://sepolia.basescan.org/address/${registryAddr}`,
          }
        : undefined,
  };

  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment info saved to: ${outPath}`);

  // 3.1 Sync frontend runtime config for on-chain proof submission
  const frontendEnvLocal = path.join(
    __dirname,
    "..",
    "..",
    "client",
    "frontend",
    ".env.local",
  );
  upsertEnvVar(frontendEnvLocal, "VITE_PROOF_REGISTRY_ADDRESS", registryAddr);
  console.log(`Frontend env updated: ${frontendEnvLocal}`);

  // 4. Verify contracts on Basescan (skip for local networks)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 30s for block confirmations before verification...");
    await new Promise((r) => setTimeout(r, 30_000));

    try {
      console.log("Verifying Groth16Verifier...");
      await run("verify:verify", { address: verifierAddr, constructorArguments: [] });
      console.log("Groth16Verifier verified!");
    } catch (e: any) {
      console.warn("Groth16Verifier verification:", e.message?.includes("Already Verified") ? "Already verified" : e.message);
    }

    try {
      console.log("Verifying ProofRegistry...");
      await run("verify:verify", { address: registryAddr, constructorArguments: [verifierAddr] });
      console.log("ProofRegistry verified!");
    } catch (e: any) {
      console.warn("ProofRegistry verification:", e.message?.includes("Already Verified") ? "Already verified" : e.message);
    }
  }

  console.log("\n--- Deployment Summary ---");
  console.log(`Network:         ${network.name}`);
  console.log(`Groth16Verifier: ${verifierAddr}`);
  console.log(`ProofRegistry:   ${registryAddr}`);
  if (deployment.explorer) {
    console.log(`\nExplorer links:`);
    console.log(`  Verifier: ${deployment.explorer.Groth16Verifier}`);
    console.log(`  Registry: ${deployment.explorer.ProofRegistry}`);
  }
  console.log("\nFrontend auto-config:");
  console.log(`  VITE_PROOF_REGISTRY_ADDRESS=${registryAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
