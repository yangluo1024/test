// 三个订单，由两种币种上架，批量混合支付
const { Seaport } = require("@opensea/seaport-js");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const {
  getConsiderationFulfillments,
} = require("./batch-orders-params-algorithm.js");

// ud, seaport, weth on polygon infos
const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ABI = require("./ABI/seaport_abi.json");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ABI = require("./ABI/weth_abi.json");
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
const conduitKey =
  "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const provider = ethers.provider;

const mockAddress = "0xAa7739805C133F6eF0275638b3412af76F51777A";
const UD_TOKEN_ID = [
  "33651723785549494707706199451737364537114120588167476828772376849918637234177",
  "114574057381761339445405643020699093290527277346957551387628821634728223560731",
  "106474465106524182929113463698598154918809512223128274872137732536781963473526",
];

// 全局变量
let orders;
let signer;
let seller;
let buyer;
let feeer;
let seaport;
let udContract;
let seaportContract;
let wethContract;
let orderAmount;
let handlingFee;
let orderAmount2;
let handlingFee2;
let mockAddrBalance;

// 打印seller和buyer的域名数, 以及buyer和feeer的weth
async function printBalances(sellerAddr, buyerAddr, feeAddr) {
  const sellerDomainNum = await udContract.balanceOf(sellerAddr);
  console.log("seller域名数:", sellerDomainNum);
  const buyerDomainNum = await udContract.balanceOf(buyerAddr);
  console.log("buyer域名数:", buyerDomainNum);
  const buyerBalance = await wethContract.balanceOf(buyerAddr);
  console.log("buyer weth余额:", buyerBalance);
  const feeerBalance = await wethContract.balanceOf(feeAddr);
  console.log("feeer weth余额:", feeerBalance);
  const buyerBalance2 = await provider.getBalance(buyerAddr);
  console.log("buyer matic余额:", buyerBalance2);
  const feeerBalance2 = await provider.getBalance(feeAddr);
  console.log("feeer matic余额:", feeerBalance2);
  // 返回seller和buyer的域名数，以及feeer的余额
  return [sellerDomainNum, buyerDomainNum, feeerBalance, feeerBalance2];
}

describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    // 合约实例
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
    seaportContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);
    wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, provider);
    // 获取测试地址，卖家，买家和收手续费用的地址
    [seller, buyer, feeer] = await ethers.getSigners(); // could also do with getNamedAccounts

    // 模拟mockAddresses的signers
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [mockAddress],
    });
    signer = await ethers.provider.getSigner(mockAddress);

    // 将mockAddress的域名UD_TOKEN_ID转移给测试地址seller.address
    await udContract
      .connect(signer)
      .transferFrom(mockAddress, seller.address, UD_TOKEN_ID[0]);
    await udContract
      .connect(signer)
      .transferFrom(mockAddress, seller.address, UD_TOKEN_ID[1]);
    await udContract
      .connect(signer)
      .transferFrom(mockAddress, seller.address, UD_TOKEN_ID[2]);

    // 将mockAddress的weth转移给测试地址buyer.address, 用于购买域名
    mockAddrBalance = await wethContract.connect(signer).balanceOf(mockAddress);
    await wethContract.connect(signer).transfer(buyer.address, mockAddrBalance);

    // 跳转区块，模拟60秒后的链状态
    await network.provider.send("evm_increaseTime", [100]);
    await network.provider.send("evm_mine");

    // 使用卖家signer实例化seaport
    seaport = new Seaport(seller);

    // 将费用定义成变量，方便后面验证
    orderAmount = "100000000000000"; // 订价0.0001 weth
    handlingFee = "10000000000000"; // 手续费, 10％
    orderAmount2 = "100000000000000000"; // 订价0.1 matic
    handlingFee2 = "10000000000000000"; // 手续费, 10％
    // 订单信息(order1: eth定价， order2: matic定价， order3: eth定价)
    orders = [
      {
        offer: [
          {
            itemType: 2,
            token: UD_ADDRESS,
            identifier: UD_TOKEN_ID[0],
          },
        ],
        consideration: [
          {
            // WETH 定价
            itemType: 1,
            token: WETH_ADDRESS,
            identifier: "0",
            amount: (parseInt(orderAmount) - parseInt(handlingFee)).toString(),
            recipient: seller.address,
          },
          {
            itemType: 1,
            token: WETH_ADDRESS,
            identifier: "0",
            amount: handlingFee,
            recipient: feeer.address,
          },
        ],
        startTime: Math.floor(Date.now() / 1000).toString(),
        endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
        conduitKey,
      },
      {
        offer: [
          {
            itemType: 2,
            token: UD_ADDRESS,
            identifier: UD_TOKEN_ID[1],
          },
        ],
        consideration: [
          {
            // 默认本币，只需要amount(订价 - 手续费)
            amount: (
              parseInt(orderAmount2) - parseInt(handlingFee2)
            ).toString(),
            recipient: seller.address,
          },
          {
            amount: handlingFee2,
            recipient: feeer.address,
          },
        ],
        startTime: Math.floor(Date.now() / 1000).toString(),
        endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
        conduitKey,
      },
      {
        offer: [
          {
            itemType: 2,
            token: UD_ADDRESS,
            identifier: UD_TOKEN_ID[2],
          },
        ],
        consideration: [
          {
            // WETH 定价
            itemType: 1,
            token: WETH_ADDRESS,
            identifier: "0",
            amount: (parseInt(orderAmount) - parseInt(handlingFee)).toString(),
            recipient: seller.address,
          },
          {
            itemType: 1,
            token: WETH_ADDRESS,
            identifier: "0",
            amount: handlingFee,
            recipient: feeer.address,
          },
        ],
        startTime: Math.floor(Date.now() / 1000).toString(),
        endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
        conduitKey,
      },
    ];
  });

  it("卖家不同币种上架多个商品，被buyer混合支付批量购买", async () => {
    // 交易前buyer和feeAddr的weth余额，以及seller和buyer的域名数
    const balancesBefore = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );

    // 上架
    const orderInfos = [];
    for (let i = 0; i < orders.length; i++) {
      const { executeAllActions } = await seaport.createOrder(orders[i]);
      const orderInfo = await executeAllActions();
      console.log("\n上架后订单信息:\n", JSON.stringify(orderInfo));
      orderInfos.push(orderInfo);
    }
    console.log("\n上架成功");

    // buyer授权给seaport指定合约使用weth, 此合约地址固定为: 0x1e0049783f008a0085193e00003d00cd54003c71
    await wethContract
      .connect(buyer)
      .approve(
        "0x1e0049783f008a0085193e00003d00cd54003c71",
        mockAddrBalance.mul(2)
      );
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");

    // 调用合约进行交易
    const options = { value: orderAmount2 };
    // 调用算法确定consideration fulfillments排列
    const fulfillments = getConsiderationFulfillments(orderInfos);
    console.log(
      "\n混合批量支付consideration fulfillments参数:\n",
      fulfillments
    );
    const tx = await seaportContract
      .connect(buyer)
      .fulfillAvailableOrders(
        orderInfos,
        [[[0, 0]], [[1, 0]], [[2, 0]]],
        fulfillments,
        conduitKey,
        3,
        options
      );
    const receipt = await tx.wait();
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");
    console.log("购买域名交易哈希:", receipt.transactionHash);

    // 交易后seller和buyer的域名数变化验证, 以及手续费验证
    // balancesBefore / balancesAfter: [sellerDomainNum, buyerDomainNum, feeerWethBalance, feeerMaticBalance]
    const balancesAfter = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );
    // seller域名减3，buyer域名增加3
    expect(balancesBefore[0].sub(balancesAfter[0]).toString()).to.equal("3");
    expect(balancesAfter[1].sub(balancesBefore[1]).toString()).to.equal("3");
    // feeer's weth增加应等于订单的10%, 即handlingFee
    expect(balancesAfter[2].sub(balancesBefore[2]).toString()).to.equal(
      (parseInt(handlingFee) * 2).toString()
    );
    expect(balancesAfter[3].sub(balancesBefore[3]).toString()).to.equal(
      handlingFee2
    );
  });
});
