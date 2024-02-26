const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery", async function () {
          let lottery, lotteryEntranceFee, deployer;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              lottery = await ethers.getContract("Lottery", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  console.log("Setting up test...");
                  const startingTimeStamp = await lottery.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();
                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await lottery.getRecentWinner();
                              const lotteryState = await lottery.getLotteryState();
                              const winnerEndingBalance = await accounts[0].provider.getBalance(
                                  accounts[0].address,
                              );
                              const endingTimeStamp = await lottery.getLatestTimeStamp();
                              // checking if our players array has been reset
                              await expect(lottery.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              // we want our enum to go back to OPEN after we are done
                              assert.equal(lotteryState, 0);
                              // make sure that the money has been transfered correctly
                              assert.equal(
                                  Number(winnerEndingBalance).toString(),
                                  (
                                      Number(winnerStartingBalance) + Number(lotteryEntranceFee)
                                  ).toString(),
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (e) {
                              console.log(e);
                              reject(e);
                          }
                      });
                      console.log("Entering Lottery...");
                      const tx = await lottery.enterLottery({ value: lotteryEntranceFee });
                      await tx.wait(1);
                      console.log("Ok, time to wait...");
                      const winnerStartingBalance = await accounts[0].provider.getBalance(
                          accounts[0].address,
                      );
                      // this code WONT complete until our listener has finished listening
                  });
              });
          });
      });
