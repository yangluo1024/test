const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ABI = require("./ABI/seaport_abi.json");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const provider = ethers.provider;

// 交易对应的区块及订单哈希oH
// const blockNumber = 37930161; // one tx for fulfillAvailableOrders // 与match orders参数一样
// const blockNumber = 38774308; // one tx for list basic order with WETH
// const oH = "0xbcd5a00c4ed53a076a79a88e1c98d8bf75de03e4630eb155d475dab460154d07"; // order hash (basic order with WETH)
// const blockNumber = 38804647; // one tx for list basic order with MATIC
// const oH = "0x44f8dea6f99422239768b2f1e183e0b6cbdce4cde91049fc031fb52fe3db27d4"; // order hash (basic order with MATIC)
// const blockNumber = 38804566; // one tx for bid basic order
// const oH = "0x33f7ce31909536646c1c9c28a0a110a7011e290bfb0f5da9f5baa3a14b114e44"; // order hash (basic bid order)
const blockNumber = 38774802; // one tx for matchOrders (单个订单指定卖家购买时，opensea调用此接口)
const oH = "0x71878312f594722d3d6f51c5eafb3027a3fa06b8d560b52916f8c2c5b3181569"; // order hash (match orders)
// const blockNumber = 38776332; // one tx for cancel
// const oH = "0x84e5008942d5b9cb0ece98fe5c3e0ee0fb3660737c1513102d93b7ae88e82d36"; // order hash (cancel orders)

// 全局变量
let iface;
let seaEventTopics = [];
const seaportEvents = [
  "CounterIncremented(uint256,address)",
  "OrderCancelled(bytes32,address,address)",
  "OrderFulfilled(bytes32,address,address,address,(uint8,address,uint256,uint256)[],(uint8,address,uint256,uint256,address)[])",
  "OrderValidated(bytes32,address,address)",
];
let seaportContract;

// 获取交易中的有效事件，即seaport合约事件
async function getValidTxEvents(tx) {
  let seaEvent = [];
  // 非ud域名订单的交易, 如果是ud域名交易，订单信息中一定包含ud合约地址
  let data = new String(tx.data).valueOf().toLowerCase();
  if (!data.includes(UD_ADDRESS.slice(2).toLowerCase())) {
    return seaEvent;
  }

  // 非opensea上的交易，如果是opensea上的交易，交易一定是指向seaport合约地址
  if (tx.to.toLowerCase() != SEA_ADDRESS.toLowerCase()) {
    return seaEvent;
  }

  // 遍历交易中的事件，如果存在seaport事件，就将交易哈希添加至返回列表
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    // console.log(log.topics[0]);
    for (let i = 0; i < seaEventTopics.length; i++) {
      if (log.topics[0] === seaEventTopics[i]) {
        seaEvent.push(seaportEvents[i]);
      }
    }
  }
  return seaEvent;
}

// 获取fulfillBasicOrder交易中的订单参数
function getBasicOrderObj(basicOrderInfo) {
  var orderObj = {};
  var offer = {};
  var consideration1 = {};
  var consideration2 = {};
  orderObj.offerer = basicOrderInfo.offerer;
  orderObj.zone = basicOrderInfo.zone;

  //确认offer:
  offer.itemType = basicOrderInfo.offerToken != UD_ADDRESS ? 1 : 2;
  offer.token = basicOrderInfo.offerToken;
  offer.identifierOrCriteria = basicOrderInfo.offerIdentifier;
  offer.startAmount = basicOrderInfo.offerAmount;
  offer.endAmount = basicOrderInfo.offerAmount;
  orderObj.offer = [offer];
  // 确认consideration;
  consideration1.itemType =
    basicOrderInfo.offerToken != UD_ADDRESS
      ? 2
      : basicOrderInfo.considerationToken != WETH_ADDRESS
      ? 0
      : 1;
  consideration1.token = basicOrderInfo.considerationToken;
  consideration1.identifierOrCriteria = basicOrderInfo.considerationIdentifier;
  consideration1.startAmount = basicOrderInfo.considerationAmount;
  consideration1.endAmount = basicOrderInfo.considerationAmount;
  consideration1.recipient = basicOrderInfo.offerer;
  consideration2.itemType =
    basicOrderInfo.offerToken != UD_ADDRESS
      ? 1
      : basicOrderInfo.considerationToken != WETH_ADDRESS
      ? 0
      : 1;
  consideration2.token =
    basicOrderInfo.offerToken != UD_ADDRESS
      ? WETH_ADDRESS
      : basicOrderInfo.considerationToken;
  consideration2.identifierOrCriteria =
    basicOrderInfo.offerToken != UD_ADDRESS
      ? basicOrderInfo.offerIdentifier
      : basicOrderInfo.considerationIdentifier;
  consideration2.startAmount = basicOrderInfo.additionalRecipients[0].amount;
  consideration2.endAmount = basicOrderInfo.additionalRecipients[0].amount;
  consideration2.recipient = basicOrderInfo.additionalRecipients[0].recipient;
  orderObj.consideration = [consideration1, consideration2];

  orderObj.orderType = basicOrderInfo.basicOrderType % 4;
  orderObj.startTime = basicOrderInfo.startTime;
  orderObj.endTime = basicOrderInfo.endTime;
  orderObj.zoneHash = basicOrderInfo.zoneHash;
  orderObj.salt = basicOrderInfo.salt;
  orderObj.conduitKey = basicOrderInfo.offererConduitKey;
  orderObj.counter = 0; // TODO: counter确定为0么
  return orderObj;
}

