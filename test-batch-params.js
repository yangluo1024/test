const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { privKey01, privKey02 } = require("../setting.js");

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const UD_TOKEN_ID =
  "110411088949675393238954505346130515984245940466327386382924262992152554748120";
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
let seaport2;
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

function getConsiderationFulfillments(orders) {
  const offerMaticObj = {};
  const offerWETHObj = {};
  const takerMaticObj = {};
  const takerWETHObj = {};
  const offerMaticSet = new Set();
  const offerWETHSet = new Set();
  const ordersCoin = []; // 0 for Matic, 1 for WETH

  // 确定各地址最终对应的不同币种的fulfillments子数组, 并收集订单号币种ordersCoin, 以及不同币种的地址顺序(用两个set收集)
  for (let i = 0; i < orders.length; i++) {
    const itemType = orders[i].parameters.consideration[0].itemType;
    const offerer = orders[i].parameters.consideration[0].recipient;
    if (itemType === 0 || itemType === "0") {
      if (!offerMaticObj.hasOwnProperty(offerer)) {
        offerMaticObj[offerer] = new Array([i, 0]);
      } else {
        offerMaticObj[offerer].push([i, 0]);
      }
      if (!offerMaticSet.has(offerer)) {
        offerMaticSet.add(offerer);
      }
    } else {
      if (!offerWETHObj.hasOwnProperty(offerer)) {
        offerWETHObj[offerer] = new Array([i, 0]);
      } else {
        offerWETHObj[offerer].push([i, 0]);
      }
      if (!offerWETHSet.has(offerer)) {
        offerWETHSet.add(offerer);
      }
    }
    ordersCoin.push(itemType);
  }
  console.log("\nofferer matic obj:\n", JSON.stringify(offerMaticObj));
  console.log("\nofferer weth obj:\n", JSON.stringify(offerWETHObj));

  // 确定opensea地址最终对应的fulfillments子数组
  const recipientObj = {};
  for (let i = 0; i < ordersCoin.length; i++) {
    if (ordersCoin[i] === 0 || ordersCoin[i] === "0") {
      if (!recipientObj.hasOwnProperty("matic")) {
        recipientObj["matic"] = new Array([i, 1]); // ordersCoin的下标就是订单编号
      } else {
        recipientObj["matic"].push([i, 1]); // ordersCoin的下标就是订单编号
      }
    } else {
      if (!recipientObj.hasOwnProperty("weth")) {
        recipientObj["weth"] = new Array([i, 1]); // ordersCoin的下标就是订单编号
      } else {
        recipientObj["weth"].push([i, 1]); // ordersCoin的下标就是订单编号
      }
    }
  }

  const offerersMatic = Array.from(offerMaticSet);
  const offerersWETH = Array.from(offerWETHSet);
  console.log("\nrecipient obj:\n", JSON.stringify(recipientObj));
  console.log("\nofferers matic:", offerersMatic);
  console.log("\nofferers weth:", offerersWETH);
  console.log("\norder coin:", ordersCoin);
  let mptr = 0;
  let wptr = 0;
  var retArr = new Array();
  for (let i = 0; i < ordersCoin.length; i++) {
    if (ordersCoin[i] === 0 || ordersCoin[i] === "0") {
      if (mptr >= offerersMatic.length) {
        continue;
      }
      retArr.push(offerMaticObj[offerersMatic[mptr]]);
      if (mptr === 0) {
        // 添加第一个matic币订单对应数组后，紧跟着将所有matic订单的opensea地址数组push
        retArr.push(recipientObj["matic"]);
      }
      mptr++;
    } else {
      if (wptr >= offerersWETH.length) {
        continue;
      }
      retArr.push(offerWETHObj[offerersWETH[wptr]]);
      if (wptr === 0) {
        // 添加第一个weth币订单对应数组后，紧跟着将所有weth订单的opensea地址数组push
        retArr.push(recipientObj["weth"]);
      }
      wptr++;
    }
  }
  return retArr;
}

const multiOrders = new Array();
describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    // 合约实例
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);

    // seller and buyer wallet
    seller = new ethers.Wallet(privKey01, provider);
    buyer = new ethers.Wallet(privKey02, provider);
    seaport = new Seaport(seller);
    seaport2 = new Seaport(buyer);

    // order info
    const order = {
      parameters: {
        consideration: [
          {
            itemType: 1,
            recipient: seller.address,
          },
          {
            itemType: 1,
            recipient: feeAddr.address,
          },
        ],
      },
    };
    multiOrders.push(order);

    const order1 = {
      parameters: {
        consideration: [
          {
            itemType: 1,
            recipient: seller.address,
          },
          {
            itemType: 1,
            recipient: feeAddr.address,
          },
          {
            itemType: 2,
            recipient: UD_ADDRESS,
          },
        ],
      },
    };
    multiOrders.push(order1);

    const order2 = {
      parameters: {
        consideration: [
          {
            itemType: 0,
            recipient: seller.address,
          },
          {
            itemType: 0,
            recipient: feeAddr.address,
          },
        ],
      },
    };
    multiOrders.push(order2);
  });

  it("listing on opensea by `seller` and fulfill order by `buyer`", async () => {
    console.log("orders info:\n", JSON.stringify(multiOrders, null, 2));
    const list = await getConsiderationFulfillments(multiOrders);
    console.log(list);
  });
});
