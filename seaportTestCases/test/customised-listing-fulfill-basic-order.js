const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { privKey01, privKey02 } = require("../setting.js");

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const conduitKey =
  "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const provider = ethers.provider;

const UD_TOKEN_ID =
  "33651723785549494707706199451737364537114120588167476828772376849918637234177";
const feeAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";

// 全局变量
let order;
let seller;
let buyer;
let seaport;
let udContract;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function printBalances(sellerAddr, buyerAddr) {
  // domain balances
  const balance1 = await udContract.balanceOf(sellerAddr);
  console.log("\nseller's domain balance:", balance1);
  const balance2 = await udContract.balanceOf(buyerAddr);
  console.log("buyer's domain balance:", balance2);
  return [balance1, balance2];
}

describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    // 合约实例
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);

    // seller and buyer wallet
    seller = new ethers.Wallet(privKey01, provider);
    buyer = new ethers.Wallet(privKey02, provider);
    seaport = new Seaport(seller);

    // order info
    order = {
      offer: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifier: UD_TOKEN_ID,
        },
      ],
      consideration: [
        {
          // WETH 定价
          // itemType: 1,
          // token: WETH_ADDRESS,
          // identifier: "0",
          // amount: "90000000000000", // 0.0001 WETH (90%)

          // 默认本币，只需要amount
          amount: "90000000000000000", // 0.1 matic (90%)
          recipient: seller.address,
        },
        {
          // itemType: 1,
          // token: WETH_ADDRESS,
          // identifier: "0",
          // amount: "10000000000000", // 0.0001 WETH (10%)
          amount: "10000000000000000", // 0.1 matic (10%)
          recipient: feeAddr,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      conduitKey,
    };
  });

  it("customised listing by `seller` and fulfill order by `buyer`", async () => {
    // pre balances status
    const balancesBefore = await printBalances(seller.address, buyer.address);

    const price = await provider.getGasPrice();
    console.log("当前gas价格: ", price, "wei");
    const options = { gasPrice: price.mul(12).div(10) }; // 防止失败，gasPrice = currentGasPrice * 1.2
    // listing
    const { executeAllActions } = await seaport.createOrder(order);
    const orderInfo = await executeAllActions(options);
    console.log("\norder info:\n", JSON.stringify(orderInfo, null, 2));

    await sleep(3000);
    console.log("\n\n上架成功\n\n");

    // change seaport signer from `seller` to `buyer`, cause fulfilling order needs buyer's signature.
    seaport.signer = buyer;
    const { actions } = await seaport.fulfillOrder({
      order: orderInfo,
      accountAddress: buyer.address,
      conduitKey,
    });

    expect(actions.length).to.be.equal(1);
    const action = actions[0];
    // 发起交易
    const transaction = await action.transactionMethods.transact(options);
    const receipt = await transaction.wait();
    console.log("\ntxHash:", receipt.transactionHash);

    // balances status after tx
    const balancesAfter = await printBalances(seller.address, buyer.address);
    console.log("\n卖家域名减少:", balancesBefore[0] - balancesAfter[0]);
    console.log("买家域名增加:", balancesAfter[1] - balancesBefore[1]);
  });
});
