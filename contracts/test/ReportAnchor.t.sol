// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReportAnchor} from "../src/ReportAnchor.sol";

contract ReportAnchorTest is Test {
    ReportAnchor internal anchor;
    bytes32 internal constant HASH = keccak256("report-1");

    event ReportAnchored(bytes32 indexed reportHash, address indexed anchorer, uint256 timestamp);

    function setUp() public {
        anchor = new ReportAnchor();
    }

    function test_anchor_records_timestamp_sender_and_event() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true);
        emit ReportAnchored(HASH, address(this), 1_700_000_000);

        anchor.anchor(HASH);

        assertTrue(anchor.isAnchored(HASH));
        assertEq(anchor.anchoredAt(HASH), 1_700_000_000);
        assertEq(anchor.anchoredBy(HASH), address(this));
    }

    function test_anchor_is_once_only() public {
        anchor.anchor(HASH);
        vm.expectRevert(abi.encodeWithSelector(ReportAnchor.AlreadyAnchored.selector, HASH));
        anchor.anchor(HASH);
    }

    function test_anchor_rejects_zero_hash() public {
        vm.expectRevert(ReportAnchor.ZeroHash.selector);
        anchor.anchor(bytes32(0));
    }

    function test_unanchored_hash_reads_false() public view {
        assertFalse(anchor.isAnchored(keccak256("never")));
    }
}
