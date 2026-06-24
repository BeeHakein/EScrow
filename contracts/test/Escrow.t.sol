// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract EscrowTest is Test {
    MockERC20 internal token;
    Escrow internal escrow;

    address internal client = makeAddr("client");
    address internal freelancer = makeAddr("freelancer");
    address internal stranger = makeAddr("stranger");

    // This test contract deploys the escrow, so address(this) is the platform `releaser`.
    uint256[] internal amounts;

    event MilestoneReleased(uint256 indexed index, uint256 amount, address indexed to);
    event Completed();

    function setUp() public {
        token = new MockERC20();
        amounts = [uint256(300), 200];
        escrow = new Escrow(client, freelancer, address(token), amounts);

        // Fund: mint to the client, approve the escrow, then pull `total` in.
        token.mint(client, escrow.total());
        vm.startPrank(client);
        token.approve(address(escrow), escrow.total());
        escrow.fund();
        vm.stopPrank();
    }

    function test_constructor_sets_total_and_releaser() public view {
        assertEq(escrow.total(), 500);
        assertEq(escrow.milestoneCount(), 2);
        assertEq(escrow.releaser(), address(this));
        assertTrue(escrow.funded());
        assertEq(token.balanceOf(address(escrow)), 500);
    }

    function test_constructor_rejects_empty_milestones() public {
        uint256[] memory none = new uint256[](0);
        vm.expectRevert(Escrow.NoMilestones.selector);
        new Escrow(client, freelancer, address(token), none);
    }

    function test_release_pays_in_order_and_completes() public {
        vm.expectEmit(true, true, false, true);
        emit MilestoneReleased(0, 300, freelancer);
        escrow.release(0);
        assertEq(token.balanceOf(freelancer), 300);
        assertFalse(escrow.isComplete());

        vm.expectEmit(false, false, false, false);
        emit Completed();
        escrow.release(1);
        assertEq(token.balanceOf(freelancer), 500);
        assertTrue(escrow.isComplete());
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function test_release_rejects_out_of_order() public {
        vm.expectRevert(abi.encodeWithSelector(Escrow.OutOfOrder.selector, 1));
        escrow.release(1);
    }

    function test_release_rejects_double_release() public {
        escrow.release(0);
        vm.expectRevert(abi.encodeWithSelector(Escrow.AlreadyReleased.selector, 0));
        escrow.release(0);
    }

    function test_release_rejects_bad_index() public {
        vm.expectRevert(abi.encodeWithSelector(Escrow.BadIndex.selector, 2));
        escrow.release(2);
    }

    function test_only_releaser_can_release() public {
        vm.prank(stranger);
        vm.expectRevert(Escrow.NotReleaser.selector);
        escrow.release(0);
    }

    function test_release_requires_funding() public {
        Escrow unfunded = new Escrow(client, freelancer, address(token), amounts);
        vm.expectRevert(Escrow.NotFunded.selector);
        unfunded.release(0);
    }

    function test_fund_is_once_only() public {
        token.mint(client, escrow.total());
        vm.startPrank(client);
        token.approve(address(escrow), escrow.total());
        vm.expectRevert(Escrow.AlreadyFunded.selector);
        escrow.fund();
        vm.stopPrank();
    }
}
