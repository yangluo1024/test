import { expect } from "chai";
import { formatBytes32String } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { ItemType, NO_CONDUIT, OrderType } from "../constants";
import { ApprovalAction, CreateOrderAction } from "../types";
import { generateRandomSalt } from "../utils/order";
import { describeWithFixture } from "./utils/setup";
import { Seaport } from "../seaport";
import { privKey01 } from "./utils/config";

const provider = ethers.provider;
const seller = new ethers.Wallet(privKey01, provider);
// const buyer = new ethers.Wallet(privKey02, provider);
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
// const fulfiller = "0xF880E7cd6eE8423fd4954379977c73a474A71842";
// const conduitKey =
//   "0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000";
const startTime = Math.floor(Date.now() / 1000).toString();
const endTime = (Math.floor(Date.now() / 1000) + 2678400).toString();

describeWithFixture("listing with customised handling fee", () => {
  it("listing with MATIC", async () => {
    const salt = generateRandomSalt();
    const { actions } = await seaport.createOrder({
      startTime,
      endTime,
      salt,
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
          amount: ethers.utils.parseEther("0.10").toString(),
          recipient: offerer,
        },
      ],
      // 10% fee
      fees: [{ recipient: feeAddr, basisPoints: 1000 }],
    });

    const approvalAction = actions[0] as ApprovalAction;

    expect(approvalAction).to.be.deep.equal({
      type: "approval",
      token: UD_ADDRESS,
      identifierOrCriteria: UD_TOKEN_ID,
      itemType: ItemType.ERC721,
      transactionMethods: approvalAction.transactionMethods,
      operator: SEA_ADDRESS,
    });

    await approvalAction.transactionMethods.transact();

    // NFT should now be approved
    expect(await udContract.isApprovedForAll(offerer, SEA_ADDRESS)).to.be.true;

    const createOrderAction = actions[1] as CreateOrderAction;
    const order = await createOrderAction.createOrder();
    console.log("\norder info:\n", JSON.stringify(order));

    expect(createOrderAction.type).to.equal("create");
    expect(order).to.deep.equal({
      parameters: {
        consideration: [
          {
            // Fees were deducted
            endAmount: ethers.utils.parseEther("0.09").toString(),
            identifierOrCriteria: "0",
            itemType: ItemType.NATIVE,
            recipient: offerer,
            startAmount: ethers.utils.parseEther("0.09").toString(),
            token: ethers.constants.AddressZero,
          },
          {
            endAmount: ethers.utils.parseEther("0.01").toString(),
            identifierOrCriteria: "0",
            itemType: ItemType.NATIVE,
            recipient: feeAddr,
            startAmount: ethers.utils.parseEther("0.01").toString(),
            token: ethers.constants.AddressZero,
          },
        ],
        endTime,
        offer: [
          {
            endAmount: "1",
            identifierOrCriteria: UD_TOKEN_ID,
            itemType: ItemType.ERC721,
            startAmount: "1",
            token: UD_ADDRESS,
          },
        ],
        offerer,
        orderType: OrderType.FULL_OPEN,
        salt,
        startTime,
        totalOriginalConsiderationItems: 2,
        zone: ethers.constants.AddressZero,
        zoneHash: formatBytes32String("0"),
        conduitKey: NO_CONDUIT,
        counter: 0,
      },
      signature: order.signature,
    });
    console.log(provider);
  });

  // it("listing with ETH(WETH)", async () => {
  //   const startTime = Math.floor(Date.now() / 1000).toString();
  //   const endTime = (Math.floor(Date.now() / 1000) + 2678400).toString();
  //   const salt = generateRandomSalt();

  //   const { actions } = await seaport.createOrder({
  //     startTime,
  //     endTime,
  //     salt,
  //     // conduitKey: defaultConduiKey,
  //     offer: [
  //       {
  //         itemType: ItemType.ERC721,
  //         token: UD_ADDRESS,
  //         identifier: UD_TOKEN_ID,
  //       },
  //     ],
  //     consideration: [
  //       {
  //         itemType: 1, // ERC20
  //         token: WETH_ADDRESS,
  //         amount: ethers.utils.parseEther("0.001").toString(),
  //         recipient: offerer,
  //       },
  //     ],
  //     // 10% fee
  //     fees: [{ recipient: feeAddr, basisPoints: 1000 }],
  //   });
  //   console.log(actions.length);

  //   const approvalAction = actions[0] as ApprovalAction;

  //   expect(approvalAction).to.be.deep.equal({
  //     type: "approval",
  //     token: UD_ADDRESS,
  //     identifierOrCriteria: UD_TOKEN_ID,
  //     itemType: ItemType.ERC721,
  //     transactionMethods: approvalAction.transactionMethods,
  //     operator: SEA_ADDRESS,
  //   });

  //   await approvalAction.transactionMethods.transact();

  //   // NFT should now be approved
  //   expect(await udContract.isApprovedForAll(offerer, SEA_ADDRESS)).to.be.true;

  //   const createOrderAction = actions[1] as CreateOrderAction;
  //   const order = await createOrderAction.createOrder();
  //   console.log("\norder info:\n", JSON.stringify(order));

  //   expect(createOrderAction.type).to.equal("create");
  //   expect(order).to.deep.equal({
  //     parameters: {
  //       consideration: [
  //         {
  //           // Fees were deducted
  //           endAmount: ethers.utils.parseEther("0.0009").toString(),
  //           identifierOrCriteria: "0",
  //           itemType: 1,
  //           recipient: offerer,
  //           startAmount: ethers.utils.parseEther("0.0009").toString(),
  //           token: WETH_ADDRESS,
  //         },
  //         {
  //           endAmount: ethers.utils.parseEther("0.0001").toString(),
  //           identifierOrCriteria: "0",
  //           itemType: 1,
  //           recipient: feeAddr,
  //           startAmount: ethers.utils.parseEther("0.0001").toString(),
  //           token: WETH_ADDRESS,
  //         },
  //       ],
  //       endTime,
  //       offer: [
  //         {
  //           endAmount: "1",
  //           identifierOrCriteria: UD_TOKEN_ID,
  //           itemType: ItemType.ERC721,
  //           startAmount: "1",
  //           token: UD_ADDRESS,
  //         },
  //       ],
  //       offerer,
  //       orderType: OrderType.FULL_OPEN,
  //       salt,
  //       startTime,
  //       totalOriginalConsiderationItems: 2,
  //       zone: ethers.constants.AddressZero,
  //       zoneHash: formatBytes32String("0"),
  //       conduitKey: NO_CONDUIT,
  //       counter: 0,
  //     },
  //     signature: order.signature,
  //   });
  // });
});
