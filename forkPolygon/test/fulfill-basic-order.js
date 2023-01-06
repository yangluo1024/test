const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ABI = require("./ABI/seaport_abi.json");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";

const fulfiller = "0xB59C41952e354Dcc3C47ea7dE833231BEc0A6FE7";
const offerer = "0xF880E7cd6eE8423fd4954379977c73a474A71842";
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
      offer: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifier:
            "10972960335751688875393978132030640555815094700642329234937142627564682509899",
        },
      ],
      consideration: [
        {
          amount: "90000000000000000",
          recipient: offerer,
        },
        {
          amount: "10000000000000000",
          recipient: feeAddr,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      conduitKey,
    };

    // default network: matic
    udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
    seaContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

    // seller
    buyer = new ethers.Wallet(
      "10a369f72de648d05c665405b0403e4dd6bae74ee7edb0c77e791fff02b770b7",
      provider
    );
    // buyer
    seller = new ethers.Wallet(
      "c2c2baa320e652038e3a6a003a75e28c10bb77d98785edb40ecc2c55af6a6e3b",
      provider
    );
    seaport = new Seaport(seller);
  });

  it("get balance", async () => {
    const myBalance = await udContract.balanceOf(seller.address);
    console.log("my balance: ", myBalance);
  });

  it("create order with customised handling fee address and fulfill basic order", async () => {
    await printBalances(seller.address, buyer.address);
    const { executeAllActions } = await seaport.createOrder(order);
    const orderInfo = await executeAllActions();
    console.log("\norder info:\n", JSON.stringify(orderInfo));
    console.log(provider);

    // deep copy
    const ordComponents = JSON.parse(JSON.stringify(orderInfo.parameters));
    // console.log("\norder component info:\n", JSON.stringify(ordComponents));

    // fulfill order by contract call
    const basicOrder = {
      considerationToken: ordComponents.consideration[0].token,
      considerationIdentifier:
        ordComponents.consideration[0].identifierOrCriteria,
      considerationAmount: ordComponents.consideration[0].startAmount,
      offerer: ordComponents.offerer,
      zone: ordComponents.zone,
      offerToken: ordComponents.offer[0].token,
      offerIdentifier: ordComponents.offer[0].identifierOrCriteria,
      offerAmount: ordComponents.offer[0].startAmount,
      basicOrderType: 0,
      startTime: ordComponents.startTime,
      endTime: ordComponents.endTime,
      zoneHash: ordComponents.zoneHash,
      salt: ordComponents.salt,
      offererConduitKey: ordComponents.conduitKey,
      fulfillerConduitKey: ordComponents.conduitKey,
      totalOriginalAdditionalRecipients: 1,
      additionalRecipients: [
        {
          amount: ordComponents.consideration[1].startAmount,
          recipient: ordComponents.consideration[1].recipient,
        },
      ],
      signature: orderInfo.signature,
    };

    console.log("\nbasic order params:\n", basicOrder);
    console.log("\nseaport contract name:", await seaContract.name());
    let price = await provider.getGasPrice();
    let options = { gasPrice: price, gasLimit: 13000000 };
    await seaContract.connect(buyer).fulfillBasicOrder(basicOrder, options);

    await printBalances(seller.address, buyer.address);
  });
});
