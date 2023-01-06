require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  // defaultNetwork: "Matic_main",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // gas: 2100000,
      allowUnlimitedContractSize: true,
      chainId: 137,
      // gasPrice: 8000000000,
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
      gasPrice: 50000000000, //50 GWei
      // ignoreprice: 30000000000,
      // pricelimit: 30000000000,
      //'https://matic-mainnet.chainstacklabs.com'//
      //url: "https://polygon-mainnet.infura.io/v3/9020d984dfd94edaa8f7605a074ea000",
      // url: "https://matic-mainnet.chainstacklabs.com",
      url: "https://polygon-rpc.com/",
      // url: "https://polygon-mainnet.g.alchemy.com/v2/594bB0_KGtMkKfl-7xcQecptI9ARWliX",
    },
  },
};
