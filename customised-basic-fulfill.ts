import { providers } from "@0xsequence/multicall";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import sinon from "sinon";
import { ItemType, MAX_INT } from "../constants";
import { CreateOrderInput, CurrencyItem } from "../types";
import * as fulfill from "../utils/fulfill";
import {
  getBalancesForFulfillOrder,
  verifyBalancesAfterFulfill,
} from "./utils/balance";
import { describeWithFixture } from "./utils/setup";
import { Seaport } from "../seaport";
import { privKey01, privKey02 } from "./utils/config";

const provider = ethers.provider;
const seller = new ethers.Wallet(privKey01, provider);
const buyer = new ethers.Wallet(privKey02, provider);
const seaport = new Seaport(seller);

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const UD_TOKEN_ID =
  "106474465106524182929113463698598154918809512223128274872137732536781963473526";
// const SEA_ABI = require("./ABI/seaport_abi.json");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
// const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

// 合约实例
const udContract = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
// const seaContract = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

const offerer = "0xAa7739805C133F6eF0275638b3412af76F51777A";
const feeAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";
const fulfiller = "0xF880E7cd6eE8423fd4954379977c73a474A71842";
// const conduitKey =
//   "0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const startTime = Math.floor(Date.now() / 1000).toString();
const endTime = (Math.floor(Date.now() / 1000) + 2678400).toString();

describeWithFixture("fulfill basic order(single order)", () => {
  let standardCreateOrderInput: CreateOrderInput;
  beforeEach(async () => {
    standardCreateOrderInput = {
      startTime,
      endTime,
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

  it("fulfill single order(ERC721 <=> Matic)", async () => {
    const beforeBalance = await provider.getBalance(buyer.address);
    console.log("\nbalance before tx:", beforeBalance);
    const sellerBalance = await udContract.balanceOf(seller.address);
    console.log("\nseller's domain balance before tx:", sellerBalance);
    const buyerBalance = await udContract.balanceOf(buyer.address);
    console.log("\nbuyer's domain balance before tx:", buyerBalance);

    const { executeAllActions } = await seaport.createOrder(
      standardCreateOrderInput
    );

    const order = await executeAllActions();
    console.log("\norder info:\n", JSON.stringify(order));

    // const seaport2 = new Seaport(buyer);
    const { actions } = await seaport.fulfillOrder({
      order,
      accountAddress: fulfiller,
    });

    expect(actions.length).to.eq(1);

    const action = actions[0];

    expect(action.type).eq("exchange");

    // const options = { gasPrice: 50000000000, gasLimit: 13000000 };
    // const transaction = await action.transactionMethods.transact(options);
    // const receipt = await transaction.wait();
    // console.log("\nreceipt info:\n", JSON.stringify(receipt));

    const afterBalance = await provider.getBalance(buyer.address);
    console.log("\nbalance after tx:", afterBalance);
    console.log(
      "\ntx fee:",
      beforeBalance.toBigInt() - afterBalance.toBigInt()
    );
    const sellerBalance2 = await udContract.balanceOf(seller.address);
    console.log("\nseller's domain balance after tx:", sellerBalance2);
    const buyerBalance2 = await udContract.balanceOf(buyer.address);
    console.log("\nbuyer's domain balance after tx:", buyerBalance2);
  });
});
