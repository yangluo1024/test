// 使用ETH上架单个订单，并取消
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

// 打印seller和buyer的域名数, 以及seller的matic, feeer的weth
async function printBalances(sellerAddr, buyerAddr, feeAddr) {
  const sellerDomainNum = await udContract.balanceOf(sellerAddr);
  console.log("seller域名数:", sellerDomainNum);
  const buyerDomainNum = await udContract.balanceOf(buyerAddr);
  console.log("buyer域名数:", buyerDomainNum);
  const sellerBalance = await provider.getBalance(sellerAddr);
  console.log("seller's余额:", sellerBalance);
  const feeerBalance = await wethContract.balanceOf(feeAddr);
  console.log("feeer's余额:", feeerBalance);
  // 返回seller和buyer的域名数，以及seller的余额
  return [sellerDomainNum, buyerDomainNum, sellerBalance];
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
          amount: handlingFee,
          recipient: feeer.address,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      conduitKey,
    };
  });

  it("seller使用ETH上架订单，再取消上架", async () => {
    // 上架
    const { executeAllActions } = await seaport.createOrder(order);
    const orderInfo = await executeAllActions();
    console.log("\n上架后订单信息:\n", JSON.stringify(orderInfo));
    console.log("\n上架成功");
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");

    // 交易前seller和feeAddr的余额，以及seller和buyer的域名数
    const balancesBefore = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );

    // 调用合约取消上架
    const tx = await seaportContract
      .connect(seller)
      .cancel([orderInfo.parameters]);
    const receipt = await tx.wait();
    await network.provider.send("evm_increaseTime", [60]);
    await network.provider.send("evm_mine");
    console.log("\n购买域名交易哈希:", receipt.transactionHash);

    // 取消后seller和buyer的域名数变化验证, 并打印取消交易手续费
    // balancesBefore / balancesAfter: [sellerDomainNum, buyerDomainNum, sellerBalance]
    const balancesAfter = await printBalances(
      seller.address,
      buyer.address,
      feeer.address
    );
    // seller域名减0， buyer域名增加0
    expect(balancesBefore[0].sub(balancesAfter[0]).toString()).to.equal("0");
    expect(balancesAfter[1].sub(balancesBefore[1]).toString()).to.equal("0");
    console.log(
      "取消上架gas费:",
      balancesBefore[2].sub(balancesAfter[2]).toString()
    );
  });
});
