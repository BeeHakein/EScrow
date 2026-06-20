// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReportAnchor
/// @notice Immutable on-chain registry of risk-report content hashes (keccak256). Anchoring a
/// report hash is tamper evidence: once written it can never change, and anyone can later verify a
/// report matches its anchored hash. This is the on-chain counterpart of the off-chain
/// `ReportAnchorService` port — `anchor(reportHash)` is what the chain adapter will call, and the
/// emitted `ReportAnchored` event + `anchoredAt` mapping are what it reads back into an OnChainAnchor.
///
/// The report hash MUST be keccak256 (see Keccak256ReportHasher) so off-chain and on-chain agree.
contract ReportAnchor {
    /// @notice Block timestamp at which a report hash was anchored. 0 means never anchored.
    mapping(bytes32 => uint256) public anchoredAt;
    /// @notice Account that anchored a given report hash.
    mapping(bytes32 => address) public anchoredBy;

    event ReportAnchored(bytes32 indexed reportHash, address indexed anchorer, uint256 timestamp);

    error ZeroHash();
    error AlreadyAnchored(bytes32 reportHash);

    /// @notice Anchor a report hash on-chain. Anchoring is once-only and irreversible.
    /// @dev Reverts on the zero hash (nothing to anchor) or a hash already anchored.
    function anchor(bytes32 reportHash) external {
        if (reportHash == bytes32(0)) revert ZeroHash();
        if (anchoredAt[reportHash] != 0) revert AlreadyAnchored(reportHash);
        anchoredAt[reportHash] = block.timestamp;
        anchoredBy[reportHash] = msg.sender;
        emit ReportAnchored(reportHash, msg.sender, block.timestamp);
    }

    /// @notice Whether a report hash has been anchored.
    function isAnchored(bytes32 reportHash) external view returns (bool) {
        return anchoredAt[reportHash] != 0;
    }
}
