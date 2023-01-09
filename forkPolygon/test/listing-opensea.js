const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { privKey01, privKey02 } = require("../setting.js");

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const UD_TOKEN_ID =
  "10972960335751688875393978132030640555815094700642329234937142627564682509899";
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

const feeAddr = "0x0000a26b00c1F0DF003000390027140000fAa719";
const conduitKey =
  "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const provider = ethers.provider;

// 全局变量
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
    seaport = new Seaport(seller);

    // order info
    order = {
      offerer: seller.address,
      offer: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifierOrCriteria: UD_TOKEN_ID,
          startAmount: "1",
          endAmount: "1",
        },
      ],
      consideration: [
        {
          itemType: 0,
          token: "0x0000000000000000000000000000000000000000",
          startAmount: "97500000000000000", // 0.1 matic (97.5%)
          endAmount: "97500000000000000",
          // itemType: 1,
          // token: WETH_ADDRESS,
          // startAmount: "97500000000000", // 0.0001 WETH (97.5%)
          // endAmount: "97500000000000",
          identifierOrCriteria: "0",
          recipient: seller.address,
        },
        {
          itemType: 0,
          token: "0x0000000000000000000000000000000000000000",
          startAmount: "2500000000000000", // 0.1 matic (2.5%)
          endAmount: "2500000000000000",
          // itemType: 1,
          // token: WETH_ADDRESS,
          // startAmount: "2500000000000", // 0.0001 WETH (2.5%)
          // endAmount: "2500000000000",
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
    signOrderInfo = await seaport.signOrder(order, 0, seller.address);
  });

  it("listing on opensea by `seller` and fulfill order by `buyer`", async () => {
    // pre balances status
    const balancesBefore = await printBalances(seller.address, buyer.address);

    const url = "https://api.opensea.io/v2/orders/matic/seaport/listings";
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
    console.log("\n\n上架成功");

    // change seaport signer from `seller` to `buyer`, cause fulfilling order needs buyer's signature.
    seaport.signer = buyer;
    const { actions } = await seaport.fulfillOrder({
      order: data,
      accountAddress: buyer.address,
      conduitKey,
    });

    // console.log("\nactions length:\n", actions.length);
    expect(actions.length).to.be.equal(1);
    const action = actions[0];
    let price = await provider.getGasPrice();
    console.log("当前gas价格: ", price, "wei");
    let options = {
      gasPrice: price,
      // gasLimit: 1300000,
    };
    const transaction = await action.transactionMethods.transact(options);
    const receipt = await transaction.wait();
    console.log("\ntxHash:", receipt.transactionHash);

    // balances status after tx
    const balancesAfter = await printBalances(seller.address, buyer.address);
    console.log("\n卖家域名减少:", balancesBefore[0] - balancesAfter[0]);
    console.log("买家域名增加:", balancesAfter[1] - balancesBefore[1]);
  });
});
