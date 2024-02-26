const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", async function () {
          let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              lottery = await ethers.getContract("Lottery", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
              interval = await lottery.getInterval();
          });

          describe("constructor", function () {
              it("initializes the lottery correctly", async () => {
                  const lotteryState = await lottery.getLotteryState();
                  assert.equal(lotteryState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterLottery", function () {
              it("reverts when you don't pay enough", async () => {
                  await expect(lottery.enterLottery()).to.be.revertedWithCustomError(
                      lottery,
                      "Lottery__NotEnoughETHEntered",
                  );
              });
              it("records players when they enter", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  const playerFromContract = await lottery.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event on enter", async () => {
                  await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
                      lottery,
                      "LotteryEnter",
                  );
              });
              it("doesn't allow entrance when lottery is calculating", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []); //Empty array because we just want to mine 1 extra block
                  // Pretend to be a chainlink keeper
                  await lottery.performUpkeep("0x"); // after this executed LotteryState should be in CALCULATING state.
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee }),
                  ).to.be.revertedWithCustomError(lottery, "Lottery__NotOpen");
              });
          });
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });
              it("returns false if lottery isn't open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await lottery.performUpkeep("0x");
                  const lotteryState = await lottery.getLotteryState();
                  const { upkeepNeeded } = await lottery.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(lotteryState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]); // use a higher number here if this test fails
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await lottery.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await lottery.checkUpkeep.staticCall("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded);
              });
          });
          describe("performUpkeep", function () {
              it("it can only run if checkUpkeep is true", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = lottery.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async () => {
                  await expect(lottery.performUpkeep("0x")).to.be.revertedWithCustomError(
                      lottery,
                      "Lottery__UpkeepNotNeeded",
                  );
              });
              it("updates the raffle state, emits an event, and calls the vrf coordinator", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await lottery.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.logs[1].args.requestId;
                  const lotteryState = await lottery.getLotteryState();
                  assert(Number(requestId) > 0);
                  assert(lotteryState.toString() == "1");
              });
          });
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await lottery.enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("can only be called after performUpkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.getAddress()),
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.getAddress()),
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, resets the lottery and sends money", async () => {
                  const additionalEntrances = 3;
                  const startingAccountIndex = 1; // 1 since deployer is 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrances;
                      i++
                  ) {
                      const accountConnectedLottery = lottery.connect(accounts[i]);
                      await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee });
                  }
                  const startingTimeStamp = await lottery.getLatestTimeStamp();

                  // perform upKeep (mock being chainlink keepers)

                  // which will kick off calling fulfillRandomWords(mock being the chainlink vrf)

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("Found the event!");
                          try {
                              const recentWinner = await lottery.getRecentWinner();
                              const lotteryState = await lottery.getLotteryState();
                              const endingTimeStamp = await lottery.getLatestTimeStamp();
                              const numPlayers = await lottery.getNumberOfPlayers();
                              const winnerEndingBalance = await accounts[1].provider.getBalance(
                                  accounts[1].address,
                              );
                              assert.equal(recentWinner.toString(), accounts[1].address);
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(lotteryState.toString(), "0");
                              // because the last timestamp should have been updated
                              assert(Number(endingTimeStamp) > Number(startingTimeStamp));
                              // make sure that this winner got paid what they need
                              assert.equal(
                                  Number(winnerEndingBalance).toString(),
                                  (
                                      Number(winnerStartingBalance) + // startingBalance + ( (lotteryEntranceFee * additionalEntrances) + lotteryEntranceFee )
                                      (Number(lotteryEntranceFee) * additionalEntrances +
                                          Number(lotteryEntranceFee))
                                  ).toString(),
                              );
                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });

                      // setting up the listener
                      // pretend that a random number was drawn by calling performUpkeep and fulfillRandomWords.
                      const tx = await lottery.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      // 1 since account number one is going to be the winner
                      const winnerStartingBalance = await accounts[1].provider.getBalance(
                          accounts[1].address,
                      );
                      // once this function gets called, this function should emit a winner picked event
                      // below we are mocking vrfCoordinators
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args.requestId,
                          lottery.getAddress(),
                      );
                  });
              });
          });
      });
