import * as dotenv from "dotenv";
import { privKey01, privKey02 } from "./src/__tests__/utils/config";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 137,
      allowUnlimitedContractSize: true,
      // gas: 2100000,
      // blockGasLimit: 13000000000,
      // gasPrice: 120000000000,
      forking: {
        url: "https://polygon-mainnet.g.alchemy.com/v2/594bB0_KGtMkKfl-7xcQecptI9ARWliX",
        // blockNumber: 37634330,
        // url: "https://eth-mainnet.g.alchemy.com/v2/2wRkPECJbByVaA8E5FzIxToJeMT5osNy",
        // blockNumber: 16337600,
      },
    },
    Matic_main: {
      chainId: 137,
      gas: 2100000,
      blockGasLimit: 13000000,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      gasPrice: 50000000000, // 50 GWei
      // url: "https://polygon-rpc.com/",
      url: "https://polygon-mainnet.g.alchemy.com/v2/594bB0_KGtMkKfl-7xcQecptI9ARWliX",
      accounts: [privKey01, privKey02],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  typechain: {
    outDir: "src/typechain",
    target: "ethers-v5",
  },
  paths: {
    tests: "src/__tests__",
    artifacts: "src/artifacts",
    sources: "src/contracts",
  },
};

export default config;
