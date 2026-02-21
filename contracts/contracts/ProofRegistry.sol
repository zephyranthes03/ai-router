// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external view returns (bool);
}

/// @title ProofRegistry - On-chain ZK proof registry for AI accountability
/// @notice Verifies Groth16 proofs and stores verified proof records
/// @dev Public signals: [budgetLimit, requestCount, commitmentHash, txHashesRoot]
contract ProofRegistry {
    IGroth16Verifier public immutable verifier;

    struct ProofRecord {
        address prover;
        uint256 requestCount;
        uint256 budgetLimit;
        uint256 timestamp;
        bytes32 commitmentHash;
        bytes32 txHashesRoot;
    }

    mapping(bytes32 => ProofRecord) public proofs;
    mapping(address => bytes32[]) public userProofs;
    uint256 public totalProofsVerified;

    event ProofVerified(
        bytes32 indexed proofId,
        address indexed prover,
        uint256 requestCount,
        uint256 budgetLimit,
        bytes32 txHashesRoot,
        uint256 timestamp
    );

    constructor(address _verifier) {
        verifier = IGroth16Verifier(_verifier);
    }

    /// @notice Submit a ZK proof for on-chain verification and storage
    /// @param _pA Groth16 proof element A
    /// @param _pB Groth16 proof element B
    /// @param _pC Groth16 proof element C
    /// @param _pubSignals Public signals [budgetLimit, requestCount, commitmentHash, txHashesRoot]
    /// @return proofId Unique identifier for the stored proof
    function submitAndVerify(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[4] calldata _pubSignals
    ) external returns (bytes32) {
        require(
            verifier.verifyProof(_pA, _pB, _pC, _pubSignals),
            "Invalid ZK proof"
        );

        bytes32 proofId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, _pubSignals[2])
        );

        proofs[proofId] = ProofRecord({
            prover: msg.sender,
            budgetLimit: _pubSignals[0],
            requestCount: _pubSignals[1],
            commitmentHash: bytes32(_pubSignals[2]),
            txHashesRoot: bytes32(_pubSignals[3]),
            timestamp: block.timestamp
        });

        userProofs[msg.sender].push(proofId);
        totalProofsVerified++;

        emit ProofVerified(
            proofId,
            msg.sender,
            _pubSignals[1],
            _pubSignals[0],
            bytes32(_pubSignals[3]),
            block.timestamp
        );

        return proofId;
    }

    /// @notice Get a proof record by its ID
    function getProof(bytes32 proofId) external view returns (ProofRecord memory) {
        return proofs[proofId];
    }

    /// @notice Get all proof IDs for a user
    function getUserProofs(address user) external view returns (bytes32[] memory) {
        return userProofs[user];
    }

    /// @notice Get the count of proofs for a user
    function getUserProofCount(address user) external view returns (uint256) {
        return userProofs[user].length;
    }
}
