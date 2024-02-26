const { ethers, network } = require("hardhat");

async function mockKeepers() {
    const lottery = await ethers.getContract("Lottery");
    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));
    const interval = await lottery.getInterval();
    await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
    await network.provider.request({ method: "evm_mine", params: [] });
    const { upkeepNeeded } = await lottery.checkUpkeep.staticCall(checkData);
    if (upkeepNeeded) {
        const tx = await lottery.performUpkeep(checkData);
        const txReceipt = await tx.wait(1);
        const requestId = txReceipt.logs[1].args.requestId;
        console.log(`Performed upkeep with RequestId: ${requestId}`);
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, lottery);
        }
    } else {
        console.log("No upkeep needed!");
    }
}

async function mockVrf(requestId, lottery) {
    console.log("We on a local network? Ok let's pretend...");
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    const lotteryAddress = await lottery.getAddress();
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, lotteryAddress);
    console.log("Responded!");
    const recentWinner = await lottery.getRecentWinner();
    console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
