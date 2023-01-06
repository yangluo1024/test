const { Seaport } = require("@opensea/seaport-js");
const axios = require("axios");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

const UD_ABI = require("./ABI/ud_abi.json");
const UD_ADDRESS = "0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f";
const SEA_ABI = require("./ABI/seaport_abi.json");
const SEA_ADDRESS = "0x00000000006c3852cbef3e08e8df289169ede581";
const WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

const userAddress = "0xF880E7cd6eE8423fd4954379977c73a474A71842";
const theThirdAddr = "0xE9c273E205dd99C1C2Eea66f0cb7655cDFB1AE41";

// 全局账户、合约对象
let signer;
let seaport;
let UD;
let SEA;
let signOrderInfo;

describe("Seaport main interfaces", function () {
  beforeEach(async function () {
    order = {
      offerer: userAddress,
      offer: [
        {
          itemType: 2,
          token: UD_ADDRESS,
          identifierOrCriteria:
            "10972960335751688875393978132030640555815094700642329234937142627564682509899",
          startAmount: "1",
          endAmount: "1",
        },
      ],
      consideration: [
        {
          // itemType: 0,
          // token: "0x0000000000000000000000000000000000000000",
          itemType: 1,
          token: WETH_ADDRESS,
          identifierOrCriteria: "0",
          startAmount: "9750000000000000",
          endAmount: "9750000000000000",
          recipient: userAddress,
        },
        {
          // itemType: 0,
          // token: "0x0000000000000000000000000000000000000000",
          itemType: 1,
          token: WETH_ADDRESS,
          identifierOrCriteria: "0",
          startAmount: "250000000000000",
          endAmount: "250000000000000",
          recipient: "0x0000a26b00c1F0DF003000390027140000fAa719",
          // recipient: theThirdAddr,
        },
      ],
      startTime: Math.floor(Date.now() / 1000).toString(),
      endTime: (Math.floor(Date.now() / 1000) + 2678400).toString(),
      totalOriginalConsiderationItems: 2,
      orderType: 0,
      zone: "0x0000000000000000000000000000000000000000",
      zoneHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      salt: Math.floor(Math.random() * 10 ** 10).toString(),
      conduitKey:
        "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
      counter: 0,
    };

    // default network: matic
    const provider = ethers.provider;
    UD = new ethers.Contract(UD_ADDRESS, UD_ABI, provider);
    SEA = new ethers.Contract(SEA_ADDRESS, SEA_ABI, provider);

    // seller
    signer = new ethers.Wallet(
      "c2c2baa320e652038e3a6a003a75e28c10bb77d98785edb40ecc2c55af6a6e3b",
      provider
    );
    seaport = new Seaport(signer);

    signOrderInfo = await seaport.signOrder(order, 0, userAddress);
    console.log("sign order info: ", signOrderInfo);
  });

  it("get balance", async () => {
    const myBalance = await UD.balanceOf(userAddress);
    console.log("my balance: ", myBalance);
  });

  it("listing on opensea(order.consideration[1] must be opensea's addr and the handling fee must be 2.5%", async () => {
    const url = "https://api.opensea.io/v2/orders/matic/seaport/listings";
    const cHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": "1cf95be40f1e45449c0b63ccb4b64cef",
    };
    const data = {
      parameters: order,
      signature: signOrderInfo,
    };
    await axios
      .post(url, data, { headers: cHeaders })
      // .then(response => response.json())
      .catch((err) => {
        // console.log(err);
        if (err.response) {
          console.log(err.response.data);
          console.log(err.response.status);
          console.log(err.response.headers);
        } else {
          console.log("Error: ", err.message);
        }
      });
  });
});
