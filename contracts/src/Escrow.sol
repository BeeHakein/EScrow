// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 surface the escrow needs. USDC on Base is the intended token.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title Escrow
/// @notice Milestone escrow for a single client ↔ freelancer engagement. The contract holds the
/// funded total in an ERC-20 token and pays each milestone's amount to the freelancer when
/// released, STRICTLY in index order. It is the source of truth for FUNDS only; the platform
/// tracks the richer state machine (submitted/approved) off-chain. This mirrors the off-chain
/// `EscrowDeployer` (deploy + fund) and `MilestoneReleaseService` (release) ports.
///
/// Release is authorized by the platform `releaser` (the backend that has recorded the client's
/// off-chain approval). Disputes and refunds are intentionally OUT OF SCOPE for this scaffold:
/// TODO — add a dispute/refund path (arbiter or timeout) before mainnet; production may also want
/// the client to co-sign releases on-chain rather than trusting the platform key alone.
contract Escrow {
    address public immutable client;
    address public immutable freelancer;
    /// @notice Platform backend authorized to trigger payouts (the deployer).
    address public immutable releaser;
    IERC20 public immutable token;

    /// @notice Milestone amounts, indexed; the i-th release pays `amounts[i]` to the freelancer.
    uint256[] public amounts;
    /// @notice Release flag per milestone index.
    bool[] public released;
    /// @notice sum(amounts) — the exact total the escrow must be funded with.
    uint256 public immutable total;
    /// @notice Whether the escrow has been funded with `total`.
    bool public funded;
    /// @notice Number of milestones released so far == the next index expected for release.
    uint256 public releasedCount;

    event Funded(address indexed from, uint256 total);
    event MilestoneReleased(uint256 indexed index, uint256 amount, address indexed to);
    event Completed();

    error NoMilestones();
    error NotReleaser();
    error AlreadyFunded();
    error NotFunded();
    error BadIndex(uint256 index);
    error OutOfOrder(uint256 index);
    error AlreadyReleased(uint256 index);
    error TransferFailed();

    modifier onlyReleaser() {
        if (msg.sender != releaser) revert NotReleaser();
        _;
    }

    constructor(address _client, address _freelancer, address _token, uint256[] memory _amounts) {
        if (_amounts.length == 0) revert NoMilestones();
        client = _client;
        freelancer = _freelancer;
        releaser = msg.sender; // the deployer (platform backend) is the authorized releaser
        token = IERC20(_token);

        uint256 sum;
        for (uint256 i = 0; i < _amounts.length; i++) {
            amounts.push(_amounts[i]);
            released.push(false);
            sum += _amounts[i];
        }
        total = sum;
    }

    /// @notice Pull `total` tokens from the caller (the client/funder) into the escrow. The caller
    /// must have approved this contract for `total` beforehand. One-time; activates the escrow.
    /// @dev Effects (funded = true) precede the token interaction — reentrancy-safe.
    function fund() external {
        if (funded) revert AlreadyFunded();
        funded = true;
        if (!token.transferFrom(msg.sender, address(this), total)) revert TransferFailed();
        emit Funded(msg.sender, total);
    }

    /// @notice Release milestone `index` to the freelancer. Funded-only, once-only, strictly
    /// in order. The escrow auto-completes when the final milestone is released.
    /// @dev `index != releasedCount` is the in-order guard: releasedCount is exactly the next
    /// expected index, so a better data structure replaces a scan over earlier milestones.
    /// Effects precede the transfer — reentrancy-safe and a failed transfer reverts the release.
    function release(uint256 index) external onlyReleaser {
        if (!funded) revert NotFunded();
        if (index >= amounts.length) revert BadIndex(index);
        if (released[index]) revert AlreadyReleased(index);
        if (index != releasedCount) revert OutOfOrder(index);

        released[index] = true;
        releasedCount += 1;

        uint256 amount = amounts[index];
        if (!token.transfer(freelancer, amount)) revert TransferFailed();
        emit MilestoneReleased(index, amount, freelancer);

        if (releasedCount == amounts.length) emit Completed();
    }

    function milestoneCount() external view returns (uint256) {
        return amounts.length;
    }

    function isComplete() external view returns (bool) {
        return releasedCount == amounts.length;
    }
}
