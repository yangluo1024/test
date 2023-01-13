// 使用ETH上架单个订单，并购买
const { Seaport } = require("@opensea/seaport-js");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

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
const UD_TOKEN_ID =
  "33651723785549494707706199451737364537114120588167476828772376849918637234177";

// 全局变量
let order;
let seller;
let buyer;
let feeer;
let seaport;
let udContract;
let seaportContract;
let wethContract;
let orderAmount;
let handlingFee;
let mockAddrBalance;

// 打印seller和buyer的域名数, 以及buyer和feeer的weth
async function printBalances(sellerAddr, buyerAddr, feeAddr) {
  const sellerDomainNum = await udContract.balanceOf(sellerAddr);
  console.log("seller域名数:", sellerDomainNum);
  const buyerDomainNum = await udContract.balanceOf(buyerAddr);
  console.log("buyer域名数:", buyerDomainNum);
  const buyerBalance = await wethContract.balanceOf(buyerAddr);
  console.log("buyer's余额:", buyerBalance);
  const feeerBalance = await wethContract.balanceOf(feeAddr);
  console.log("feeer's余额:", feeerBalance);
  // 返回seller和buyer的域名数，以及feeer的余额
  return [sellerDomainNum, buyerDomainNum, feeerBalance];
}

describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    // 合约实例
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
    seaportContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);
    wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, provider);
    // 获取测试地址，卖家，买家和收手续费用的地址
    [seller, buyer, feeer] = await ethers.getSigners(); // could also do with getNamedAccounts

    // 模拟mockAddress的signer
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [mockAddress],
    });
    signer = await ethers.provider.getSigner(mockAddress);

    // 将mockAddress的域名UD_TOKEN_ID转移给测试地址seller.address
    await udContract
      .connect(signer)
      .transferFrom(mockAddress, seller.address, UD_TOKEN_ID);

    // 将mockAddress的weth转移给测试地址buyer.address, 用于购买域名
    mockAddrBalance = await wethContract.connect(signer).balanceOf(mockAddress);
    await wethContract.connect(signer).transfer(buyer.address, mockAddrBalance);

    // 跳转区块，模拟60秒后的链状态
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");

    // 使用卖家signer实例化seaport
    seaport = new Seaport(seller);

    // 将费用定义成变量，方便后面验证
    orderAmount = "100000000000000"; // 订价0.0001 weth
    handlingFee = "10000000000000"; // 手续费, 10％
    // 订单信息
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
          amount: handlingFee, // 0.1 matic (10%) 自定义收取10％手续费
          recipient: feeer.address,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      conduitKey,
    };
  });

  it("seller使用ETH上架订单，被buyer购买", async () => {
    // 交易前buyer和feeAddr的weth余额，以及seller和buyer的域名数
    const balancesBefore = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );

    // 上架
    const { executeAllActions } = await seaport.createOrder(order);
    const orderInfo = await executeAllActions();
    console.log("\n上架后订单信息:\n", JSON.stringify(orderInfo));
    console.log("\n上架成功");

    // buyer授权给seaport指定合约使用weth, 此合约地址固定为: 0x1e0049783f008a0085193e00003d00cd54003c71
    await wethContract
      .connect(buyer)
      .approve("0x1e0049783f008a0085193e00003d00cd54003c71", mockAddrBalance);
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");

    // 调用合约进行交易
    const tx = await seaportContract
      .connect(buyer)
      .fulfillAvailableOrders(
        [orderInfo],
        [[[0, 0]]],
        [[[0, 0]], [[0, 1]]],
        conduitKey,
        1
      );
    const receipt = await tx.wait();
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");
    console.log("购买域名交易哈希:", receipt.transactionHash);

    // 交易后seller和buyer的域名数变化验证, 以及手续费验证
    // balancesBefore / balancesAfter: [sellerDomainNum, buyerDomainNum, feeerBalance]
    const balancesAfter = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );
    // seller域名减1， buyer域名增加1
    expect(balancesBefore[0].sub(balancesAfter[0]).toString()).to.equal("1");
    expect(balancesAfter[1].sub(balancesBefore[1]).toString()).to.equal("1");
    // feeer's weth增加应等于订单的10%, 即handlingFee
    expect(balancesAfter[2].sub(balancesBefore[2]).toString()).to.equal(
      handlingFee
    );
  });
});
