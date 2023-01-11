const { Seaport } = require("@opensea/seaport-js");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { privKey01, privKey02 } = require("../setting.js");

const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

const feeAddr = "0x0000a26b00c1F0DF003000390027140000fAa719";
const provider = ethers.provider;

// 全局变量
let seller;
let buyer;

function getConsiderationFulfillments(orders) {
  // 确定offerer收款地址最终对应的fulfillments子数组 (offerer收款详细对应的是consideration列表第一条目)
  const [offererMaticObj, offererWETHObj] = confirmOfferFulfillments(orders, 0);
  // 确定opensea收手续费地址最终对应的fulfillments子数组 (offerer收款详细对应的是consideration列表第二条目)
  const recipientObj = confirmOtherFulfillments(orders, 1);
  // 确定商品指定接收地址taker最终对应的fulfillments子数组 (offerer收款详细对应的是consideration列表第三条目)
  const takerObj = confirmOtherFulfillments(orders, 2);
  console.log("\nofferer matic子数组:\n", JSON.stringify(offererMaticObj));
  console.log("\nofferer weth子数组:\n", JSON.stringify(offererWETHObj));
  console.log("\nopensea recipient子数组:", JSON.stringify(recipientObj));
  console.log("\ntaker子数组:", JSON.stringify(takerObj));

  // 收集订单号币种ordersCoin, 以及不同币种的地址顺序(用两个set收集)
  const offerMaticSet = new Set();
  const offererWETHSet = new Set();
  const ordersCoin = []; // 0 for Matic, 1 for WETH
  for (let i = 0; i < orders.length; i++) {
    const itemType = orders[i].parameters.consideration[0].itemType;
    const offerer = orders[i].parameters.consideration[0].recipient;
    if (itemType === 0 || itemType === "0") {
      if (!offerMaticSet.has(offerer)) {
        offerMaticSet.add(offerer);
      }
    } else {
      if (!offererWETHSet.has(offerer)) {
        offererWETHSet.add(offerer);
      }
    }
    ordersCoin.push(itemType);
  }

  const offerersMatic = Array.from(offerMaticSet);
  const offerersWETH = Array.from(offererWETHSet);
  console.log("\norder coin(0 for matic, 1 for weth):", ordersCoin);
  console.log("\nofferers matic:", offerersMatic);
  console.log("\nofferers weth:", offerersWETH);
  let mrptr = 0; // matic recipient ptr, 0代表遍历时matic币种首次遇到opensea recipient
  let wrptr = 0; // weth recipient ptr, 0代表遍历时weth币种首次遇到opensea recipient
  let isMaticTaker = false; // 代表遍历时matic币种是否遇到taker
  let isWethTaker = false; // 代表遍历时weth币种是否遇到taker
  var retArr = new Array();
  // 根据orders币种顺序来确定最终fulfillments数组(直接使用前面已经填好的各fulfillments子数组填充)
  for (let i = 0; i < ordersCoin.length; i++) {
    const consideration = orders[i].parameters.consideration;
    if (ordersCoin[i] === 0 || ordersCoin[i] === "0") {
      // 只有mrptr小于offerers地址数，才添加卖家offerer matic子数组
      if (mrptr < offerersMatic.length) {
        retArr.push(offererMaticObj[offerersMatic[mrptr]]);
        // 添加第一个matic币订单对应offerer数组后，紧跟着将所有matic订单的opensea地址数组push
        if (mrptr === 0) {
          retArr.push(recipientObj["matic"]);
        }
        mrptr++;
      }
      // 如果该订单存在taker, 则将所有matic订单的taker地址数组push
      if (!isMaticTaker && consideration.length === 3) {
        retArr.push(takerObj["matic"]);
        isMaticTaker = true;
      }
    } else {
      // 只有wrptr小于offerers地址数，才添加卖家offerer weth子数组
      if (wrptr < offerersWETH.length) {
        retArr.push(offererWETHObj[offerersWETH[wrptr]]);
        // 添加第一个weth币订单对应offerer数组后，紧跟着将所有weth订单的opensea地址数组push
        if (wrptr === 0) {
          retArr.push(recipientObj["weth"]);
        }
        wrptr++;
      }
      // 如果该订单存在taker, 则将所有weth订单的taker地址数组push
      if (!isWethTaker && consideration.length === 3) {
        retArr.push(takerObj["weth"]);
        isWethTaker = true;
      }
    }
  }
  return retArr;
}

// idx: 0 for offerer (consideration列表第一条目)
function confirmOfferFulfillments(orders) {
  // 由于offerer卖家地址不唯一, 可以多个订单来自多个offerer, 需要两个Obj
  const maticObj = {};
  const wethObj = {};

  for (let i = 0; i < orders.length; i++) {
    const itemType = orders[i].parameters.consideration[0].itemType;
    const offerer = orders[i].parameters.consideration[0].recipient;
    // 收集taker对应的fulfillments子数组
    if (itemType === 0 || itemType === "0") {
      if (!maticObj.hasOwnProperty(offerer)) {
        maticObj[offerer] = new Array([i, 0]);
      } else {
        maticObj[offerer].push([i, 0]);
      }
    } else {
      if (!wethObj.hasOwnProperty(offerer)) {
        wethObj[offerer] = new Array([i, 0]);
      } else {
        wethObj[offerer].push([i, 0]);
      }
    }
  }
  return [maticObj, wethObj];
}

// idx: 1 for opensea手续费地址, 2 for 指定买家taker地址, 分另代表consideration列表的第二,三条目
function confirmOtherFulfillments(orders, idx) {
  // opensea手续费地址和taker只需要一个Obj, key用"matic"和"weth"
  const mergeObj = {};

  for (let i = 0; i < orders.length; i++) {
    const consideration = orders[i].parameters.consideration;
    // idx为2用于收集taker的fulfillments子数组, 长度少于3说明该item没有taker
    if (idx === 2 && consideration.length <= 2) {
      continue;
    }
    const itemType = consideration[0].itemType;
    // 收集taker对应的fulfillments子数组
    if (itemType === 0 || itemType === "0") {
      if (!mergeObj.hasOwnProperty("matic")) {
        mergeObj["matic"] = new Array([i, idx]);
      } else {
        mergeObj["matic"].push([i, idx]);
      }
    } else {
      if (!mergeObj.hasOwnProperty("weth")) {
        mergeObj["weth"] = new Array([i, idx]);
      } else {
        mergeObj["weth"].push([i, idx]);
      }
    }
  }
  return mergeObj;
}

const multiOrders = new Array();
describe("fulfillAvailableOrders params test", function () {
  beforeEach(async function () {
    // seller and buyer wallet
    seller = new ethers.Wallet(privKey01, provider);
    buyer = new ethers.Wallet(privKey02, provider);

    // order info
    const order = {
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
            itemType: 1,
            recipient: buyer.address,
          },
          {
            itemType: 1,
            recipient: feeAddr.address,
          },
        ],
      },
    };
    multiOrders.push(order2);

    const order3 = {
      parameters: {
        consideration: [
          {
            itemType: 0,
            recipient: buyer.address,
          },
          {
            itemType: 0,
            recipient: feeAddr.address,
          },
          {
            itemType: 2,
            recipient: UD_ADDRESS,
          },
        ],
      },
    };
    multiOrders.push(order3);
  });

  it("测试批量购买consideration fulfillments参数", async () => {
    // console.log("orders info:\n", JSON.stringify(multiOrders, null, 2));
    const list = await getConsiderationFulfillments(multiOrders);
    console.log("\n最终consideration fulfillments参数:\n", list);
  });
});