// 获取fulfillAvailableOrders, matchOrders, cancel交易中的订单参数
function getOrderObj(orderInfo) {
  var orderObj = {};
  orderObj.offerer = orderInfo.offerer;
  orderObj.zone = orderInfo.zone;
  orderObj.offer = orderInfo.offer;
  orderObj.consideration = orderInfo.consideration;
  orderObj.orderType = orderInfo.orderType;
  orderObj.startTime = orderInfo.startTime;
  orderObj.endTime = orderInfo.endTime;
  orderObj.zoneHash = orderInfo.zoneHash;
  orderObj.salt = orderInfo.salt;
  orderObj.conduitKey = orderInfo.conduitKey;
  orderObj.counter = 0; // TODO: counter确定为0么
  return orderObj;
}

// 获取订单参数
function getOrderInfos(txDes) {
  let orderInfo = [];
  // seaport 主要接口: fulfillBasicOrder, fulfillAvailableOrders, cancel, matchOrders
  if (txDes.name === "fulfillAvailableOrders") {
    for (let i = 0; i < txDes.args.orders.length; i++) {
      orderInfo.push(getOrderObj(txDes.args.orders[0].parameters));
    }
  } else if (txDes.name === "fulfillBasicOrder") {
    orderInfo.push(getBasicOrderObj(txDes.args.parameters));
  } else if (txDes.name === "cancel") {
    // cancel没有批量取消，orders.length == 1
    orderInfo.push(getOrderObj(txDes.args.orders[0]));
  } else if (txDes.name === "matchOrders") {
    // TODO: 确认是不是都是orders[0]有效
    orderInfo.push(getOrderObj(txDes.args.orders[0].parameters));
  }
  return orderInfo;
}

async function getDomainOrderInfos(tx) {
  var domainOrderInfosObj = {};
  // 不是有效的交易数据，返回空Object
  const events = await getValidTxEvents(tx);
  if (events.length === 0) return domainOrderInfosObj;

  // 获取交易描述信息(Transaction Description)
  const data = tx.data;
  const txDes = iface.parseTransaction({ data });
  // console.log(txDes);
  const orderInfos = getOrderInfos(txDes);

  var domainOrderInfo = [];
  // get orderHash, from, to, tokenId by orderInfo
  for (const order of orderInfos) {
    let domainOrderObj = {};
    const orderHash = await seaportContract.getOrderHash(order);
    domainOrderObj.orderHash = orderHash;
    // 商品若不是ERC721，即bid订单，from是交易发起者，反之，from是商品提供者
    domainOrderObj.from =
      order.offer[0].itemType != 2 ? tx.from : order.offerer;
    // to与from相反
    domainOrderObj.to = order.offer[0].itemType != 2 ? order.offerer : tx.from;
    domainOrderObj.order = order;
    // 域名tokenId，如果是bid订单，则是consideration[0]中的token,反之，就是offer[0]中的token
    domainOrderObj.tokenId =
      order.offer[0].itemType != 2
        ? order.consideration[0].identifierOrCriteria
        : order.offer[0].identifierOrCriteria;
    domainOrderInfo.push(domainOrderObj);
  }
  domainOrderInfosObj.orders = domainOrderInfo;
  domainOrderInfosObj.events = events;
  return domainOrderInfosObj;
}

async function parseBlockToGetOrderInfos(blockNumber) {
  // 通过ether.js的 utils.Interface(abi).getEventTopic()得到对应事件的topics[0]
  iface = new ethers.utils.Interface(SEA_ABI);
  // seaport合约只有四个事件（可通过反注释下行代码打印查看），搜索以下三个事件即可
  // console.log(iface.events);
  seaEventTopics.push(iface.getEventTopic(seaportEvents[0]));
  seaEventTopics.push(iface.getEventTopic(seaportEvents[1]));
  seaEventTopics.push(iface.getEventTopic(seaportEvents[2]));
  seaEventTopics.push(iface.getEventTopic(seaportEvents[3]));

  // 合约实例, 后续需要使用合约方法生成orderHash
  seaportContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

  // 解析block, 获取交易信息
  var retData = [];
  const blockData = await provider.getBlockWithTransactions(blockNumber);
  for (const tx of blockData.transactions) {
    const infosObj = await getDomainOrderInfos(tx);
    if (JSON.stringify(infosObj) === JSON.stringify({})) continue;
    retData.push(infosObj);
  }
  console.log(
    "\n区块%d共有%d笔交易，其中通过seaport合约进行ud域名交易有%d笔:\n",
    blockNumber,
    blockData.transactions.length,
    retData.length
  );
  return retData;
}

describe("获取指定区块UD域名交易相关数据", function () {
  it("", async () => {
    const infos = await parseBlockToGetOrderInfos(blockNumber);
    for (const info of infos) {
      console.log("计算出来的orderHash:", info.orders[0].orderHash);
      console.log("实际抓取的orderHash:", oH);
      console.log("对应的数据:\n", info);
    }
  });
});
