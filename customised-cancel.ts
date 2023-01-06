import { Seaport } from "../seaport";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { ItemType } from "../constants";
import { CreateOrderInput } from "../types";
import { describeWithFixture } from "./utils/setup";
import { privKey01 } from "./utils/config";

const provider = ethers.provider;
const seller = new ethers.Wallet(privKey01, provider);
// const buyer = new ethers.Wallet(privKey02, provider);
const seaport = new Seaport(seller);

// const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const UD_TOKEN_ID =
  "106474465106524182929113463698598154918809512223128274872137732536781963473526";
// const SEA_ABI = require("./ABI/seaport_abi.json");
// const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
// const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

// 合约实例
// const udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
// const seaContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

const offerer = "0xAa7739805C133F6eF0275638b3412af76F51777A";
const feeAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";
// const fulfiller = "0xF880E7cd6eE8423fd4954379977c73a474A71842";
// const conduitKey =
//   "0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const startTime = Math.floor(Date.now() / 1000).toString();
const endTime = (Math.floor(Date.now() / 1000) + 2678400).toString();

describeWithFixture("cancel an order(customised listing)", () => {
  let standardCreateOrderInput: CreateOrderInput;
  beforeEach(async () => {
    standardCreateOrderInput = {
      startTime,
      endTime,
      // conduitKey,
      offer: [
        {
          itemType: ItemType.ERC721,
          token: UD_ADDRESS,
          identifier: UD_TOKEN_ID,
        },
      ],
      consideration: [
        {
          amount: parseEther("0.10").toString(),
          recipient: offerer,
        },
      ],
      // 10% fee
      fees: [{ recipient: feeAddr, basisPoints: 1000 }],
    };
  });

  it("validate then cancel single order", async () => {
    const beforeBalance = await provider.getBalance(seller.address);
    console.log("\nbalance before tx:", beforeBalance);

    const { executeAllActions } = await seaport.createOrder(
      standardCreateOrderInput
    );
    const order = await executeAllActions();
    console.log("\norder info:\n", JSON.stringify(order));

    // Remove signature
    order.signature = "0x";

    await seaport.validate([order], offerer).transact();
    const orderHash = seaport.getOrderHash(order.parameters);
    expect(await seaport.getOrderStatus(orderHash)).to.have.property(
      "isValidated",
      true
    );

    await seaport.cancelOrders([order.parameters], offerer).transact();
    expect(await seaport.getOrderStatus(orderHash)).to.have.property(
      "isCancelled",
      true
    );

    const afterBalance = await provider.getBalance(seller.address);
    console.log("\nbalance after tx:", afterBalance);
    console.log(
      "\ntx fee:",
      beforeBalance.toBigInt() - afterBalance.toBigInt()
    );
  });
});
