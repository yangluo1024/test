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
const feeAddr = "0x0000a26b00c1F0DF003000390027140000fAa719";

// 全局变量
let order;
let seller;
let buyer;
let seaport;
let signOrderInfo;
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
    seaport = new Seaport(buyer);

    // order info
    order = {
      offerer: buyer.address,
      offer: [
        {
          itemType: 1,
          token: WETH_ADDRESS,
          identifierOrCriteria: "0",
          startAmount: "97500000000000", // 0.0001 WETH (97.5%)
          endAmount: "97500000000000",
        },
      ],
      consideration: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifierOrCriteria: UD_TOKEN_ID,
          startAmount: "1",
          endAmount: "1",
          recipient: buyer.address,
        },
        {
          itemType: 1,
          token: WETH_ADDRESS,
          startAmount: "2500000000000", // 0.0001 WETH (2.5%)
          endAmount: "2500000000000",
          identifierOrCriteria: "0",
          recipient: feeAddr,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      totalOriginalConsiderationItems: 2,
      orderType: 0,
      zone: "0x0000000000000000000000000000000000000000",
      zoneHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      salt: Math.floor(Math.random() * 10 ** 10).toString(),
      conduitKey,
      counter: 0,
    };
    // sign for order
    signOrderInfo = await seaport.signOrder(order, 0, buyer.address);
  });

  it("listing on opensea by `seller` and fulfill order by `buyer`", async () => {
    // pre balances status
    const balancesBefore = await printBalances(seller.address, buyer.address);

    const url = "https://api.opensea.io/v2/orders/matic/seaport/offers";
    const cHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": "1cf95be40f1e45449c0b63ccb4b64cef",
    };
    const data = {
      parameters: order,
      signature: signOrderInfo,
    };
    console.log("\norder info:\n", JSON.stringify(data, null, 2));

    await axios.post(url, data, { headers: cHeaders }).catch((err) => {
      if (err.response) {
        console.log(err.response.data);
        console.log(err.response.status);
        console.log(err.response.headers);
      } else {
        console.log("Error: ", err.message);
      }
    });

    await sleep(3000);
    console.log("\n\nBID 成功");

    seaport.signer = seller;
    const { actions } = await seaport.fulfillOrder({
      order: data,
      accountAddress: seller.address,
      conduitKey,
    });

    // console.log("\nactions length:\n", actions.length);
    expect(actions.length).to.be.equal(1);
    const action = actions[0];
    const price = await provider.getGasPrice();
    console.log("当前gas价格: ", price, "wei");
    const options = { gasPrice: price.mul(12).div(10) }; // 防止失败，gasPrice = currentGasPrice * 1.2

    // 发送交易
    const transaction = await action.transactionMethods.transact(options);
    const receipt = await transaction.wait();
    console.log("\ntxHash:", receipt.transactionHash);

    // balances status after tx
    const balancesAfter = await printBalances(seller.address, buyer.address);
    console.log("\n卖家域名减少:", balancesBefore[0] - balancesAfter[0]);
    console.log("买家域名增加:", balancesAfter[1] - balancesBefore[1]);
  });
});
