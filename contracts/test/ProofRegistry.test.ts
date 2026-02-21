import fs from "node:fs";
import path from "node:path";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { ProofRegistry, Groth16Verifier } from "../typechain-types";
import {
  MAX_REQUESTS,
  buildUsageBudgetCircuitInput,
  buildTxHashFieldElements,
  USAGE_BUDGET_PROOF_FIXTURE,
} from "./fixtures/usageBudgetProofInput";

type Groth16Calldata = {
  pA: [bigint, bigint];
  pB: [[bigint, bigint], [bigint, bigint]];
  pC: [bigint, bigint];
  pubSignals: [bigint, bigint, bigint, bigint];
};

function parseCalldata(calldata: string): Groth16Calldata {
  const parsed = JSON.parse(`[${calldata}]`);
  return {
    pA: parsed[0].map(BigInt) as [bigint, bigint],
    pB: parsed[1].map((row: string[]) => row.map(BigInt)) as [
      [bigint, bigint],
      [bigint, bigint]
    ],
    pC: parsed[2].map(BigInt) as [bigint, bigint],
    pubSignals: parsed[3].map(BigInt) as [bigint, bigint, bigint, bigint],
  };
}

function toBytes32(value: bigint): string {
  return ethers.zeroPadValue(ethers.toBeHex(value), 32);
}

async function generateValidCalldata(): Promise<Groth16Calldata> {
  const wasmPath = path.resolve(
    __dirname,
    "../../circuits/build/usage_budget_js/usage_budget.wasm"
  );
  const zkeyPath = path.resolve(
    __dirname,
    "../../circuits/build/usage_budget_final.zkey"
  );
  const vkeyPath = path.resolve(
    __dirname,
    "../../circuits/build/usage_budget_vkey.json"
  );

  for (const requiredPath of [wasmPath, zkeyPath, vkeyPath]) {
    if (!fs.existsSync(requiredPath)) {
      throw new Error(
        `Missing circuit artifact: ${requiredPath}. Run circuits build/setup first.`
      );
    }
  }

  const snarkjs = require("snarkjs");
  const circomlibjs = require("circomlibjs");

  const poseidon = await circomlibjs.buildPoseidon();
  const txHashFields = buildTxHashFieldElements();

  let txHashesRootField = txHashFields[0];
  for (let i = 1; i < MAX_REQUESTS; i++) {
    const hash = poseidon([txHashesRootField, txHashFields[i]]);
    txHashesRootField = poseidon.F.toObject(hash);
  }

  const txHashesRoot = txHashesRootField.toString();

  const commitmentHash = poseidon.F.toString(
    poseidon([
      USAGE_BUDGET_PROOF_FIXTURE.totalCost,
      USAGE_BUDGET_PROOF_FIXTURE.requestCount,
      txHashesRootField,
      USAGE_BUDGET_PROOF_FIXTURE.salt,
    ])
  );

  const input = buildUsageBudgetCircuitInput(commitmentHash, txHashesRoot);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  const vkey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
  const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!verified) {
    throw new Error("Generated proof failed local Groth16 verification");
  }

  const calldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );
  return parseCalldata(calldata);
}

describe("ProofRegistry", function () {
  let verifier: Groth16Verifier;
  let registry: ProofRegistry;
  let owner: any;
  let user1: any;
  let validCalldata: Groth16Calldata;

  before(async function () {
    this.timeout(180000);
    validCalldata = await generateValidCalldata();
  });

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    verifier = await Verifier.deploy();

    const Registry = await ethers.getContractFactory("ProofRegistry");
    registry = await Registry.deploy(await verifier.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct verifier address", async function () {
      expect(await registry.verifier()).to.equal(await verifier.getAddress());
    });

    it("Should start with zero proofs", async function () {
      expect(await registry.totalProofsVerified()).to.equal(0);
    });
  });

  describe("submitAndVerify", function () {
    it("Should accept a valid proof and store it", async function () {
      const tx = await registry.connect(user1).submitAndVerify(
        validCalldata.pA,
        validCalldata.pB,
        validCalldata.pC,
        validCalldata.pubSignals
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check totalProofsVerified incremented
      expect(await registry.totalProofsVerified()).to.equal(1);

      // Check user proof count
      expect(await registry.getUserProofCount(user1.address)).to.equal(1);
    });

    it("Should emit ProofVerified event with correct data", async function () {
      await expect(
        registry.connect(user1).submitAndVerify(
          validCalldata.pA,
          validCalldata.pB,
          validCalldata.pC,
          validCalldata.pubSignals
        )
      ).to.emit(registry, "ProofVerified");
    });

    it("Should include txHashesRoot in ProofVerified event", async function () {
      const tx = await registry.connect(user1).submitAndVerify(
        validCalldata.pA,
        validCalldata.pB,
        validCalldata.pC,
        validCalldata.pubSignals
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      const proofVerified = receipt!.logs
        .map((log) => {
          try {
            return registry.interface.parseLog(log as any);
          } catch {
            return null;
          }
        })
        .find((log) => log?.name === "ProofVerified");

      expect(proofVerified).to.not.be.null;
      expect(proofVerified!.args.txHashesRoot).to.equal(
        toBytes32(validCalldata.pubSignals[3])
      );
    });

    it("Should store multiple proofs for the same user", async function () {
      await registry.connect(user1).submitAndVerify(
        validCalldata.pA,
        validCalldata.pB,
        validCalldata.pC,
        validCalldata.pubSignals
      );
      await registry.connect(user1).submitAndVerify(
        validCalldata.pA,
        validCalldata.pB,
        validCalldata.pC,
        validCalldata.pubSignals
      );

      expect(await registry.getUserProofCount(user1.address)).to.equal(2);
      expect(await registry.totalProofsVerified()).to.equal(2);
    });
  });

  describe("Query functions", function () {
    it("Should return proof details via getProof", async function () {
      await registry.connect(user1).submitAndVerify(
        validCalldata.pA,
        validCalldata.pB,
        validCalldata.pC,
        validCalldata.pubSignals
      );

      // Get proofId from event
      const proofIds = await registry.getUserProofs(user1.address);
      expect(proofIds.length).to.equal(1);

      const proof = await registry.getProof(proofIds[0]);
      expect(proof.prover).to.equal(user1.address);
      expect(proof.budgetLimit).to.equal(validCalldata.pubSignals[0]);
      expect(proof.requestCount).to.equal(validCalldata.pubSignals[1]);
      expect(proof.commitmentHash).to.equal(toBytes32(validCalldata.pubSignals[2]));
      expect(proof.txHashesRoot).to.equal(toBytes32(validCalldata.pubSignals[3]));
    });

    it("Should return empty array for user with no proofs", async function () {
      const proofs = await registry.getUserProofs(owner.address);
      expect(proofs.length).to.equal(0);
    });
  });
});
