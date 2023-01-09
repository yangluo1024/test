const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const UD_TOKEN_ID =
  "15887080073975966287200680762309871775705339946431535161811636666569347201747";
const SEA_ABI = require("./ABI/seaport_abi.json");
const { privKey01, privKey02 } = require("../setting");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

const offerer = "0xAa7739805C133F6eF0275638b3412af76F51777A";
// const offerer = "0x724d74374F083e94c72f01733f66e8cd77Dd4d82";
const feeAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";
const conduitKey =
  "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const provider = ethers.provider;

// 全局账户、合约对象
let seller;
let buyer;
let seaport;
let udContract;
let seaContract;
let order;
let basicOrder;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function printBalances(sellerAddr, buyerAddr) {
  // balances
  const balance1 = await provider.getBalance(sellerAddr);
  console.log("\nseller's balance:", balance1);
  const balance2 = await provider.getBalance(buyerAddr);
  console.log("\nbuyer's balance:", balance2);
  // domain balances
  const dBalance1 = await udContract.balanceOf(sellerAddr);
  console.log("\nseller's domain balance:", dBalance1);
  const dBalance2 = await udContract.balanceOf(buyerAddr);
  console.log("\nbuyer's domain balance:", dBalance2);
}

describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    order = {
      // offerer: offerer,
      offer: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifier: UD_TOKEN_ID,
          // startAmount: "1",
          // endAmount: "1",
        },
      ],
      consideration: [
        {
          // itemType: 0,
          // token: "0x0000000000000000000000000000000000000000",
          itemType: 1,
          token: WETH_ADDRESS,
          identifier: "0",
          amount: "100000000000000",
          recipient: offerer,
        },
        {
          // itemType: 0,
          // token: "0x0000000000000000000000000000000000000000",
          itemType: 1,
          token: WETH_ADDRESS,
          identifier: "0",
          amount: "100000000000000",
          // recipient: "0x0000a26b00c1F0DF003000390027140000fAa719",
          recipient: feeAddr,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      // totalOriginalConsiderationItems: 2,
      // orderType: 0,
      // zone: "0x0000000000000000000000000000000000000000",
      // zoneHash:
      //   "0x0000000000000000000000000000000000000000000000000000000000000000",
      // salt: Math.floor(Math.random() * 10 ** 10).toString(),
      conduitKey,
      // counter: 0,
    };
    // order = {
    //   offer: [
    //     {
    //       itemType: 2,
    //       token: UD_ADDRESS,
    //       identifier: UD_TOKEN_ID,
    //     },
    //   ],
    //   consideration: [
    //     {
    //       amount: "90000000000000000",
    //       recipient: offerer,
    //     },
    //     {
    //       amount: "10000000000000000",
    //       recipient: feeAddr,
    //     },
    //   ],
    //   startTime: Math.floor(Date.now() / 1000).toString(),
    //   endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
    //   conduitKey,
    // };

    // default network: matic
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
    seaContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

    // seller
    seller = new ethers.Wallet(privKey01, provider);
    // buyer
    buyer = new ethers.Wallet(privKey02, provider);
    seaport = new Seaport(seller);
  });

  it("create order with customised handling fee address and fulfill basic order", async () => {
    await printBalances(seller.address, buyer.address);
    const { executeAllActions } = await seaport.createOrder(order);
    // let price = await provider.getGasPrice();
    // let options = { gasPrice: price * 1.2, gasLimit: 1300000 };
    let options = { gasPrice: 100000000000, gasLimit: 1300000 };
    const orderInfo = await executeAllActions(options);
    console.log("\norder info:\n", JSON.stringify(orderInfo));
    // // deep copy
    // const ordComponents = JSON.parse(JSON.stringify(orderInfo.parameters));
    // console.log("\norder component info:\n", JSON.stringify(ordComponents));

    await sleep(6000);
    console.log("\n\n上架成功\n\n");
    // const { executeAllActions: executeAllFulfillActions } =
    //   await seaport2.fulfillOrder({
    seaport.signer = buyer;
    const { actions } = await seaport.fulfillOrder({
      order: orderInfo,
      accountAddress: buyer.address,
      conduitKey,
    });

    // executeAllFulfillActions();
    console.log("\nactions length:", actions.length);
    // console.log("\naction 0: \n", actions[0]);
    // console.log("\naction 1: \n", actions[1]);
    const action = actions[0];
    const transaction = await action.transactionMethods.transact(options);
    const receipt = await transaction.wait();
    console.log("\nreceipt info:\n", JSON.stringify(receipt));

    // await seaContract.connect(buyer).fulfillAvailableOrders(
    //   [orderInfo],
    //   [[[0, 0]]],
    //   [[[0, 0]], [[0, 1]]],
    //   conduitKey,
    //   1
    //   // options
    // );
    await sleep(6000);
    await printBalances(seller.address, buyer.address);
  });
});
