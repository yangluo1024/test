require('@nomicfoundation/hardhat-toolbox')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: '0.8.17',
	defaultNetwork: 'Matic_main',
	// defaultNetwork: "hardhat",
	networks: {
		hardhat: {
			mining: {
				auto: false,
				interval: 3000,
			},
			// gasPrice: 500000000,
			chainId: 137,
			loggingEnabled: true,
		},

		localhost: {
			network_id: '*',
			//chainId: 31337,
			//url: `http://52.76.235.183:8545`,
			url: `http://127.0.0.1:8545`,
			//accounts: [`0x${ROPSTEN_PRIVATE_KEY}`]
		},
		Matic_main: {
			chainId: 137,
			allowUnlimitedContractSize: true,
			url: 'https://polygon-mainnet.g.alchemy.com/v2/594bB0_KGtMkKfl-7xcQecptI9ARWliX',
			timeout: 200000,
		},
		ETH_main: {
			chainId: 1,
			allowUnlimitedContractSize: true,
			url: 'https://eth-mainnet.g.alchemy.com/v2/2wRkPECJbByVaA8E5FzIxToJeMT5osNy',
		},
	},
}
