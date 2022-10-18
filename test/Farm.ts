import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Farm contract", async function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFarm() {
        const [owner, ...acc] = await ethers.getSigners();

        const RewardToken = await ethers.getContractFactory("RewardToken");
        const rewardTokenContract = await RewardToken.deploy();

        const FarmContract = await ethers.getContractFactory("Farm");
        const farmContract = await FarmContract.deploy(rewardTokenContract.address);

        await rewardTokenContract.connect(owner).mint(farmContract.address, await farmContract.limitOfTokenReward());
        await farmContract.connect(owner).grantRole(await farmContract.REWARD_ROLE(), owner.address);

        return { farmContract, rewardTokenContract, owner, acc };
    }

    describe("Init values", async function () {
        it("PASS", async function () {
            const { farmContract, rewardTokenContract } = await loadFixture(deployFarm);
            const limitOfTokenReward = await farmContract.limitOfTokenReward();

            expect(await rewardTokenContract.balanceOf(farmContract.address)).to.be.equals(limitOfTokenReward);
        });
    });

    describe("deposit()", async function () {
        it("PASS", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.5");
            const depositAmountMinus = ethers.utils.parseEther("-0.5");

            await expect(farmContract.connect(acc[0]).deposit({ 'value': depositAmount }))
                .to.changeEtherBalances(
                    [farmContract.address, acc[0].address],
                    [depositAmount, depositAmountMinus]
                );

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(depositAmount);
            expect(await farmContract.tvl()).to.be.equal(depositAmount);
            expect(await farmContract.arrayWithStakers(0)).to.be.equal(acc[0].address);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(1);
        });

        it("PASS - double deposit by same address", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.5");
            const depositAmountMinus = ethers.utils.parseEther("-0.5");
            const totalDepositedAmount = ethers.utils.parseEther("1");

            await expect(farmContract.connect(acc[0]).deposit({ 'value': depositAmount }))
                .to.changeEtherBalances(
                    [farmContract.address, acc[0].address],
                    [depositAmount, depositAmountMinus]
                );

            await expect(farmContract.connect(acc[0]).deposit({ 'value': depositAmount }))
                .to.changeEtherBalances(
                    [farmContract.address, acc[0].address],
                    [depositAmount, depositAmountMinus]
                );

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(totalDepositedAmount);
            expect(await farmContract.tvl()).to.be.equal(totalDepositedAmount);
            expect(await farmContract.arrayWithStakers(0)).to.be.equal(acc[0].address);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(1);
        });

        it("PASS - double deposit by diff address", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.5");
            const depositAmountMinus = ethers.utils.parseEther("-0.5");
            const depositAmount2 = ethers.utils.parseEther("0.75");
            const depositAmountMinus2 = ethers.utils.parseEther("-0.75");

            await expect(farmContract.connect(acc[0]).deposit({ 'value': depositAmount }))
                .to.changeEtherBalances(
                    [farmContract.address, acc[0].address],
                    [depositAmount, depositAmountMinus]
                );

            await expect(farmContract.connect(acc[1]).deposit({ 'value': depositAmount2 }))
                .to.changeEtherBalances(
                    [farmContract.address, acc[1].address],
                    [depositAmount2, depositAmountMinus2]
                );

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(depositAmount);
            expect(await farmContract.arrayWithStakers(0)).to.be.equal(acc[0].address);

            expect(await farmContract.addressToDepositedAmount(acc[1].address)).to.be.equal(depositAmount2);
            expect(await farmContract.arrayWithStakers(1)).to.be.equal(acc[1].address);

            expect(await farmContract.tvl()).to.be.equal(ethers.utils.parseEther("1.25"));
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(2);
        });

        it("FAIL - send 0 ETH", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);

            await expect(farmContract.connect(acc[0]).deposit({ 'value': 0 }))
                .to.revertedWith("Minimal deposit value is 0.1 ETH");

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(0);
            expect(await farmContract.tvl()).to.be.equal(0);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(0);
        });
    });

    const paramsDistrubuteRewards = [
        {
            depositAmount: ["1", "1"],
            rewardAmount: ["5", "5"],
            firstAccReward: "0"
        },
        {
            depositAmount: ["0.1", "1"],
            rewardAmount: ["0.9", "9.09"],
            firstAccReward: "0.01"
        }, 
        {
            depositAmount: ["1", "1", "1"],
            rewardAmount: ["3.33", "3.33", "3.33"],
            firstAccReward: "0.01"
        }, 
        {
            depositAmount: ["2", "2", "2", "2"],
            rewardAmount: ["2.5", "2.5", "2.5", "2.5"],
            firstAccReward: "0"
        }, 
        {
            depositAmount: ["0.5"],
            rewardAmount: ["10"],
            firstAccReward: "0"
        }, 
    ];

    describe("distrubuteRewards()", async function () {
        paramsDistrubuteRewards.forEach(({ depositAmount, rewardAmount, firstAccReward }) => {
            it("PASS", async function () {
                const { farmContract, owner, acc } = await loadFixture(deployFarm);

                for (let i = 0; i < depositAmount.length; i++) {
                    await farmContract.connect(acc[i]).deposit({ 'value': ethers.utils.parseEther(depositAmount[i]) });
                };

                await farmContract.connect(owner).distrubuteRewards();

                for (let i = 0; i < depositAmount.length; i++) {
                    if (i == 0) {
                        expect(await farmContract.addressToReward(acc[i].address)).to.be.equal(
                            ethers.utils.parseEther(String(parseFloat(rewardAmount[i]) + parseFloat(firstAccReward))));
                    } else {
                        expect(await farmContract.addressToReward(acc[i].address)).to.be.equal(ethers.utils.parseEther(rewardAmount[i]));
                    };
                };
            });
        });

        it("FAIL - no deposited ETH", async function() {
            const { farmContract, owner } = await loadFixture(deployFarm);

            await expect(farmContract.connect(owner).distrubuteRewards()).to.be.revertedWith("No addreses to distribute Reward Tokens");
        });

        it("FAIL - no REWARD_ROLE", async function() {
            const { farmContract, acc } = await loadFixture(deployFarm);

            await expect(farmContract.connect(acc[0]).distrubuteRewards()).to.be.revertedWith(
                `AccessControl: account ${(acc[0].address).toLowerCase()} is missing role 0xc002a6b5f9f56101ba6339b1b95d171fadf6e41e005b91c80d686aef7516e759`
                );
        });

        it("FAIL - distributed all tokens", async function () {
            const { farmContract, owner, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.5");
            const depositAmount2 = ethers.utils.parseEther("1");

            await farmContract.connect(acc[0]).deposit({ 'value': depositAmount });
            await farmContract.connect(acc[1]).deposit({ 'value': depositAmount2 });

            for(let i=0; i<100; i++){
                await farmContract.connect(owner).distrubuteRewards();
            };

            await expect(farmContract.connect(owner).distrubuteRewards()).to.be.revertedWith("All tokens has beed distributed");
        });
    });

    describe("withdraw()", async function () {
        it("PASS", async function () {
            const { farmContract, rewardTokenContract, owner, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.1");
            const depositAmountMinus = ethers.utils.parseEther("-0.1");
            const rewardAmout = ethers.utils.parseEther("0.91");
            const depositAmount2 = ethers.utils.parseEther("1");

            await farmContract.connect(acc[0]).deposit({ 'value': depositAmount });
            await farmContract.connect(acc[1]).deposit({ 'value': depositAmount2 });
            await farmContract.connect(owner).distrubuteRewards();

            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(2);
            expect(await rewardTokenContract.balanceOf(acc[0].address)).to.be.equal(0);

            await expect(farmContract.connect(acc[0]).withdraw()).to.changeEtherBalances(
                [farmContract.address, acc[0].address],
                [depositAmountMinus, depositAmount]
            );
            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(0);
            expect(await farmContract.addressToReward(acc[0].address)).to.be.equal(0);
            expect(await farmContract.tvl()).to.be.equal(depositAmount2);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(1);
            expect(await rewardTokenContract.balanceOf(acc[0].address)).to.be.equal(rewardAmout);
        });

        it("FAIL - no ETH deposited", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);

            await expect(farmContract.connect(acc[0]).withdraw()).to.be.revertedWith("No ETH to withdraw");
        });
    });

    describe("receive()", async function () {
        it("PASS", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.1");
            
            await acc[0].sendTransaction({
                to: farmContract.address,
                data: "0x",
                value: depositAmount
            });

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(depositAmount);
            expect(await farmContract.tvl()).to.be.equal(depositAmount);
            expect(await farmContract.arrayWithStakers(0)).to.be.equal(acc[0].address);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(1);
        });

        it("FAIL - not enough ETH to call deposit()", async function () {
            const { farmContract, acc } = await loadFixture(deployFarm);
            const depositAmount = ethers.utils.parseEther("0.001");
            
            await expect(acc[0].sendTransaction({
                to: farmContract.address,
                data: "0x",
                value: depositAmount
            })).to.be.revertedWith("Minimal deposit value is 0.1 ETH");

            expect(await farmContract.addressToDepositedAmount(acc[0].address)).to.be.equal(0);
            expect(await farmContract.tvl()).to.be.equal(0);
            expect(await farmContract.getArrayWithStakersLength()).to.be.equal(0);
        });
    });

    describe("getIndexByElement()", async function () {
        it("FAIL - element not in address", async function () {
            const { farmContract, owner, acc } = await loadFixture(deployFarm);

            await expect(farmContract.getIndexByElement(acc[0].address)).to.be.revertedWith("Element not in array");
        });
    });
});
