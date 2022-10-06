import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("rewardTokenContract", async function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployRewardTokenContract() {
        const [owner, ...acc] = await ethers.getSigners();

        const RewardToken = await ethers.getContractFactory("RewardToken");
        const rewardTokenContract = await RewardToken.deploy();

        return { rewardTokenContract, owner, acc };
    }

    describe("mint()", async function () {
        it("PASS", async function () {
            const { rewardTokenContract, owner } = await loadFixture(deployRewardTokenContract);
            const mintAmount = 1_000_000_000_000;

            await rewardTokenContract.connect(owner).mint(owner.address, mintAmount);
            expect(await rewardTokenContract.balanceOf(owner.address)).to.be.equal(
                mintAmount
            );
        });

        it("PASS - different {to} address", async function () {
            const { rewardTokenContract, owner, acc } = await loadFixture(
              deployRewardTokenContract
            );
            const mintAmount = 1_000_000_000_000;

            await rewardTokenContract.connect(owner).mint(acc[0].address, mintAmount);
            expect(await rewardTokenContract.balanceOf(owner.address)).to.be.equal(0);
            expect(await rewardTokenContract.balanceOf(acc[0].address)).to.be.equal(
                mintAmount
            );
        });

        it("FAIL - not minter role", async function () {
            const { rewardTokenContract, owner, acc } = await loadFixture(
              deployRewardTokenContract
            );
            const mintAmount = 1_000_000_000_000;

            await expect(
                rewardTokenContract.connect(acc[0]).mint(acc[0].address, mintAmount)
            ).to.be.revertedWith(
                `AccessControl: account ${String(
                    acc[0].address
                ).toLowerCase()} is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`
            );
            expect(await rewardTokenContract.balanceOf(acc[0].address)).to.be.equal(0);
        });
    });
});
